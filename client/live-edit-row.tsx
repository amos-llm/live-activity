import type { PluginTimelineItemProps } from "@getpaseo/plugin/client";
import { useCallback, useMemo } from "react";
import { Text } from "react-native";
import type { LiveEditData } from "../shared/live-edit";
import { DetailBlock } from "./detail-block";
import { MAX_SUMMARY_PATH_CHARS, shortenPath } from "./file-path";
import { diffStat, parseDiff, type DiffLineKind } from "./live-edit-item";
import { MONO_FONT, TimelineBadge } from "./timeline-badge";
import { useAutoCollapse } from "./use-auto-collapse";
import { useToggle } from "./use-toggle";

const CODE_FONT_SIZE = 12;
const CODE_LINE_HEIGHT = 18;

/**
 * Edit row: opens while the patch is being applied and shows it line by line —
 * added lines in the success colour, removed ones in the danger colour, file
 * headers muted — with the change counts in the header.
 *
 * The visible text is the provider's patch, so pi's own line numbers survive.
 * Providers that report no patch (and every provider while the call still runs)
 * fall back to the first edit's old/new strings, which the row labels as such.
 */
export function LiveEditRow({ item, theme }: PluginTimelineItemProps<LiveEditData>) {
  const data = item.data;
  const running = data.status === "running";
  const { expanded, toggle } = useToggle(useAutoCollapse(running));

  const parsed = useMemo(() => parseDiff(data.diff), [data.diff]);
  const stat = useMemo(
    () => diffStat(data.additions, data.deletions),
    [data.additions, data.deletions],
  );
  const summary = useMemo(() => {
    // The change counts ride in the header, so the path gets what is left.
    const budget = stat === "" ? MAX_SUMMARY_PATH_CHARS : MAX_SUMMARY_PATH_CHARS - stat.length - 1;
    const path = shortenPath(data.displayPath, budget);
    return stat === "" ? path : `${path} ${stat}`;
  }, [data.displayPath, stat]);

  const styles = useMemo(() => {
    const code = {
      fontFamily: MONO_FONT,
      fontSize: CODE_FONT_SIZE,
      lineHeight: CODE_LINE_HEIGHT,
    } as const;
    const byKind: Record<DiffLineKind, { color: string }> = {
      add: { color: theme.colors.statusSuccess },
      remove: { color: theme.colors.statusDanger },
      context: { color: theme.colors.foreground },
      meta: { color: theme.colors.foregroundMuted },
    };
    return {
      code,
      add: byKind.add,
      remove: byKind.remove,
      context: byKind.context,
      meta: byKind.meta,
    };
  }, [theme]);

  const body = useMemo(
    () =>
      parsed.lines.length === 0 ? null : (
        <Text style={styles.code} selectable>
          {parsed.lines.map((line, index) => (
            <Text key={line.key} style={styles[line.kind]}>
              {line.text}
              {index === parsed.lines.length - 1 ? null : "\n"}
            </Text>
          ))}
        </Text>
      ),
    [parsed, styles],
  );

  const renderDetails = useCallback(() => {
    return (
      <DetailBlock
        theme={theme}
        meta={data.filePath}
        body={body}
        placeholder={running ? "Applying…" : "(no patch)"}
        footnote={
          data.synthesized
            ? "the provider reported no patch; this is the first edit's old/new text"
            : data.truncated
              ? "… later diff lines dropped to keep the row small"
              : undefined
        }
        errorText={data.errorText}
      />
    );
  }, [theme, body, data.filePath, data.synthesized, data.truncated, data.errorText, running]);

  return (
    <TimelineBadge
      theme={theme}
      icon="Pencil"
      label="Edit"
      summary={summary}
      summaryLines={1}
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
