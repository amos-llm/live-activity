import { z } from "zod";
import { liveStatusSchema } from "./live-status";

/** Timeline renderer kind for search rows. */
export const LIVE_SEARCH_KIND = "live-search";
/** Renderer contract version. Bump when the shape below changes incompatibly. */
export const LIVE_SEARCH_VERSION = 1;

const webResultSchema = z.object({ title: z.string(), url: z.string() });

export const liveSearchDataSchema = z.object({
  /** The pattern / path that was searched for, as the provider reports it. */
  query: z.string(),
  /** Which search tool ran, when the provider names one (`grep`, `glob`, `web_search`). */
  toolName: z.string().optional(),
  /** Results as text, clamped by the transformer. */
  content: z.string(),
  /** Result files, for providers that report a file list instead of text. */
  filePaths: z.array(z.string()),
  /** Web results, for search tools that hit the network. */
  webResults: z.array(webResultSchema),
  numMatches: z.number().optional(),
  numFiles: z.number().optional(),
  durationMs: z.number().optional(),
  status: liveStatusSchema,
  /** True when the transformer dropped the end of the content to keep it small. */
  truncated: z.boolean().optional(),
  errorText: z.string().optional(),
});

export type LiveSearchData = z.output<typeof liveSearchDataSchema>;
