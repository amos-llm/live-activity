import { z } from "zod";
import { liveStatusSchema } from "./live-status";

/** Timeline renderer kind for edit rows. */
export const LIVE_EDIT_KIND = "live-edit";
/** Renderer contract version. Bump when the shape below changes incompatibly. */
export const LIVE_EDIT_VERSION = 1;

export const liveEditDataSchema = z.object({
  /** Path as the provider reports it (absolute on every provider seen so far). */
  filePath: z.string(),
  /** Path for the header, with the agent's working directory stripped. */
  displayPath: z.string(),
  /** Unified diff text, clamped by the transformer; empty when there is none. */
  diff: z.string(),
  /** Added / removed lines in the diff above. */
  additions: z.number(),
  deletions: z.number(),
  status: liveStatusSchema,
  /** True when the diff was built from the first edit's old/new strings. */
  synthesized: z.boolean().optional(),
  /** True when the transformer dropped the end of the diff to keep it small. */
  truncated: z.boolean().optional(),
  errorText: z.string().optional(),
});

export type LiveEditData = z.output<typeof liveEditDataSchema>;
