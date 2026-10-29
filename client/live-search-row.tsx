import type { PluginTimelineItemProps } from "@getpaseo/plugin/client";
import { useCallback, useMemo } from "react";
import { Text } from "react-native";
import type { LiveSearchData } from "../shared/live-search";
import { DetailBlock } from "./detail-block";
import { searchBody, searchMeta } from "./live-search-item";
import { MONO_FONT, TimelineBadge } from "./timeline-badge";
import { useAutoOpen } from "./use-auto-collapse";
import { useToggle } from "./use-toggle";

const CODE_FONT_SIZE = 12;
const CODE_LINE_HEIGHT = 18;

/**
 * Search row: opens while the search runs and shows the matches as they land —
 * the matched text, a file list, or web results, whichever the provider
 * reports — with counts and duration underneath when it reports those too.
 *
 * The header keeps the query, like the native row; the facts live in the block.
 */
export function LiveSearchRow({ item, theme, layout }: PluginTimelineItemProps<LiveSearchData>) {
  const data = item.data;
  const running = data.status === "running";
  const { expanded, toggle } = useToggle(useAutoOpen(running, layout.compact));

  const meta = useMemo(
    () =>
      searchMeta({
        numMatches: data.numMatches,
        numFiles: data.numFiles,
        durationMs: data.durationMs,
      }),
    [data.numMatches, data.numFiles, data.durationMs],
  );
  const body = useMemo(
    () =>
      searchBody({
        content: data.content,
        filePaths: data.filePaths,
        webResults: data.webResults,
      }),
    [data.content, data.filePaths, data.webResults],
  );

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

  const details = useMemo(
    () =>
      body === "" ? null : (
        <Text style={styles.code} selectable>
          {body}
        </Text>
      ),
    [body, styles],
  );

  const renderDetails = useCallback(
    () => (
      <DetailBlock
        theme={theme}
        compact={layout.compact}
        meta={meta}
        body={details}
        placeholder={running ? "Searching…" : "(no results)"}
        footnote={data.truncated ? "… later results dropped to keep the row small" : undefined}
        errorText={data.errorText}
      />
    ),
    [theme, layout.compact, meta, details, data.truncated, data.errorText, running],
  );

  return (
    <TimelineBadge
      theme={theme}
      icon="Search"
      label="Search"
      summary={data.query}
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
