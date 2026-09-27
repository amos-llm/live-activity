import type { PluginTimelineItemProps } from "@getpaseo/plugin/client";
import { useMemo } from "react";
import { ScrollView, Text, View } from "react-native";
import type { LiveShellData } from "../shared/live-shell";
import { DETAIL_CONTENT_STYLE, MONO_FONT, TimelineBadge } from "./timeline-badge";
import { useToggle } from "./use-toggle";

const CODE_LINE_HEIGHT = 18;
const CODE_SCROLL_STYLE = { flexGrow: 0 } as const;

/**
 * Shell row: opens itself while the command runs, collapses when it ends, and
 * shows the output as it streams. The collapsed header keeps the command on
 * one line with a trailing ellipsis.
 */
export function LiveShellRow({ item, theme }: PluginTimelineItemProps<LiveShellData>) {
  const data = item.data;
  const running = data.status === "running";
  const { expanded, toggle } = useToggle(running);
  const isEmpty = data.output === "";
  const outputColor = isEmpty ? theme.colors.foregroundMuted : theme.colors.foreground;

  const styles = useMemo(
    () => ({
      text: {
        fontFamily: MONO_FONT,
        fontSize: 12,
        lineHeight: CODE_LINE_HEIGHT,
        color: outputColor,
      },
      error: {
        fontFamily: MONO_FONT,
        fontSize: 12,
        lineHeight: CODE_LINE_HEIGHT,
        color: theme.colors.statusDanger,
      },
    }),
    [theme, outputColor],
  );

  return (
    <TimelineBadge
      theme={theme}
      icon="SquareTerminal"
      label="Shell"
      summary={data.command}
      summaryLines={running ? undefined : 1}
      failed={data.status === "failed"}
      canceled={data.status === "canceled"}
      active={expanded || running}
      expanded={expanded}
      onToggle={toggle}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator
        style={CODE_SCROLL_STYLE}
        contentContainerStyle={DETAIL_CONTENT_STYLE}
      >
        <View>
          {data.errorText ? <Text style={styles.error}>{data.errorText}</Text> : null}
          <Text style={styles.text} selectable>
            {data.output === "" ? (running ? "Waiting for output…" : "(no output)") : data.output}
          </Text>
        </View>
      </ScrollView>
    </TimelineBadge>
  );
}
