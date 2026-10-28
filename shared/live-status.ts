import { z } from "zod";

/**
 * Tool-call status as Paseo reports it, narrowed to what a row renders. A
 * provider that starts reporting something new lands on `unknown` instead of
 * dropping the row.
 */
export const liveStatusSchema = z.enum(["running", "completed", "failed", "canceled", "unknown"]);

export type LiveStatus = z.output<typeof liveStatusSchema>;
