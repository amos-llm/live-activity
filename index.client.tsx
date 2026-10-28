import type { PluginCleanup } from "@getpaseo/plugin";
import type { PluginClientContext } from "@getpaseo/plugin/client";
import { LiveEditRow } from "./client/live-edit-row";
import { liveEditTimelineItem } from "./client/live-edit-item";
import { LiveReadRow } from "./client/live-read-row";
import { liveReadTimelineItem } from "./client/live-read-item";
import { LiveSearchRow } from "./client/live-search-row";
import { liveSearchTimelineItem } from "./client/live-search-item";
import { liveShellTimelineItem } from "./client/live-shell-item";
import { LiveShellRow } from "./client/live-shell-row";
import { liveThinkingTimelineItem } from "./client/live-thinking-item";
import { LiveThinkingRow } from "./client/live-thinking-row";
import { LIVE_EDIT_KIND, LIVE_EDIT_VERSION, liveEditDataSchema } from "./shared/live-edit";
import { LIVE_READ_KIND, LIVE_READ_VERSION, liveReadDataSchema } from "./shared/live-read";
import { LIVE_SEARCH_KIND, LIVE_SEARCH_VERSION, liveSearchDataSchema } from "./shared/live-search";
import { LIVE_SHELL_KIND, LIVE_SHELL_VERSION, liveShellDataSchema } from "./shared/live-shell";
import {
  LIVE_THINKING_KIND,
  LIVE_THINKING_VERSION,
  liveThinkingDataSchema,
} from "./shared/live-thinking";

/**
 * Replaces shell tool-call rows with a live view of their output, read / edit /
 * search rows with a live view of the file or results they touch, and reasoning
 * rows with a live view that expands while the model thinks and folds once the
 * thought is done.
 *
 * Every other item returns `undefined` from a transformer, so Paseo keeps
 * rendering its own row. The host tries the transformers in registration order
 * and takes the first one that returns items, which is why shell / read / edit
 * / search can each own one transformer on the same `tool_call` item type.
 */
export default function contribute(client: PluginClientContext): PluginCleanup {
  const cleanups = [
    client.addTimelineTransformer({
      id: "live-shell",
      query: { itemType: "tool_call" },
      transform({ item }) {
        return liveShellTimelineItem(item);
      },
    }),

    client.addTimelineRenderer({
      kind: LIVE_SHELL_KIND,
      version: LIVE_SHELL_VERSION,
      schema: liveShellDataSchema,
      Component: LiveShellRow,
    }),

    client.addTimelineTransformer({
      id: "live-read",
      query: { itemType: "tool_call" },
      transform({ item }) {
        return liveReadTimelineItem(item);
      },
    }),

    client.addTimelineRenderer({
      kind: LIVE_READ_KIND,
      version: LIVE_READ_VERSION,
      schema: liveReadDataSchema,
      Component: LiveReadRow,
    }),

    client.addTimelineTransformer({
      id: "live-edit",
      query: { itemType: "tool_call" },
      transform({ item }) {
        return liveEditTimelineItem(item);
      },
    }),

    client.addTimelineRenderer({
      kind: LIVE_EDIT_KIND,
      version: LIVE_EDIT_VERSION,
      schema: liveEditDataSchema,
      Component: LiveEditRow,
    }),

    client.addTimelineTransformer({
      id: "live-search",
      query: { itemType: "tool_call" },
      transform({ item }) {
        return liveSearchTimelineItem(item);
      },
    }),

    client.addTimelineRenderer({
      kind: LIVE_SEARCH_KIND,
      version: LIVE_SEARCH_VERSION,
      schema: liveSearchDataSchema,
      Component: LiveSearchRow,
    }),

    client.addTimelineTransformer({
      id: "live-thinking",
      query: { itemType: "reasoning" },
      transform({ item, phase }) {
        return liveThinkingTimelineItem(item, phase);
      },
    }),

    client.addTimelineRenderer({
      kind: LIVE_THINKING_KIND,
      version: LIVE_THINKING_VERSION,
      schema: liveThinkingDataSchema,
      Component: LiveThinkingRow,
    }),
  ];

  return () => {
    for (const cleanup of cleanups) cleanup();
  };
}
