import type { PluginTimelineItemProps } from "@getpaseo/plugin/client";
import { useCallback, useEffect, useMemo, useRef } from "react";
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
import { useAutoCollapse } from "./use-auto-collapse";
import { usePinnedScroll } from "./use-pinned-scroll";
import { useToggle } from "./use-toggle";

const CODE_LINE_HEIGHT = 18;
/** Native detail blocks cap their scroll area at 400px, on every layout. */
const DETAIL_MAX_HEIGHT = 400;

/**
 * Shell row: opens itself while the command runs, collapses when it ends, and
 * shows the output as it streams. The collapsed header keeps the command on
 * one line with a trailing ellipsis.
 *
 * The detail block is the native one: a capped vertical scroll around a
 * horizontal scroll, with the command and its output in a single monospace
 * block prefixed by `$ `. Expanded, it follows the newest output while the
 * reader is at the bottom — a chatty build shows its tail, not its first
 * screen — and stops the moment they scroll up.
 */
export function LiveShellRow({ item, theme }: PluginTimelineItemProps<LiveShellData>) {
  const data = item.data;
  const running = data.status === "running";
  // Hold the row open for a grace period after the command finishes so the
  // final output stays readable before the auto-collapse.
  const { expanded, toggle } = useToggle(useAutoCollapse(running));
  const { ref: scrollRef, follow, reset, onScroll } = usePinnedScroll();
  // A row that opens on a finished command is history and starts at the top;
  // a row that was live when it opened keeps following to the last chunk, which
  // usually lands together with the final status.
  const wasLive = useRef(running);
  const wasExpanded = useRef(expanded);
  const hasOutput = data.output !== "";

  const styles = useMemo(
    () => ({
      scroll: { maxHeight: DETAIL_MAX_HEIGHT },
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
    [theme],
  );

  /** Follow the newest output only while the command is still writing. */
  const followOutput = useCallback(() => {
    if (running || wasLive.current) follow();
  }, [running, follow]);

  useEffect(() => {
    const opened = expanded && !wasExpanded.current;
    wasExpanded.current = expanded;
    if (!expanded) {
      wasLive.current = false;
      return;
    }
    // Re-arm only when the block opens, so a reader who scrolled up is not
    // pulled back down when the command ends.
    if (opened) reset();
    if (running) wasLive.current = true;
  }, [expanded, running, reset]);

  const renderDetails = useCallback(
    () => (
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={DETAIL_VERTICAL_CONTENT_STYLE}
        nestedScrollEnabled
        showsVerticalScrollIndicator
        scrollEventThrottle={16}
        onScroll={onScroll}
        onContentSizeChange={followOutput}
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
      onScroll,
      followOutput,
      scrollRef,
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
