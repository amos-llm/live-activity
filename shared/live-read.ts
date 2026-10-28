import { z } from "zod";
import { liveStatusSchema } from "./live-status";

/** Timeline renderer kind for read rows. */
export const LIVE_READ_KIND = "live-read";
/** Renderer contract version. Bump when the shape below changes incompatibly. */
export const LIVE_READ_VERSION = 1;

export const liveReadDataSchema = z.object({
  /** Path as the provider reports it (absolute on every provider seen so far). */
  filePath: z.string(),
  /** Path for the header, with the agent's working directory stripped. */
  displayPath: z.string(),
  /** File content as the provider reports it, clamped by the transformer. */
  content: z.string(),
  /** Line number the content starts at: the provider's `offset`, 1 by default. */
  startLine: z.number(),
  /** Lines the call asked for, when the provider reports one. */
  limit: z.number().optional(),
  status: liveStatusSchema,
  errorText: z.string().optional(),
  /** True when the transformer dropped the end of the content to keep it small. */
  truncated: z.boolean().optional(),
});

export type LiveReadData = z.output<typeof liveReadDataSchema>;
