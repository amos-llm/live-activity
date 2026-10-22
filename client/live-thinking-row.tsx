import type { PluginTimelineItemProps } from "@getpaseo/plugin/client";
import { useCallback, useMemo } from "react";
import { ScrollView, Text } from "react-native";
import type { LiveThinkingData } from "../shared/live-thinking";
import { liveThinkingLine } from "./live-thinking-item";
import { CODE_LINE_STYLE, TimelineBadge, UI_FONT } from "./timeline-badge";
import { useToggle } from "./use-toggle";

/** Native detail blocks cap their scroll area at 400px; a compact layout gets less. */
const DETAIL_MAX_HEIGHT = 400;
const DETAIL_MAX_HEIGHT_COMPACT = 260;
/** Characters kept in the one-line summary. */
const SUMMARY_CHARS = 220;
const SUMMARY_CHARS_COMPACT = 120;

/**
 * Thinking row: one line showing the newest part of the thought while it
 * streams, and the start of it once complete, so reasoning is visible without
 * expanding anything.
 */
export function LiveThinkingRow({
  item,
  theme,
  layout,
}: PluginTimelineItemProps<LiveThinkingData>) {
  const data = item.data;
  const { expanded, toggle } = useToggle(false);

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

  // Recomputed on every streaming chunk, so it is memoized on the text and
  // only ever scans the newest window of a long thought.
  const summary = useMemo(
    () =>
      liveThinkingLine(data.text, {
        end: data.streaming ? "end" : "start",
        max: layout.compact ? SUMMARY_CHARS_COMPACT : SUMMARY_CHARS,
      }),
    [data.text, data.streaming, layout.compact],
  );

  const renderDetails = useCallback(
    () => (
      <ScrollView
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
