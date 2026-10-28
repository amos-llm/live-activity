import { LIVE_READ_KIND, LIVE_READ_VERSION, liveReadDataSchema } from "../shared/live-read";
import type { LiveStatus } from "../shared/live-status";
import { keepOutputHead } from "./clamp-output";
import { displayPath } from "./file-path";
import { asNumber, asRecord, asString, describeError, readItemCwd, readStatus } from "./tool-item";

interface ReadToolCallSnapshot {
  filePath: string;
  displayPath: string;
  content: string;
  startLine: number;
  limit?: number;
  status: LiveStatus;
  errorText?: string;
}

function trimTrailingNewlines(text: string): string {
  return text.replace(/\n+$/, "");
}

/** `offset` is 1-based, and a provider that omits it read from the top. */
function readStartLine(value: unknown): number {
  const offset = asNumber(value);
  return offset !== undefined && offset >= 1 ? Math.floor(offset) : 1;
}

function readLimit(value: unknown): number | undefined {
  const limit = asNumber(value);
  return limit !== undefined && limit > 0 ? Math.floor(limit) : undefined;
}

/**
 * Reads a `read` tool call out of a Paseo timeline item.
 *
 * Paseo's protocol package is private to the host, so the shape is re-derived
 * at runtime instead of imported: anything that is not a read call returns
 * `undefined` and keeps Paseo's native row. Every provider seen so far reports
 * the whole file in `detail.content` (and nothing while the call still runs),
 * so the row opens while it reads and fills in when the content lands.
 */
export function readReadToolCall(item: unknown): ReadToolCallSnapshot | undefined {
  const record = asRecord(item);
  if (record?.type !== "tool_call") return undefined;

  const detail = asRecord(record.detail);
  if (detail?.type !== "read") return undefined;

  const filePath = asString(detail.filePath) ?? "";

  return {
    filePath,
    displayPath: displayPath(filePath, readItemCwd(record)),
    content: trimTrailingNewlines(asString(detail.content) ?? ""),
    startLine: readStartLine(detail.offset),
    limit: readLimit(detail.limit),
    status: readStatus(record.status),
    errorText: describeError(record.error),
  };
}

/** Number of lines in a (already clamped) content block. */
export function lineCount(text: string): number {
  if (text === "") return 0;
  let lines = 1;
  for (let index = 0; index < text.length; index += 1) {
    if (text.charCodeAt(index) === 10) lines += 1;
  }
  return lines;
}

/**
 * The line-number column: one right-aligned number per line of content. Widths
 * agree so the numbers line up in a monospace font without a layout pass.
 */
export function gutterNumbers(startLine: number, lines: number): string {
  if (lines <= 0) return "";
  const width = String(startLine + lines - 1).length;
  const numbers: string[] = [];
  for (let index = 0; index < lines; index += 1) {
    numbers.push(String(startLine + index).padStart(width, " "));
  }
  return numbers.join("\n");
}

/**
 * What the call covers, for the muted line above the content:
 * `…/file.ts:120–409`. A read that has not reported its content yet counts the
 * lines it asked for, so the range is visible while it runs.
 */
export function readRangeLabel(
  filePath: string,
  startLine: number,
  lines: number,
  limit?: number,
): string {
  const shown = lines > 0 ? lines : (limit ?? 0);
  if (shown <= 0) return `${filePath}:${startLine}`;
  return `${filePath}:${startLine}–${startLine + shown - 1}`;
}

/**
 * Timeline transformer body. Returns `undefined` for anything that is not a
 * read call, so Paseo keeps rendering that row itself. Timeline item data must
 * be JSON-compatible, so absent optional fields are omitted.
 */
export function liveReadTimelineItem(item: unknown) {
  const snapshot = readReadToolCall(item);
  if (!snapshot) return undefined;

  const parsed = liveReadDataSchema.safeParse(snapshot);
  if (!parsed.success) return undefined;

  // A read is read from its first line, so the head is what matters.
  const { output: content, truncated } = keepOutputHead(parsed.data.content);

  const data: Record<string, string | number | boolean> = {
    filePath: parsed.data.filePath,
    displayPath: parsed.data.displayPath,
    content,
    startLine: parsed.data.startLine,
    status: parsed.data.status,
  };
  if (parsed.data.limit !== undefined) data.limit = parsed.data.limit;
  if (parsed.data.errorText !== undefined) data.errorText = parsed.data.errorText;
  if (truncated) data.truncated = true;

  return {
    items: [
      {
        type: "plugin" as const,
        kind: LIVE_READ_KIND,
        version: LIVE_READ_VERSION,
        data,
      },
    ],
  };
}
