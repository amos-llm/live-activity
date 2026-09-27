import { LIVE_SHELL_KIND, LIVE_SHELL_VERSION, liveShellDataSchema } from "../shared/live-shell";

const KNOWN_STATUSES = new Set(["running", "completed", "failed", "canceled"]);

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
    command: asString(detail.command) ?? "",
    output: asString(detail.output) ?? "",
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

  const data: Record<string, string | number | null> = {
    command: parsed.data.command,
    output: parsed.data.output,
    status: parsed.data.status,
  };
  if (parsed.data.exitCode !== undefined) data.exitCode = parsed.data.exitCode;
  if (parsed.data.errorText !== undefined) data.errorText = parsed.data.errorText;

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
