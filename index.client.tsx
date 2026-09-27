import type { PluginClientContext } from "@getpaseo/plugin/client";
import { liveShellTimelineItem } from "./client/live-shell-item";
import { LiveShellRow } from "./client/live-shell-row";
import { liveThinkingTimelineItem } from "./client/live-thinking-item";
import { LiveThinkingRow } from "./client/live-thinking-row";
import { LIVE_SHELL_KIND, LIVE_SHELL_VERSION, liveShellDataSchema } from "./shared/live-shell";
import {
  LIVE_THINKING_KIND,
  LIVE_THINKING_VERSION,
  liveThinkingDataSchema,
} from "./shared/live-thinking";

/**
 * Replaces shell tool-call rows with a live view of their output, and reasoning
 * rows with a single line that keeps showing the newest part of the thought.
 *
 * Every other item returns `undefined` from a transformer, so Paseo keeps
 * rendering its own row.
 */
export default function contribute(client: PluginClientContext) {
  client.addTimelineTransformer({
    id: "live-shell",
    query: { itemType: "tool_call" },
    transform({ item }) {
      return liveShellTimelineItem(item);
    },
  });

  client.addTimelineRenderer({
    kind: LIVE_SHELL_KIND,
    version: LIVE_SHELL_VERSION,
    schema: liveShellDataSchema,
    Component: LiveShellRow,
  });

  client.addTimelineTransformer({
    id: "live-thinking",
    query: { itemType: "reasoning" },
    transform({ item, phase }) {
      return liveThinkingTimelineItem(item, phase);
    },
  });

  client.addTimelineRenderer({
    kind: LIVE_THINKING_KIND,
    version: LIVE_THINKING_VERSION,
    schema: liveThinkingDataSchema,
    Component: LiveThinkingRow,
  });

  return () => {};
}
