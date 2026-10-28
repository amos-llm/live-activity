import { LIVE_EDIT_KIND, LIVE_EDIT_VERSION, liveEditDataSchema } from "../shared/live-edit";
import type { LiveStatus } from "../shared/live-status";
import { keepOutputHead } from "./clamp-output";
import { displayPath } from "./file-path";
import { asRecord, asString, describeError, readItemCwd, readStatus } from "./tool-item";

/** A diff line, classified by what it does to the file. */
export type DiffLineKind = "add" | "remove" | "context" | "meta";

export interface DiffLine {
  kind: DiffLineKind;
  /** The line exactly as the provider wrote it (sign and any numbers included). */
  text: string;
  /**
   * React key. (`kind`, nth line of that kind) is unique within one diff and
   * survives a re-parse of an unchanged prefix, without duplicating the text.
   */
  key: string;
}

export interface ParsedDiff {
  lines: DiffLine[];
  additions: number;
  deletions: number;
}

/**
 * Front matter of a unified diff. Checked before the `+` / `-` prefixes,
 * because `--- a/file` and `+++ b/file` would otherwise count as a removed and
 * an added line.
 */
const DIFF_META_PREFIXES = ["diff ", "index ", "--- ", "+++ ", "\\ "];

function classify(line: string): DiffLineKind {
  if (line.startsWith("@@")) return "meta";
  for (const prefix of DIFF_META_PREFIXES) {
    if (line.startsWith(prefix)) return "meta";
  }
  if (line.startsWith("+")) return "add";
  if (line.startsWith("-")) return "remove";
  return "context";
}

/**
 * Splits a unified diff into lines the row can color, and counts what changed.
 *
 * Providers disagree on the dialect: pi writes `<sign><line number> <text>` with
 * `...` gap markers and no hunk headers, while git-style patches carry `@@`
 * hunks and file headers. Both start every line with the same sign column, so
 * one classifier covers them; the text is kept verbatim, which preserves pi's
 * own line numbers.
 *
 * A truly empty line only ever comes from the trailing newline (an empty
 * context line is a single space), so those are dropped instead of rendered as
 * a blank row.
 */
export function parseDiff(diff: string): ParsedDiff {
  const lines: DiffLine[] = [];
  const occurrences = new Map<DiffLineKind, number>();
  let additions = 0;
  let deletions = 0;

  for (const text of diff.split("\n")) {
    if (text === "") continue;
    const kind = classify(text);
    if (kind === "add") additions += 1;
    else if (kind === "remove") deletions += 1;
    const occurrence = occurrences.get(kind) ?? 0;
    occurrences.set(kind, occurrence + 1);
    lines.push({ kind, text, key: `${kind}-${occurrence}` });
  }

  return { lines, additions, deletions };
}

function splitLines(text: string | undefined): string[] {
  if (text === undefined || text === "") return [];
  return text.replace(/\n+$/, "").split("\n");
}

/**
 * Builds a diff from an edit's `oldString` / `newString`. Paseo only reports
 * the first edit's strings, and only when the provider sends no patch, so this
 * is a stand-in that shows the intent while the call is still running — the
 * real patch usually lands with the result.
 */
export function synthesizeDiff(
  oldString: string | undefined,
  newString: string | undefined,
): string {
  const lines: string[] = [];
  for (const line of splitLines(oldString)) lines.push(`-${line}`);
  for (const line of splitLines(newString)) lines.push(`+${line}`);
  return lines.join("\n");
}

/** `+12 -4`, or an empty string when nothing changed. */
export function diffStat(additions: number, deletions: number): string {
  const parts: string[] = [];
  if (additions > 0) parts.push(`+${additions}`);
  if (deletions > 0) parts.push(`-${deletions}`);
  return parts.join(" ");
}

interface EditToolCallSnapshot {
  filePath: string;
  displayPath: string;
  unifiedDiff?: string;
  oldString?: string;
  newString?: string;
  status: LiveStatus;
  errorText?: string;
}

/**
 * Reads an `edit` tool call out of a Paseo timeline item. Paseo's protocol
 * package is private to the host, so the shape is re-derived at runtime;
 * anything that is not an edit call returns `undefined` and keeps the native
 * row.
 */
export function readEditToolCall(item: unknown): EditToolCallSnapshot | undefined {
  const record = asRecord(item);
  if (record?.type !== "tool_call") return undefined;

  const detail = asRecord(record.detail);
  if (detail?.type !== "edit") return undefined;

  const filePath = asString(detail.filePath) ?? "";
  const unifiedDiff = asString(detail.unifiedDiff);
  const oldString = asString(detail.oldString);
  const newString = asString(detail.newString);

  return {
    filePath,
    displayPath: displayPath(filePath, readItemCwd(record)),
    unifiedDiff: unifiedDiff === "" ? undefined : unifiedDiff,
    oldString,
    newString,
    status: readStatus(record.status),
    errorText: describeError(record.error),
  };
}

/**
 * Timeline transformer body. Returns `undefined` for anything that is not an
 * edit call. A diff is read from its first hunk, so the transformer keeps the
 * head; absent optional fields are omitted because item data must be
 * JSON-compatible.
 */
export function liveEditTimelineItem(item: unknown) {
  const snapshot = readEditToolCall(item);
  if (!snapshot) return undefined;

  const synthesized = snapshot.unifiedDiff === undefined;
  const diff = synthesized
    ? synthesizeDiff(snapshot.oldString, snapshot.newString)
    : (snapshot.unifiedDiff ?? "");
  const { output: clamped, truncated } = keepOutputHead(diff);
  const { additions, deletions } = parseDiff(clamped);

  const data: Record<string, string | number | boolean> = {
    filePath: snapshot.filePath,
    displayPath: snapshot.displayPath,
    diff: clamped,
    additions,
    deletions,
    status: snapshot.status,
  };
  if (synthesized && clamped !== "") data.synthesized = true;
  if (snapshot.errorText !== undefined) data.errorText = snapshot.errorText;
  if (truncated) data.truncated = true;

  // The snapshot carries the provider's fields; the row gets the derived one.
  const parsed = liveEditDataSchema.safeParse(data);
  if (!parsed.success) return undefined;

  return {
    items: [
      {
        type: "plugin" as const,
        kind: LIVE_EDIT_KIND,
        version: LIVE_EDIT_VERSION,
        data: parsed.data,
      },
    ],
  };
}
