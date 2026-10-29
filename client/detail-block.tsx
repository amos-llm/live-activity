import type { PluginTheme } from "@getpaseo/plugin";
import { memo, useMemo, type ReactNode } from "react";
import { ScrollView, Text, View } from "react-native";
import {
  CODE_LINE_STYLE,
  DETAIL_HORIZONTAL_CONTENT_STYLE,
  DETAIL_TEXT_STYLE,
  DETAIL_VERTICAL_CONTENT_STYLE,
  MONO_FONT,
} from "./timeline-badge";

/** Native detail blocks cap their scroll area at 400px, on every layout. */
const DETAIL_MAX_HEIGHT = 400;
const CODE_FONT_SIZE = 12;
const CODE_LINE_HEIGHT = 18;

export interface DetailBlockProps {
  theme: PluginTheme;
  /** Muted line above the content: the absolute path, the range, the counts. */
  meta?: string;
  /** Fixed line-number column; one entry per line of `body`. */
  gutter?: string;
  /** The content. `null` shows the placeholder instead. */
  body: ReactNode | null;
  placeholder?: string;
  /** Muted line under the content, e.g. what the transformer dropped. */
  footnote?: string;
  errorText?: string;
}

/**
 * The detail block shared by the read / edit / search rows.
 *
 * It is the native one: a capped vertical scroll around a horizontal scroll for
 * unwrapped lines, a muted meta line on top, and the row's own facts (dropped
 * content, the failure message) underneath. The gutter sits outside the
 * horizontal scroll, so line numbers stay put while a long line scrolls — both
 * columns run at the same line height, and nothing wraps.
 *
 * Memoized, because a streaming row re-renders on every update.
 */
export const DetailBlock = memo(function DetailBlock({
  theme,
  meta,
  gutter,
  body,
  placeholder,
  footnote,
  errorText,
}: DetailBlockProps) {
  const styles = useMemo(
    () => ({
      scroll: { maxHeight: DETAIL_MAX_HEIGHT },
      row: {
        flexDirection: "row" as const,
        alignItems: "flex-start" as const,
      },
      gutter: {
        paddingLeft: 12,
        paddingTop: 12,
        fontFamily: MONO_FONT,
        fontSize: CODE_FONT_SIZE,
        lineHeight: CODE_LINE_HEIGHT,
        color: theme.colors.foregroundMuted,
        textAlign: "right" as const,
      },
      content: { flexShrink: 1, minWidth: 0 },
      meta: [
        DETAIL_TEXT_STYLE,
        {
          fontFamily: MONO_FONT,
          fontSize: CODE_FONT_SIZE,
          lineHeight: CODE_LINE_HEIGHT,
          color: theme.colors.foregroundMuted,
        },
      ],
      placeholder: [
        DETAIL_TEXT_STYLE,
        {
          fontFamily: MONO_FONT,
          fontSize: CODE_FONT_SIZE,
          lineHeight: CODE_LINE_HEIGHT,
          color: theme.colors.foregroundMuted,
        },
      ],
      error: [
        DETAIL_TEXT_STYLE,
        {
          fontFamily: MONO_FONT,
          fontSize: CODE_FONT_SIZE,
          lineHeight: CODE_LINE_HEIGHT,
          color: theme.colors.statusDanger,
        },
      ],
    }),
    [theme],
  );

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={DETAIL_VERTICAL_CONTENT_STYLE}
      nestedScrollEnabled
      showsVerticalScrollIndicator
    >
      {meta ? (
        <Text style={styles.meta} selectable>
          {meta}
        </Text>
      ) : null}
      {body === null ? (
        <Text style={styles.placeholder}>{placeholder ?? ""}</Text>
      ) : (
        <View style={styles.row}>
          {gutter ? <Text style={styles.gutter}>{gutter}</Text> : null}
          <ScrollView
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator
            style={styles.content}
            contentContainerStyle={DETAIL_HORIZONTAL_CONTENT_STYLE}
          >
            <View style={CODE_LINE_STYLE}>{body}</View>
          </ScrollView>
        </View>
      )}
      {footnote ? <Text style={styles.meta}>{footnote}</Text> : null}
      {errorText ? <Text style={styles.error}>{errorText}</Text> : null}
    </ScrollView>
  );
});
