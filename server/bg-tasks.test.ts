import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { killTask, listTasks, sessionTaskDirs, sessionTasksHome, tailLog } from "./bg-tasks";

const SESSION = "01a1a1a1-1111-2222-3333-444455556666";
const RUN_DIR = `${SESSION}-4242`;

function tempHome(): string {
  return mkdtempSync(join(tmpdir(), "pi-taskwatch-test-"));
}

/** A fake `<cwd>/.pi/tasks` home holding one run dir for SESSION. */
function makeHome(files: Record<string, string> = {}): { home: string; dirs: string[] } {
  const home = tempHome();
  const dir = join(home, RUN_DIR);
  mkdirSync(dir, { recursive: true });
  for (const [file, content] of Object.entries(files)) writeFileSync(join(dir, file), content);
  return { home, dirs: [dir] };
}

function taskJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    id: "abc123456",
    name: "demo",
    command: "sleep 3",
    status: "running",
    cwd: "/data5/amos",
    startTime: 1000,
    endTime: null,
    exitCode: null,
    signal: null,
    pid: 4242,
    isAgent: false,
    bytesWritten: 0,
    notified: false,
    ...overrides,
  });
}

describe("sessionTasksHome", () => {
  it("scopes pi task state to the agent's cwd", () => {
    expect(sessionTasksHome("/w/app")).toBe(join("/w/app", ".pi", "tasks"));
  });
});

describe("sessionTaskDirs", () => {
  it("returns [] when the tasks home is missing", async () => {
    expect(await sessionTaskDirs("/nonexistent/pi/tasks/home", SESSION)).toEqual([]);
  });

  it("keeps only this session's run dirs", async () => {
    const home = tempHome();
    mkdirSync(join(home, RUN_DIR), { recursive: true });
    mkdirSync(join(home, `${SESSION}-777`), { recursive: true });
    mkdirSync(join(home, "other-session-1"), { recursive: true });
    writeFileSync(join(home, "stray.txt"), "not a dir");
    try {
      const dirs = await sessionTaskDirs(home, SESSION);
      expect([...dirs].sort()).toEqual([join(home, `${SESSION}-777`), join(home, RUN_DIR)].sort());
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("returns [] when no run dir matches the session", async () => {
    const home = tempHome();
    mkdirSync(join(home, "other-session-1"), { recursive: true });
    try {
      expect(await sessionTaskDirs(home, SESSION)).toEqual([]);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});

describe("listTasks", () => {
  it("returns [] when there are no run dirs", async () => {
    expect(await listTasks([], SESSION)).toEqual([]);
  });

  it("tolerates a run dir that vanished", async () => {
    expect(await listTasks([join(tempHome(), "gone")], SESSION)).toEqual([]);
  });

  it("reads task metas and flags output files", async () => {
    const { home, dirs } = makeHome({
      "abc123456.json": taskJson(),
      "abc123456.output": "hello\n",
    });
    try {
      const tasks = await listTasks(dirs, SESSION);
      expect(tasks).toHaveLength(1);
      expect(tasks[0]).toMatchObject({
        id: "abc123456",
        name: "demo",
        status: "running",
        // the full session id, not the first dash-separated chunk
        sessionId: SESSION,
        cwd: "/data5/amos",
        hasOutput: true,
      });
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("skips unknown statuses", async () => {
    const { home, dirs } = makeHome({ "zzz.json": taskJson({ status: "weird" }) });
    try {
      expect(await listTasks(dirs, SESSION)).toEqual([]);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("sorts newest first", async () => {
    const { home, dirs } = makeHome({
      "aaa.json": taskJson({ id: "aaa", startTime: 1000 }),
      "bbb.json": taskJson({ id: "bbb", startTime: 2000 }),
    });
    try {
      expect((await listTasks(dirs, SESSION)).map((task) => task.id)).toEqual(["bbb", "aaa"]);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});

describe("tailLog", () => {
  it("returns the tail and marks a truncated head", async () => {
    const { home, dirs } = makeHome();
    const body = Array.from({ length: 2000 }, (_, i) => `line ${i}`).join("\n");
    writeFileSync(join(dirs[0], "abc123456.output"), body);
    try {
      const text = await tailLog(dirs, "abc123456", 2048);
      expect(text).toContain("…(tail");
      expect(text).toContain("line 1999");
      expect(text).not.toContain("line 0");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("returns '' for an unknown id", async () => {
    expect(await tailLog([join(tempHome(), "gone")], "missing", 1024)).toBe("");
  });
});

describe("killTask", () => {
  it("refuses non-running tasks", async () => {
    const { home, dirs } = makeHome({ "abc123456.json": taskJson({ status: "completed" }) });
    try {
      const result = await killTask(dirs, "abc123456");
      expect(result.sent).toBe(false);
      expect(result.note).toBe("task status is completed");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("refuses tasks without a pid", async () => {
    const { home, dirs } = makeHome({ "abc123456.json": taskJson({ pid: null }) });
    try {
      const result = await killTask(dirs, "abc123456");
      expect(result).toEqual({ sent: false, pid: null, note: "task has no recorded pid" });
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("reports missing metas", async () => {
    expect(await killTask([], "nope")).toEqual({
      sent: false,
      pid: null,
      note: "no task json for nope",
    });
  });
});
