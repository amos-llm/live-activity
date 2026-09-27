import {
  LIVE_THINKING_KIND,
  LIVE_THINKING_VERSION,
  liveThinkingDataSchema,
} from "../shared/live-thinking";

/** Characters kept in the one-line summary. */
const SUMMARY_CHARS = 220;

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

/**
 * Reads a reasoning timeline item.
 *
 * Reasoning is a plain `{ type: "reasoning", text }` item whose `text` is the
 * accumulated reasoning so far, so every streaming update carries the whole
 * thought. Paseo's protocol package is private to the host, so the shape is
 * re-derived at runtime instead of imported.
 */
export function readReasoning(item: unknown): string | undefined {
  const record = asRecord(item);
  if (record?.type !== "reasoning") return undefined;
  const text = typeof record.text === "string" ? record.text : "";
  return text.trim() === "" ? undefined : text;
}

/** Which end of a long thought the one-line summary keeps. */
interface ThinkingLineOptions {
  /** Newest end while streaming, start once complete. Defaults to the newest end. */
  end?: "start" | "end";
  /** Maximum length of the summary line. */
  max?: number;
}

/**
 * Collapses a thought to a single line. While the model is still thinking the
 * newest end is kept, so the row keeps changing; once the thought is complete
 * the beginning is kept, which is what identifies the thought.
 */
export function liveThinkingLine(text: string, options: ThinkingLineOptions = {}): string {
  const { end = "end", max = SUMMARY_CHARS } = options;
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= max) return compact;
  return end === "start" ? compact.slice(0, max) : compact.slice(compact.length - max);
}

/**
 * Timeline transformer body for reasoning items. Returns `undefined` for
 * anything that is not reasoning, so Paseo keeps rendering its own row.
 */
export function liveThinkingTimelineItem(item: unknown, phase: "streaming" | "complete") {
  const text = readReasoning(item);
  if (text === undefined) return undefined;

  const parsed = liveThinkingDataSchema.safeParse({ text, streaming: phase === "streaming" });
  if (!parsed.success) return undefined;

  return {
    items: [
      {
        type: "plugin" as const,
        kind: LIVE_THINKING_KIND,
        version: LIVE_THINKING_VERSION,
        data: { text: parsed.data.text, streaming: parsed.data.streaming },
      },
    ],
  };
}
