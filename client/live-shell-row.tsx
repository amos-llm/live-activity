import type { PluginTimelineItemProps } from "@getpaseo/plugin/client";
import { useCallback, useMemo } from "react";
import { ScrollView, Text, View } from "react-native";
import type { LiveShellData } from "../shared/live-shell";
import {
  CODE_LINE_STYLE,
  DETAIL_HORIZONTAL_CONTENT_STYLE,
  DETAIL_TEXT_STYLE,
  DETAIL_VERTICAL_CONTENT_STYLE,
  MONO_FONT,
  TimelineBadge,
} from "./timeline-badge";
import { useToggle } from "./use-toggle";

const CODE_LINE_HEIGHT = 18;
/** Native detail blocks cap their scroll area at 400px; a compact layout gets less. */
const DETAIL_MAX_HEIGHT = 400;
const DETAIL_MAX_HEIGHT_COMPACT = 260;

/**
 * Shell row: opens itself while the command runs, collapses when it ends, and
 * shows the output as it streams. The collapsed header keeps the command on
 * one line with a trailing ellipsis.
 *
 * The detail block is the native one: a capped vertical scroll around a
 * horizontal scroll, with the command and its output in a single monospace
 * block prefixed by `$ `.
 */
export function LiveShellRow({ item, theme, layout }: PluginTimelineItemProps<LiveShellData>) {
  const data = item.data;
  const running = data.status === "running";
  const { expanded, toggle } = useToggle(running);
  const hasOutput = data.output !== "";

  const styles = useMemo(
    () => ({
      scroll: { maxHeight: layout.compact ? DETAIL_MAX_HEIGHT_COMPACT : DETAIL_MAX_HEIGHT },
      text: {
        fontFamily: MONO_FONT,
        fontSize: 12,
        lineHeight: CODE_LINE_HEIGHT,
        color: theme.colors.foreground,
      },
      prompt: {
        fontFamily: MONO_FONT,
        fontSize: 12,
        lineHeight: CODE_LINE_HEIGHT,
        color: theme.colors.foregroundMuted,
      },
      errorText: [
        DETAIL_TEXT_STYLE,
        {
          fontFamily: MONO_FONT,
          fontSize: 12,
          lineHeight: CODE_LINE_HEIGHT,
          color: theme.colors.statusDanger,
        },
      ],
      metaText: [
        DETAIL_TEXT_STYLE,
        {
          fontFamily: MONO_FONT,
          fontSize: 12,
          lineHeight: CODE_LINE_HEIGHT,
          color: theme.colors.foregroundMuted,
        },
      ],
    }),
    [theme, layout.compact],
  );

  const renderDetails = useCallback(
    () => (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={DETAIL_VERTICAL_CONTENT_STYLE}
        nestedScrollEnabled
        showsVerticalScrollIndicator
      >
        <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator
          contentContainerStyle={DETAIL_HORIZONTAL_CONTENT_STYLE}
        >
          <View style={CODE_LINE_STYLE}>
            <Text style={styles.text} selectable>
              <Text style={styles.prompt}>$ </Text>
              {data.command}
              {hasOutput ? `\n\n${data.output}` : null}
            </Text>
            {hasOutput ? null : (
              <Text style={styles.metaText}>{running ? "Waiting for output…" : "(no output)"}</Text>
            )}
          </View>
        </ScrollView>
        {data.truncated ? (
          <Text style={styles.metaText}>… earlier output dropped to keep the row small</Text>
        ) : null}
        {data.errorText ? <Text style={styles.errorText}>{data.errorText}</Text> : null}
        {typeof data.exitCode === "number" ? (
          <Text style={styles.metaText}>exit {data.exitCode}</Text>
        ) : null}
      </ScrollView>
    ),
    [
      styles,
      data.command,
      data.output,
      data.truncated,
      data.errorText,
      data.exitCode,
      hasOutput,
      running,
    ],
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
      active={expanded}
      loading={running}
      expanded={expanded}
      onToggle={toggle}
      renderDetails={renderDetails}
    />
  );
}
