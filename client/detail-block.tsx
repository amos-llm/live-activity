import type { PluginTheme } from "@getpaseo/plugin";
import { memo, useMemo, type ReactNode } from "react";
import { ScrollView, Text, View } from "react-native";
import {
  CODE_LINE_STYLE,
  DETAIL_HORIZONTAL_CONTENT_STYLE,
  DETAIL_INSET_BORDER,
  DETAIL_INSET_CODE_LINE_STYLE,
  DETAIL_INSET_CONTENT_STYLE,
  DETAIL_INSET_TEXT_STYLE,
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
  /**
   * Native's inset code surface: the read / search / fetch / plain-text /
   * unknown blocks sit in a bordered `surface2` box (`scrollArea`), while shell
   * / edit / write / sub-agent are full-bleed `surface1` and pass `false`.
   */
  inset?: boolean;
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
  inset = false,
}: DetailBlockProps) {
  const styles = useMemo(() => {
    const mono = {
      fontFamily: MONO_FONT,
      fontSize: CODE_FONT_SIZE,
      lineHeight: CODE_LINE_HEIGHT,
    };
    // An inset block carries its horizontal padding on the scroll content, so
    // its lines only add the vertical one the full-bleed block already has.
    const textStyle = inset ? DETAIL_INSET_TEXT_STYLE : DETAIL_TEXT_STYLE;
    return {
      scroll: [
        { maxHeight: DETAIL_MAX_HEIGHT },
        inset
          ? {
              ...DETAIL_INSET_BORDER,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surface2,
              overflow: "hidden" as const,
            }
          : null,
      ],
      verticalContent: inset ? DETAIL_INSET_CONTENT_STYLE : DETAIL_VERTICAL_CONTENT_STYLE,
      horizontalContent: inset ? undefined : DETAIL_HORIZONTAL_CONTENT_STYLE,
      codeLine: inset ? DETAIL_INSET_CODE_LINE_STYLE : CODE_LINE_STYLE,
      row: {
        flexDirection: "row" as const,
        alignItems: "flex-start" as const,
      },
      gutter: {
        // Full-bleed: the gutter matches the code line's own 12px padding.
        // Inset: the content container already pads, so it only lines up.
        paddingLeft: inset ? 0 : 12,
        paddingTop: inset ? 0 : 12,
        ...mono,
        color: theme.colors.foregroundMuted,
        textAlign: "right" as const,
      },
      content: { flexShrink: 1, minWidth: 0 },
      meta: [textStyle, { ...mono, color: theme.colors.foregroundMuted }],
      placeholder: [textStyle, { ...mono, color: theme.colors.foregroundMuted }],
      error: [textStyle, { ...mono, color: theme.colors.statusDanger }],
    };
  }, [theme, inset]);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.verticalContent}
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
            contentContainerStyle={styles.horizontalContent}
          >
            <View style={styles.codeLine}>{body}</View>
          </ScrollView>
        </View>
      )}
      {footnote ? <Text style={styles.meta}>{footnote}</Text> : null}
      {errorText ? <Text style={styles.error}>{errorText}</Text> : null}
    </ScrollView>
  );
});
