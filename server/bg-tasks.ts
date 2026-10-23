import { promises as fs, type Dirent } from "node:fs";
import path from "node:path";
import type { BgTaskMeta } from "../shared/bg-tasks";

const MAX_LOG_BYTES = 64 * 1024;

const KNOWN_STATUSES = new Set(["pending", "running", "completed", "failed", "killed"]);

/**
 * Where pi's background-task extension keeps one session's task state:
 * `<cwd>/.pi/tasks`. The directory holds one `<sessionId>-<pid>` folder per pi
 * process that ran tasks in that session, so callers scope reads with
 * `sessionTaskDirs()` before listing anything.
 */
export function sessionTasksHome(cwd: string): string {
  return path.join(cwd, ".pi", "tasks");
}

/**
 * Run directories belonging to one pi session. A session that was resumed (or
 * restarted) can have several, one per pi pid, so this returns a list.
 */
export async function sessionTaskDirs(home: string, sessionId: string): Promise<string[]> {
  let entries: Dirent[];
  try {
    entries = await fs.readdir(home, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(`${sessionId}-`))
    .map((entry) => path.join(home, entry.name));
}

interface RawTask {
  [key: string]: unknown;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}
function asInt(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

/**
 * Reads `<sessionId>-<pid>/<id>.json` from the given session run directories,
 * which the pi runtime writes for every background task. Everything pi knows
 * about a task lands on disk here, so this read-only walk is the whole data
 * source.
 */
export async function listTasks(dirs: readonly string[], sessionId: string): Promise<BgTaskMeta[]> {
  const perDir = await Promise.all(dirs.map((dir) => readSessionDir(dir, sessionId)));
  const tasks = perDir.flat();
  tasks.sort((a, b) => b.startTime - a.startTime || a.id.localeCompare(b.id));
  return tasks;
}

async function readSessionDir(dirPath: string, sessionId: string): Promise<BgTaskMeta[]> {
  let files: string[];
  try {
    const entries = await fs.readdir(dirPath);
    files = entries.filter((file) => file.endsWith(".json"));
  } catch {
    return [];
  }

  const metas = await Promise.all(files.map((file) => readTaskMeta(dirPath, file, sessionId)));
  return metas.filter((meta): meta is BgTaskMeta => meta !== null);
}

async function readTaskMeta(dirPath: string, file: string, sessionId: string): Promise<BgTaskMeta | null> {
  const id = file.slice(0, -".json".length);
  const raw = await readJson(path.join(dirPath, file));
  if (!raw) return null;
  const status = asString(raw.status);
  if (!status || !KNOWN_STATUSES.has(status)) return null;
  const statusValue = status as BgTaskMeta["status"];
  const hasOutput = await exists(path.join(dirPath, `${id}.output`));
  const bytesWritten = asInt(raw.bytesWritten) ?? 0;
  return {
    id,
    name: asString(raw.name) ?? id,
    command: asString(raw.command) ?? "",
    status: statusValue,
    cwd: asString(raw.cwd) ?? "",
    sessionId,
    startTime: asInt(raw.startTime) ?? 0,
    endTime: asInt(raw.endTime),
    exitCode: asInt(raw.exitCode),
    signal: asString(raw.signal),
    pid: asInt(raw.pid),
    isAgent: raw.isAgent === true,
    bytesWritten,
    hasOutput,
    error: asString(raw.error),
    notified: raw.notified === true,
    timeoutSeconds: asInt(raw.timeoutSeconds),
  };
}

/** Tail of the `<id>.output` file, capped at `bytes` (max 64KB). */
export async function tailLog(dirs: readonly string[], id: string, bytes: number): Promise<string> {
  const file = await findOutput(dirs, id);
  if (!file) return "";
  const length = Math.min(bytes, MAX_LOG_BYTES);
  const { size } = await fs.stat(file);
  if (size === 0) return "";
  const start = Math.max(0, size - length);
  const handle = await fs.open(file, "r");
  try {
    const buffer = Buffer.alloc(Math.min(length, size));
    await handle.read(buffer, 0, buffer.length, start);
    let text = buffer.toString("utf8");
    if (start > 0) {
      // Drop the first (possibly partial) line to keep the tail clean.
      const newline = text.indexOf("\n");
      if (newline >= 0 && newline < 200) text = text.slice(newline + 1);
      text = `…(tail ${Math.round(length / 1024)}KB, file ${Math.round(size / 1024)}KB)…\n` + text;
    }
    return text;
  } finally {
    await handle.close();
  }
}

/**
 * Sends SIGTERM to the recorded pid. This bypasses pi on purpose: the plugin
 * observes pi's on-disk state and acts on the process directly.
 */
export async function killTask(
  dirs: readonly string[],
  id: string,
): Promise<{ sent: boolean; pid: number | null; note: string | null }> {
  const meta = await findMeta(dirs, id);
  if (!meta) return { sent: false, pid: null, note: `no task json for ${id}` };
  const pid = asInt(meta.pid);
  if (!pid) return { sent: false, pid: null, note: "task has no recorded pid" };
  const status = asString(meta.status);
  if (status !== "running") return { sent: false, pid, note: `task status is ${status ?? "unknown"}` };
  try {
    process.kill(pid, "SIGTERM");
    return { sent: true, pid, note: "SIGTERM sent" };
  } catch (error) {
    return { sent: false, pid, note: `kill failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

async function findMeta(dirs: readonly string[], id: string): Promise<RawTask | null> {
  const file = await findFile(dirs, `${id}.json`);
  return file ? readJson(file) : null;
}

async function findOutput(dirs: readonly string[], id: string): Promise<string | null> {
  return findFile(dirs, `${id}.output`);
}

async function findFile(dirs: readonly string[], suffix: string): Promise<string | null> {
  const candidates = dirs.map((dir) => path.join(dir, suffix));
  const found = await Promise.all(candidates.map(exists));
  const index = found.indexOf(true);
  return index === -1 ? null : candidates[index];
}

async function exists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function readJson(file: string): Promise<RawTask | null> {
  try {
    const text = await fs.readFile(file, "utf8");
    const parsed: unknown = JSON.parse(text);
    return parsed !== null && typeof parsed === "object" ? (parsed as RawTask) : null;
  } catch {
    return null;
  }
}
