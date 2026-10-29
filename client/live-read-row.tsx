import type { PluginTimelineItemProps } from "@getpaseo/plugin/client";
import { useCallback, useMemo } from "react";
import { Text } from "react-native";
import type { LiveReadData } from "../shared/live-read";
import { shortenPath } from "./file-path";
import { DetailBlock } from "./detail-block";
import { gutterNumbers, lineCount, readRangeLabel } from "./live-read-item";
import { MONO_FONT, TimelineBadge } from "./timeline-badge";
import { useAutoOpen } from "./use-auto-collapse";
import { useToggle } from "./use-toggle";

const CODE_FONT_SIZE = 12;
const CODE_LINE_HEIGHT = 18;

/**
 * Read row: opens while the file is being read and shows the beginning of it,
 * with line numbers starting at the provider's `offset`.
 *
 * Every provider seen so far reports the whole file at once when the call ends,
 * so the row is a static block once it has content: the head is what a read is
 * for, and it starts at the first line.
 */
export function LiveReadRow({ item, theme, layout }: PluginTimelineItemProps<LiveReadData>) {
  const data = item.data;
  const running = data.status === "running";
  const { expanded, toggle } = useToggle(useAutoOpen(running, layout.compact));

  const lines = useMemo(() => lineCount(data.content), [data.content]);
  const range = useMemo(
    () => readRangeLabel(data.filePath, data.startLine, lines, data.limit),
    [data.filePath, data.startLine, lines, data.limit],
  );
  const gutter = useMemo(
    () => gutterNumbers(data.startLine, lines) || undefined,
    [data.startLine, lines],
  );
  // pi does not report the cwd on a tool call, so the header shortens the path
  // from the front and the block keeps it whole.
  const summary = useMemo(() => shortenPath(data.displayPath), [data.displayPath]);

  const styles = useMemo(
    () => ({
      code: {
        fontFamily: MONO_FONT,
        fontSize: CODE_FONT_SIZE,
        lineHeight: CODE_LINE_HEIGHT,
        color: theme.colors.foreground,
      },
    }),
    [theme],
  );

  const body = useMemo(
    () =>
      data.content === "" ? null : (
        <Text style={styles.code} selectable>
          {data.content}
        </Text>
      ),
    [data.content, styles],
  );

  const renderDetails = useCallback(
    () => (
      <DetailBlock
        theme={theme}
        compact={layout.compact}
        meta={range}
        gutter={gutter}
        body={body}
        placeholder={running ? "Reading…" : "(empty file)"}
        footnote={data.truncated ? "… later lines dropped to keep the row small" : undefined}
        errorText={data.errorText}
      />
    ),
    [theme, layout.compact, range, gutter, body, data.truncated, data.errorText, running],
  );

  return (
    <TimelineBadge
      theme={theme}
      icon="Eye"
      label="Read"
      summary={summary}
      summaryLines={1}
      failed={data.status === "failed"}
      canceled={data.status === "canceled"}
      active={expanded}
      loading={running}
      compact={layout.compact}
      expanded={expanded}
      onToggle={toggle}
      renderDetails={renderDetails}
    />
  );
}
