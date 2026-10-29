import { z } from "zod";
import { liveStatusSchema } from "./live-status";

/**
 * Timeline renderer kind for the tool calls the four specific rows do not take:
 * `write`, `fetch`, `sub_agent`, `plain_text` and `unknown` (which is what any
 * tool Paseo has no typed detail for reports, MCP tools included).
 */
export const LIVE_TOOL_KIND = "live-tool";
/** Renderer contract version. Bump when the shape below changes incompatibly. */
export const LIVE_TOOL_VERSION = 1;

const liveToolSectionSchema = z.object({
  /** Muted heading above the text (`Input` / `Output`). Omitted for a single block. */
  title: z.string().optional(),
  text: z.string(),
});

export const liveToolDataSchema = z.object({
  /** Header word: the display name native gives this tool (`Write`, `Fetch`, `Task`, …). */
  label: z.string(),
  /** Lucide icon name, from native's `resolveToolCallIconName` table. */
  icon: z.string(),
  /** Row summary: the path, the url, the description. */
  summary: z.string(),
  /**
   * True when the summary is a path, which is shortened from the front so the
   * file name survives (native ellipsizes the end, which cuts it off).
   */
  summaryIsPath: z.boolean().optional(),
  /** Muted line above the block: the full path, the url, the sub-agent session. */
  meta: z.string().optional(),
  /** The block, in order. Empty while the call still runs. */
  sections: z.array(liveToolSectionSchema),
  status: liveStatusSchema,
  /** True when the transformer dropped the end of a section to keep it small. */
  truncated: z.boolean().optional(),
  /**
   * True when native renders this detail in an inset `surface2` block (`fetch`,
   * `plain_text`, `unknown`) rather than the full-bleed one (`write`,
   * `sub_agent`).
   */
  inset: z.boolean().optional(),
  errorText: z.string().optional(),
});

export type LiveToolData = z.output<typeof liveToolDataSchema>;
