import type { LiveStatus } from "../shared/live-status";
import { LIVE_TOOL_KIND, LIVE_TOOL_VERSION, liveToolDataSchema } from "../shared/live-tool";
import { keepOutputHead } from "./clamp-output";
import { displayPath } from "./file-path";
import { asRecord, asString, describeError, readItemCwd, readStatus } from "./tool-item";

export interface LiveToolSection {
  title?: string;
  text: string;
}

export interface LiveToolSnapshot {
  label: string;
  icon: string;
  summary: string;
  summaryIsPath?: boolean;
  meta?: string;
  sections: LiveToolSection[];
  status: LiveStatus;
  errorText?: string;
}

/**
 * Lucide names, copied from native's `resolveToolCallIconName` table so a
 * `write` row carries the same pencil as native's, a `fetch` the same
 * magnifier, a sub-agent the same bot.
 */
const DETAIL_ICONS: Record<string, string> = {
  write: "Pencil",
  fetch: "Search",
  sub_agent: "Bot",
  plain_text: "Wrench",
  unknown: "Wrench",
};

/** Native's `plain_text` detail can name one of its own icons; lucide spells them differently. */
const NAMED_ICONS: Record<string, string> = {
  wrench: "Wrench",
  square_terminal: "SquareTerminal",
  eye: "Eye",
  pencil: "Pencil",
  search: "Search",
  bot: "Bot",
  sparkles: "Sparkles",
  brain: "Brain",
  mic_vocal: "MicVocal",
};

/** Detail types the four specific rows already own, plus the ones that keep a native row. */
const OTHER_DETAIL_TYPES = new Set(["shell", "read", "edit", "search", "plan", "worktree_setup"]);

function trimEdges(text: string): string {
  return text.replace(/^\n+/, "").replace(/\n+$/, "");
}

/**
 * Native's `u()`: a tool name becomes a display name — `web_search` → `Web
 * search` — unless it is already a namespaced identifier (`mcp__fs__read`,
 * `paseo.agent.spawn`), which it leaves alone.
 */
export function displayToolName(name: string): string {
  const trimmed = name.trim();
  if (trimmed === "") return trimmed;
  if (/[:./]/.test(trimmed) || trimmed.includes("__")) return trimmed;
  const words = trimmed
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter((word) => word.length > 0);
  if (words.length === 0) return trimmed;
  const lower = words.join(" ").toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/** `null`, `""`, `[]` and `{}` are what a provider sends when it has nothing to show. */
export function isMeaningfulDetail(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as object).length > 0;
  return true;
}

/** JSON as the block shows it: pretty-printed, or the value itself when it cannot be. */
export function detailJson(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

function writeToolCall(
  detail: Record<string, unknown>,
  cwd: string | undefined,
): Partial<LiveToolSnapshot> {
  const filePath = asString(detail.filePath) ?? "";
  const content = trimEdges(asString(detail.content) ?? "");
  return {
    label: "Write",
    icon: DETAIL_ICONS.write,
    summary: displayPath(filePath, cwd),
    summaryIsPath: true,
    meta: filePath === "" ? undefined : filePath,
    sections: content === "" ? [] : [{ text: content }],
  };
}

function fetchToolCall(detail: Record<string, unknown>): Partial<LiveToolSnapshot> {
  const url = asString(detail.url) ?? "";
  const result = trimEdges(asString(detail.result) ?? "");
  return {
    label: "Fetch",
    icon: DETAIL_ICONS.fetch,
    summary: url,
    meta: url === "" ? undefined : url,
    sections: result === "" ? [] : [{ text: result }],
  };
}

function subAgentToolCall(detail: Record<string, unknown>): Partial<LiveToolSnapshot> {
  const subAgentType = asString(detail.subAgentType);
  const description = asString(detail.description);
  const childSessionId = asString(detail.childSessionId);
  const log = trimEdges(asString(detail.log) ?? "");
  return {
    // Native: the sub-agent's type is the row's word, and `Task` when it has none.
    label: subAgentType !== undefined && subAgentType.trim() !== "" ? subAgentType : "Task",
    icon: DETAIL_ICONS.sub_agent,
    summary: description ?? "",
    meta: childSessionId === undefined ? undefined : `session ${childSessionId}`,
    sections: log === "" ? [] : [{ text: log }],
  };
}

function plainTextToolCall(
  detail: Record<string, unknown>,
  toolName: string,
): Partial<LiveToolSnapshot> {
  const named = asString(detail.icon);
  const text = trimEdges(asString(detail.text) ?? "");
  return {
    label: displayToolName(toolName),
    icon: (named !== undefined ? NAMED_ICONS[named] : undefined) ?? DETAIL_ICONS.plain_text,
    summary: asString(detail.label) ?? "",
    sections: text === "" ? [] : [{ text: text }],
  };
}

function unknownToolCall(
  detail: Record<string, unknown>,
  toolName: string,
): Partial<LiveToolSnapshot> {
  const input = detail.input;
  const output = detail.output;
  // A provider that sends one plain string and nothing else (native shows the
  // same thing: the string, with no Input / Output headings).
  if (typeof input === "string" && (output === null || output === undefined)) {
    return {
      label: displayToolName(toolName),
      icon: DETAIL_ICONS.unknown,
      summary: "",
      sections: trimEdges(input) === "" ? [] : [{ text: trimEdges(input) }],
    };
  }

  const sections: LiveToolSection[] = [];
  if (isMeaningfulDetail(input)) sections.push({ title: "Input", text: detailJson(input) });
  if (isMeaningfulDetail(output)) sections.push({ title: "Output", text: detailJson(output) });

  const isTask = toolName.trim().toLowerCase() === "task";
  return {
    label: isTask ? "Task" : displayToolName(toolName),
    icon: isTask ? "Bot" : DETAIL_ICONS.unknown,
    summary: "",
    sections,
  };
}

/**
 * Reads a tool call that none of the specific rows take — `write`, `fetch`,
 * `sub_agent`, `plain_text`, `unknown` — out of a Paseo timeline item.
 *
 * Paseo's protocol package is private to the host, so the shape is re-derived at
 * runtime. Anything this module does not own returns `undefined` and keeps the
 * native row: the four detail types with a row of their own, `plan` (native
 * renders a PlanCard, not a badge), `worktree_setup` (native opens no details
 * for it), and `speak` (native renders a player, not a tool call).
 */
export function readDetailToolCall(item: unknown): LiveToolSnapshot | undefined {
  const record = asRecord(item);
  if (record?.type !== "tool_call") return undefined;

  const detail = asRecord(record.detail);
  const detailType = asString(detail?.type);
  if (!detail || detailType === undefined) return undefined;
  if (OTHER_DETAIL_TYPES.has(detailType)) return undefined;

  const toolName = asString(record.name) ?? "";
  if (detailType === "unknown" && toolName.trim().toLowerCase() === "speak") return undefined;

  let snapshot: Partial<LiveToolSnapshot> | undefined;
  if (detailType === "write") snapshot = writeToolCall(detail, readItemCwd(record));
  else if (detailType === "fetch") snapshot = fetchToolCall(detail);
  else if (detailType === "sub_agent") snapshot = subAgentToolCall(detail);
  else if (detailType === "plain_text") snapshot = plainTextToolCall(detail, toolName);
  else if (detailType === "unknown") snapshot = unknownToolCall(detail, toolName);
  if (!snapshot) return undefined;

  return {
    label: snapshot.label ?? displayToolName(toolName),
    icon: snapshot.icon ?? DETAIL_ICONS.unknown,
    summary: snapshot.summary ?? "",
    summaryIsPath: snapshot.summaryIsPath,
    meta: snapshot.meta,
    sections: snapshot.sections ?? [],
    status: readStatus(record.status),
    errorText: describeError(record.error),
  };
}

/**
 * Timeline transformer body. Returns `undefined` for every tool call this row
 * does not own, so the host keeps rendering its own. Sections are read from
 * their first line, so the transformer keeps the head; absent optional fields
 * are omitted because item data must be JSON-compatible.
 */
export function liveToolTimelineItem(item: unknown) {
  const snapshot = readDetailToolCall(item);
  if (!snapshot) return undefined;

  let truncated = false;
  const sections: LiveToolSection[] = [];
  for (const section of snapshot.sections) {
    const { output, truncated: cut } = keepOutputHead(section.text);
    if (cut) truncated = true;
    if (output === "") continue;
    sections.push(
      section.title === undefined ? { text: output } : { title: section.title, text: output },
    );
  }

  const data: Record<string, unknown> = {
    label: snapshot.label,
    icon: snapshot.icon,
    summary: snapshot.summary,
    sections,
    status: snapshot.status,
  };
  if (snapshot.summaryIsPath) data.summaryIsPath = true;
  if (snapshot.meta !== undefined && snapshot.meta !== "") data.meta = snapshot.meta;
  if (snapshot.errorText !== undefined) data.errorText = snapshot.errorText;
  if (truncated) data.truncated = true;

  const parsed = liveToolDataSchema.safeParse(data);
  if (!parsed.success) return undefined;

  return {
    items: [
      {
        type: "plugin" as const,
        kind: LIVE_TOOL_KIND,
        version: LIVE_TOOL_VERSION,
        data: parsed.data,
      },
    ],
  };
}
