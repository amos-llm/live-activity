import { LIVE_SHELL_KIND, LIVE_SHELL_VERSION, liveShellDataSchema } from "../shared/live-shell";

const KNOWN_STATUSES = new Set(["running", "completed", "failed", "canceled"]);

/**
 * Output kept in the timeline item. Providers truncate themselves (pi keeps
 * 2000 lines / 50 KB), but not all of them do, and the whole output is
 * serialized on every streaming update, so the transformer clamps it here.
 */
const MAX_OUTPUT_CHARS = 50 * 1024;
const MAX_OUTPUT_LINES = 2_000;

/** Paseo's native shell detail drops the blank line providers often prepend. */
function trimLeadingNewlines(text: string): string {
  return text.replace(/^\n+/, "");
}

function trimTrailingNewlines(text: string): string {
  return text.replace(/\n+$/, "");
}

/**
 * Keeps the tail of a long output. Counting runs backwards on purpose: an output
 * from a provider that does not truncate can be megabytes, and splitting it into
 * an array to count lines would allocate all of it first.
 */
export function keepOutputTail(text: string): { output: string; truncated: boolean } {
  let output = text;
  let truncated = false;

  if (output.length > MAX_OUTPUT_CHARS) {
    output = output.slice(output.length - MAX_OUTPUT_CHARS);
    // The first line is almost certainly cut in half; drop it.
    const firstBreak = output.indexOf("\n");
    if (firstBreak !== -1) output = output.slice(firstBreak + 1);
    truncated = true;
  }

  let lines = 1;
  for (let index = output.length - 1; index >= 0; index -= 1) {
    if (output.charCodeAt(index) !== 10) continue;
    lines += 1;
    if (lines > MAX_OUTPUT_LINES) return { output: output.slice(index + 1), truncated: true };
  }

  return { output, truncated };
}

interface ShellToolCallSnapshot {
  command: string;
  output: string;
  status: "running" | "completed" | "failed" | "canceled" | "unknown";
  exitCode?: number | null;
  errorText?: string;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function describeError(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string") return value.trim() === "" ? undefined : value;
  const message = asString(asRecord(value)?.message);
  if (message && message.trim() !== "") return message;
  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
}

function readStatus(value: unknown): ShellToolCallSnapshot["status"] {
  const status = asString(value);
  return status && KNOWN_STATUSES.has(status)
    ? (status as ShellToolCallSnapshot["status"])
    : "unknown";
}

/**
 * Reads a shell tool call out of a Paseo timeline item.
 *
 * Paseo's protocol package is private to the host, so plugins cannot import its
 * types without failing the install-time client boundary check. The shape is
 * re-derived here at runtime instead: anything that is not a shell tool call
 * returns `undefined` and keeps Paseo's native row.
 */
export function readShellToolCall(item: unknown): ShellToolCallSnapshot | undefined {
  const record = asRecord(item);
  if (record?.type !== "tool_call") return undefined;

  const detail = asRecord(record.detail);
  if (detail?.type !== "shell") return undefined;

  const exitCode = detail.exitCode;

  return {
    command: trimTrailingNewlines(asString(detail.command) ?? ""),
    output: trimLeadingNewlines(asString(detail.output) ?? ""),
    status: readStatus(record.status),
    exitCode: typeof exitCode === "number" ? exitCode : exitCode === null ? null : undefined,
    errorText: describeError(record.error),
  };
}

/**
 * Timeline transformer body. Returns `undefined` for anything that is not a
 * shell call, so Paseo keeps rendering that row itself. Timeline item data must
 * be JSON-compatible, so absent optional fields are omitted rather than set to
 * `undefined`.
 */
export function liveShellTimelineItem(item: unknown) {
  const snapshot = readShellToolCall(item);
  if (!snapshot) return undefined;

  const parsed = liveShellDataSchema.safeParse(snapshot);
  if (!parsed.success) return undefined;

  const { output, truncated } = keepOutputTail(parsed.data.output);

  const data: Record<string, string | number | boolean | null> = {
    command: parsed.data.command,
    output,
    status: parsed.data.status,
  };
  if (parsed.data.exitCode !== undefined) data.exitCode = parsed.data.exitCode;
  if (parsed.data.errorText !== undefined) data.errorText = parsed.data.errorText;
  if (truncated) data.truncated = true;
  return {
    items: [
      {
        type: "plugin" as const,
        kind: LIVE_SHELL_KIND,
        version: LIVE_SHELL_VERSION,
        data,
      },
    ],
  };
}
