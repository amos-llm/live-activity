import type { PluginTimelineItemProps } from "@getpaseo/plugin/client";
import { useCallback, useMemo } from "react";
import { Text } from "react-native";
import type { LiveToolData } from "../shared/live-tool";
import { DetailBlock } from "./detail-block";
import { shortenPath } from "./file-path";
import { MONO_FONT, TimelineBadge } from "./timeline-badge";
import { useAutoCollapse } from "./use-auto-collapse";
import { useToggle } from "./use-toggle";

const CODE_FONT_SIZE = 12;
const CODE_LINE_HEIGHT = 18;

/**
 * The row for every tool call the four specific rows do not take: `write`,
 * `fetch`, `sub_agent`, `plain_text`, and `unknown` — which is what any tool
 * Paseo has no typed detail for reports, MCP tools included.
 *
 * Native gives these the same badge as a shell call and the same expandable
 * detail block; this row keeps that shape (label, tool glyph, summary in the
 * header, the content in the monospace block) and adds the live part: it opens
 * itself while the call runs and folds a few seconds after it ends, so what a
 * tool wrote or fetched is readable without a click.
 */
export function LiveToolRow({ item, theme }: PluginTimelineItemProps<LiveToolData>) {
  const data = item.data;
  const running = data.status === "running";
  // Native paints these details two ways: `write` / `sub_agent` are full-bleed
  // `surface1`, while `fetch` / `plain_text` / `unknown` sit in the inset box.
  const inset = data.inset === true;
  const { expanded, toggle } = useToggle(useAutoCollapse(running));

  const summary = useMemo(
    () => (data.summaryIsPath ? shortenPath(data.summary) : data.summary),
    [data.summary, data.summaryIsPath],
  );

  const styles = useMemo(
    () => ({
      code: {
        fontFamily: MONO_FONT,
        fontSize: CODE_FONT_SIZE,
        lineHeight: CODE_LINE_HEIGHT,
        color: theme.colors.foreground,
      },
      sectionTitle: {
        color: theme.colors.foregroundMuted,
      },
    }),
    [theme],
  );

  // Sections in one monospace block, each with its muted heading — native's
  // `unknown` detail does the same with an Input / Output header per group.
  const body = useMemo(() => {
    if (data.sections.length === 0) return null;
    return (
      <Text style={styles.code} selectable>
        {data.sections.map((section) => (
          <Text key={section.title ?? section.text.slice(0, 32)}>
            {section.title === undefined ? null : (
              <Text style={styles.sectionTitle}>
                {section.title}
                {"\n"}
              </Text>
            )}
            {section.text}
            {section === data.sections[data.sections.length - 1] ? null : "\n\n"}
          </Text>
        ))}
      </Text>
    );
  }, [data.sections, styles]);

  const renderDetails = useCallback(
    () => (
      <DetailBlock
        theme={theme}
        inset={inset}
        meta={data.meta}
        body={body}
        placeholder={running ? "Waiting for the tool…" : "(no details)"}
        footnote={data.truncated ? "… later lines dropped to keep the row small" : undefined}
        errorText={data.errorText}
      />
    ),
    [theme, data.meta, body, data.truncated, data.errorText, running, inset],
  );

  return (
    <TimelineBadge
      theme={theme}
      icon={data.icon}
      label={data.label}
      summary={summary}
      summaryLines={1}
      failed={data.status === "failed"}
      canceled={data.status === "canceled"}
      active={expanded}
      loading={running}
      insetDetail={inset}
      expanded={expanded}
      onToggle={toggle}
      renderDetails={renderDetails}
    />
  );
}
