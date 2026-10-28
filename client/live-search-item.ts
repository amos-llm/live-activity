import { LIVE_SEARCH_KIND, LIVE_SEARCH_VERSION, liveSearchDataSchema } from "../shared/live-search";
import type { LiveStatus } from "../shared/live-status";
import { keepOutputHead } from "./clamp-output";
import { asNumber, asRecord, asString, describeError, readStatus } from "./tool-item";

interface WebResult {
  title: string;
  url: string;
}

interface SearchToolCallSnapshot {
  query: string;
  toolName?: string;
  content: string;
  filePaths: string[];
  webResults: WebResult[];
  numMatches?: number;
  numFiles?: number;
  durationMs?: number;
  status: LiveStatus;
  errorText?: string;
}

function trimLeadingNewlines(text: string): string {
  return text.replace(/^\n+/, "");
}

function trimTrailingNewlines(text: string): string {
  return text.replace(/\n+$/, "");
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const strings: string[] = [];
  for (const entry of value) {
    const text = asString(entry);
    if (text !== undefined) strings.push(text);
  }
  return strings;
}

function readWebResults(value: unknown): WebResult[] {
  if (!Array.isArray(value)) return [];
  const results: WebResult[] = [];
  for (const entry of value) {
    const record = asRecord(entry);
    const url = asString(record?.url);
    if (url === undefined) continue;
    results.push({ title: asString(record?.title) ?? url, url });
  }
  return results;
}

function readCount(value: unknown): number | undefined {
  const count = asNumber(value);
  return count !== undefined && count >= 0 ? Math.floor(count) : undefined;
}

/**
 * Reads a `search` tool call out of a Paseo timeline item.
 *
 * Paseo's protocol package is private to the host, so the shape is re-derived
 * at runtime: anything that is not a search call returns `undefined` and keeps
 * the native row. Providers fill in different parts of the detail — pi sends
 * only the matched text, others send counts, file lists or web results — so
 * every field is optional here and the row renders whatever arrived.
 */
export function readSearchToolCall(item: unknown): SearchToolCallSnapshot | undefined {
  const record = asRecord(item);
  if (record?.type !== "tool_call") return undefined;

  const detail = asRecord(record.detail);
  if (detail?.type !== "search") return undefined;

  return {
    query: trimTrailingNewlines(asString(detail.query) ?? ""),
    toolName: asString(detail.toolName),
    content: trimTrailingNewlines(trimLeadingNewlines(asString(detail.content) ?? "")),
    filePaths: readStringArray(detail.filePaths),
    webResults: readWebResults(detail.webResults),
    numMatches: readCount(detail.numMatches),
    numFiles: readCount(detail.numFiles),
    durationMs: readCount(detail.durationMs),
    status: readStatus(record.status),
    errorText: describeError(record.error),
  };
}

function formatDuration(ms: number): string {
  if (ms < 1_000) return `${ms}ms`;
  return `${(ms / 1_000).toFixed(1)}s`;
}

/**
 * The facts under the query: `12 matches · 8 files · 0.3s`. Only the parts the
 * provider actually reported appear, so a provider that sends just the text
 * leaves this empty.
 */
export function searchMeta(data: {
  numMatches?: number;
  numFiles?: number;
  durationMs?: number;
}): string | undefined {
  const parts: string[] = [];
  if (data.numMatches !== undefined) {
    parts.push(`${data.numMatches} ${data.numMatches === 1 ? "match" : "matches"}`);
  }
  if (data.numFiles !== undefined)
    parts.push(`${data.numFiles} ${data.numFiles === 1 ? "file" : "files"}`);
  if (data.durationMs !== undefined) parts.push(formatDuration(data.durationMs));
  return parts.length === 0 ? undefined : parts.join(" · ");
}

/** The results as one monospace block: matched text, file list, or web results. */
export function searchBody(data: {
  content: string;
  filePaths: string[];
  webResults: WebResult[];
}): string {
  if (data.content !== "") return data.content;
  if (data.filePaths.length > 0) return data.filePaths.join("\n");
  return data.webResults.map((result) => `${result.title}\n${result.url}`).join("\n\n");
}

/**
 * Timeline transformer body. Returns `undefined` for anything that is not a
 * search call. Results are read from the first match, so the transformer keeps
 * the head; absent optional fields are omitted because item data must be
 * JSON-compatible.
 */
export function liveSearchTimelineItem(item: unknown) {
  const snapshot = readSearchToolCall(item);
  if (!snapshot) return undefined;

  const { output: content, truncated } = keepOutputHead(snapshot.content);

  const data: Record<string, string | number | boolean | string[] | WebResult[]> = {
    query: snapshot.query,
    content,
    filePaths: snapshot.filePaths,
    webResults: snapshot.webResults,
    status: snapshot.status,
  };
  if (snapshot.toolName !== undefined) data.toolName = snapshot.toolName;
  if (snapshot.numMatches !== undefined) data.numMatches = snapshot.numMatches;
  if (snapshot.numFiles !== undefined) data.numFiles = snapshot.numFiles;
  if (snapshot.durationMs !== undefined) data.durationMs = snapshot.durationMs;
  if (snapshot.errorText !== undefined) data.errorText = snapshot.errorText;
  if (truncated) data.truncated = true;

  const parsed = liveSearchDataSchema.safeParse(data);
  if (!parsed.success) return undefined;

  return {
    items: [
      {
        type: "plugin" as const,
        kind: LIVE_SEARCH_KIND,
        version: LIVE_SEARCH_VERSION,
        data: parsed.data,
      },
    ],
  };
}
