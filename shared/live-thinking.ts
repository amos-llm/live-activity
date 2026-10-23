import { z } from "zod";

/** Timeline renderer kind for reasoning rows. */
export const LIVE_THINKING_KIND = "live-thinking";
/** Renderer contract version. Bump when the shape below changes incompatibly. */
export const LIVE_THINKING_VERSION = 1;

export const liveThinkingDataSchema = z.object({
  /** Accumulated reasoning text, exactly as the provider reports it. */
  text: z.string(),
  /** True while the model is still producing reasoning for this turn. */
  streaming: z.boolean(),
});

export type LiveThinkingData = z.output<typeof liveThinkingDataSchema>;
