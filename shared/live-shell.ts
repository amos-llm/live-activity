import { z } from "zod";

/** Timeline renderer kind for shell rows. */
export const LIVE_SHELL_KIND = "live-shell";
/** Renderer contract version. Bump when the shape below changes incompatibly. */
export const LIVE_SHELL_VERSION = 3;

const liveShellStatusSchema = z.enum(["running", "completed", "failed", "canceled", "unknown"]);

export const liveShellDataSchema = z.object({
  command: z.string(),
  /** Output as the provider reports it; providers truncate long output themselves. */
  output: z.string(),
  status: liveShellStatusSchema,
  exitCode: z.number().nullable().optional(),
  errorText: z.string().optional(),
});

export type LiveShellData = z.output<typeof liveShellDataSchema>;
