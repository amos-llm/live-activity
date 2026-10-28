import { z } from "zod";
import { liveStatusSchema } from "./live-status";

/** Timeline renderer kind for shell rows. */
export const LIVE_SHELL_KIND = "live-shell";
/** Renderer contract version. Bump when the shape below changes incompatibly. */
export const LIVE_SHELL_VERSION = 4;

export const liveShellDataSchema = z.object({
  command: z.string(),
  /** Output as the provider reports it, clamped by the transformer (see `keepOutputTail`). */
  output: z.string(),
  status: liveStatusSchema,
  exitCode: z.number().nullable().optional(),
  errorText: z.string().optional(),
  /** True when the transformer dropped the head of the output to keep it small. */
  truncated: z.boolean().optional(),
});

export type LiveShellData = z.output<typeof liveShellDataSchema>;
