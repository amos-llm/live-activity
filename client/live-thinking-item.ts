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

const WHITESPACE = /\s/;

/**
 * Collapses a thought to the beginning of a single line: whitespace runs become
 * one space, and at most `max` characters are kept. The beginning identifies
 * what was thought, and scanning stops once the line is full, so a very long
 * thought costs no more than the summary itself.
 */
export function liveThinkingLine(text: string, max = SUMMARY_CHARS): string {
  if (max <= 0) return "";
  let line = "";
  // Set by a whitespace run that separates two words; dropped at either edge.
  let gap = false;
  for (const char of text) {
    if (WHITESPACE.test(char)) {
      gap = line !== "";
      continue;
    }
    if (gap) {
      // The separator only counts if the word after it still fits.
      if (line.length >= max - 1) break;
      line += " ";
      gap = false;
    }
    line += char;
    if (line.length >= max) break;
  }
  return line;
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
