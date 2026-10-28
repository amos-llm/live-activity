import { LIVE_SHELL_KIND, LIVE_SHELL_VERSION, liveShellDataSchema } from "../shared/live-shell";
import type { LiveStatus } from "../shared/live-status";
import { keepOutputTail } from "./clamp-output";
import { asRecord, asString, describeError, readStatus } from "./tool-item";

/** Re-exported so the row's clamping rule stays testable from here. */
export { keepOutputTail };

/** Paseo's native shell detail drops the blank line providers often prepend. */
function trimLeadingNewlines(text: string): string {
  return text.replace(/^\n+/, "");
}

function trimTrailingNewlines(text: string): string {
  return text.replace(/\n+$/, "");
}

interface ShellToolCallSnapshot {
  command: string;
  output: string;
  status: LiveStatus;
  exitCode?: number | null;
  errorText?: string;
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
