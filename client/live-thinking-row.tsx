import type { PluginTimelineItemProps } from "@getpaseo/plugin/client";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { ScrollView, Text } from "react-native";
import type { LiveThinkingData } from "../shared/live-thinking";
import { liveThinkingLine } from "./live-thinking-item";
import { CODE_LINE_STYLE, TimelineBadge, UI_FONT } from "./timeline-badge";
import { useAutoCollapse } from "./use-auto-collapse";
import { useToggle } from "./use-toggle";

/** Native detail blocks cap their scroll area at 400px; a compact layout gets less. */
const DETAIL_MAX_HEIGHT = 400;
const DETAIL_MAX_HEIGHT_COMPACT = 260;
/** Characters kept in the one-line summary. */
const SUMMARY_CHARS = 220;
const SUMMARY_CHARS_COMPACT = 120;

/**
 * Thinking row: expands while the thought streams so the reasoning is readable
 * as it arrives, and folds back to a single line a few seconds after it ends.
 * Expanded, the detail block is pinned to the newest text; collapsed, the header
 * keeps the start of the thought, which is what identifies it.
 */
export function LiveThinkingRow({
  item,
  theme,
  layout,
}: PluginTimelineItemProps<LiveThinkingData>) {
  const data = item.data;
  const { expanded, toggle } = useToggle(useAutoCollapse(data.streaming));
  const scrollRef = useRef<ScrollView>(null);

  const styles = useMemo(
    () => ({
      scroll: { maxHeight: layout.compact ? DETAIL_MAX_HEIGHT_COMPACT : DETAIL_MAX_HEIGHT },
      text: {
        fontFamily: UI_FONT,
        fontSize: 14,
        lineHeight: 20,
        color: theme.colors.foreground,
      },
    }),
    [theme, layout.compact],
  );

  // Memoized on the text so a streaming chunk only re-renders the row when the
  // visible head of the thought actually changed.
  const summary = useMemo(
    () => liveThinkingLine(data.text, layout.compact ? SUMMARY_CHARS_COMPACT : SUMMARY_CHARS),
    [data.text, layout.compact],
  );

  const renderDetails = useCallback(
    () => (
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={CODE_LINE_STYLE}
        nestedScrollEnabled
        showsVerticalScrollIndicator
      >
        <Text style={styles.text} selectable>
          {data.text}
        </Text>
      </ScrollView>
    ),
    [styles, data.text],
  );

  // While the thought streams, keep the expanded view pinned to the newest
  // text so the tail of the reasoning is always visible.
  const lastText = useRef("");
  useEffect(() => {
    if (expanded && data.streaming && lastText.current !== data.text) {
      lastText.current = data.text;
      scrollRef.current?.scrollToEnd({ animated: false });
    }
  }, [data.text, data.streaming, expanded]);

  return (
    <TimelineBadge
      theme={theme}
      icon="Brain"
      label={data.streaming ? "Thinking" : "Thought"}
      summary={summary}
      summaryLines={1}
      active={data.streaming || expanded}
      expanded={expanded}
      onToggle={toggle}
      renderDetails={renderDetails}
    />
  );
}
