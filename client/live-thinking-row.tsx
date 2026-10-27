import type { PluginTimelineItemProps } from "@getpaseo/plugin/client";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { ScrollView, Text } from "react-native";
import type { LiveThinkingData } from "../shared/live-thinking";
import { liveThinkingLine } from "./live-thinking-item";
import { CODE_LINE_STYLE, TimelineBadge, UI_FONT } from "./timeline-badge";
import { useAutoCollapse } from "./use-auto-collapse";
import { usePinnedScroll } from "./use-pinned-scroll";
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
 * Expanded, the detail block follows the newest text while the reader is at the
 * bottom, and stops moving the moment they scroll up; collapsed, the header
 * keeps the start of the thought, which is what identifies it.
 */
export function LiveThinkingRow({
  item,
  theme,
  layout,
}: PluginTimelineItemProps<LiveThinkingData>) {
  const data = item.data;
  const { expanded, toggle } = useToggle(useAutoCollapse(data.streaming));
  const { ref: scrollRef, follow, reset, onScroll } = usePinnedScroll();
  // A thought that is already committed when the row opens is history and
  // starts at the top; a thought that was live when it opened keeps following
  // to the last chunk, which lands together with the `complete` phase.
  const wasLive = useRef(data.streaming);
  const wasExpanded = useRef(expanded);

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

  /** Follow the newest text only while the thought is still streaming. */
  const followText = useCallback(() => {
    if (data.streaming || wasLive.current) follow();
  }, [data.streaming, follow]);

  useEffect(() => {
    const opened = expanded && !wasExpanded.current;
    wasExpanded.current = expanded;
    if (!expanded) {
      wasLive.current = false;
      return;
    }
    // Re-arm only when the block opens, so a reader who scrolled up is not
    // pulled back down when the thought completes.
    if (opened) reset();
    if (data.streaming) wasLive.current = true;
  }, [expanded, data.streaming, reset]);

  const renderDetails = useCallback(
    () => (
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={CODE_LINE_STYLE}
        nestedScrollEnabled
        showsVerticalScrollIndicator
        scrollEventThrottle={16}
        onScroll={onScroll}
        onContentSizeChange={followText}
      >
        <Text style={styles.text} selectable>
          {data.text}
        </Text>
      </ScrollView>
    ),
    [styles, data.text, onScroll, followText, scrollRef],
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
