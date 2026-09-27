import type { PluginTimelineItemProps } from "@getpaseo/plugin/client";
import { useMemo } from "react";
import { ScrollView, Text } from "react-native";
import type { LiveThinkingData } from "../shared/live-thinking";
import { liveThinkingLine } from "./live-thinking-item";
import { DETAIL_CONTENT_STYLE, TimelineBadge, UI_FONT } from "./timeline-badge";
import { useToggle } from "./use-toggle";

/**
 * Thinking row: one line showing the newest part of the thought while it
 * streams, and the start of it once complete, so reasoning is visible without
 * expanding anything.
 */
export function LiveThinkingRow({ item, theme }: PluginTimelineItemProps<LiveThinkingData>) {
  const data = item.data;
  const { expanded, toggle } = useToggle(false);

  const textStyle = useMemo(
    () => ({ fontFamily: UI_FONT, fontSize: 14, lineHeight: 20, color: theme.colors.foreground }),
    [theme],
  );

  return (
    <TimelineBadge
      theme={theme}
      icon="Brain"
      label={data.streaming ? "Thinking" : "Thought"}
      summary={liveThinkingLine(data.text, { end: data.streaming ? "end" : "start" })}
      summaryLines={1}
      active={data.streaming || expanded}
      expanded={expanded}
      onToggle={toggle}
    >
      <ScrollView contentContainerStyle={DETAIL_CONTENT_STYLE}>
        <Text style={textStyle} selectable>
          {data.text}
        </Text>
      </ScrollView>
    </TimelineBadge>
  );
}
