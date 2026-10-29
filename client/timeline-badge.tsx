import type { PluginTheme } from "@getpaseo/plugin";
import { Icon } from "@getpaseo/plugin/client/react-native";
import { memo, useCallback, useMemo, useState, type ReactNode } from "react";
import { Platform, Pressable, Text, View } from "react-native";

/**
 * Token values copied from Paseo's own theme (`packages/app/src/styles/theme.ts`)
 * and its native tool-call row (`packages/app/src/components/message.tsx`,
 * `ExpandableBadge`). Plugins cannot read `theme.spacing` / `theme.fontSize`, so
 * the numbers live here.
 */
const SPACING = { 1: 4, 2: 8, 3: 12, 4: 16 } as const;
const RADIUS = { lg: 8 } as const;
const FONT_SIZE = { base: 14 } as const;
/** The timeline row insets its content by 13px; the native badge bleeds back out. */
const TIMELINE_HORIZONTAL_INSET = 13;
/** Padding inside a code block, matching `code-insets.ts` (`spacing[3]`). */
const DETAIL_PADDING = SPACING[3];
/** Extra inset at the scrollable edge, matching `code-insets.ts` (`spacing[4]`). */
const DETAIL_EDGE_INSET = SPACING[4];

export const UI_FONT = Platform.select({
  ios: "system-ui",
  default: "normal",
  web: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
});

export const MONO_FONT = Platform.select({
  ios: "ui-monospace",
  default: "monospace",
  web: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
});

/*
 * Detail blocks follow Paseo's native layout: an outer vertical scroll (capped
 * by the row), an inner horizontal scroll for unwrapped code lines, and the
 * padding carried by the code block itself (`codeVerticalContent`,
 * `codeHorizontalContent`, `codeLine` in `tool-call-details.tsx`).
 */
export const DETAIL_VERTICAL_CONTENT_STYLE = { paddingBottom: DETAIL_PADDING } as const;
export const DETAIL_HORIZONTAL_CONTENT_STYLE = { paddingRight: DETAIL_EDGE_INSET } as const;
export const CODE_LINE_STYLE = { minWidth: "100%" as const, padding: DETAIL_PADDING } as const;
export const DETAIL_TEXT_STYLE = {
  paddingHorizontal: DETAIL_PADDING,
  paddingVertical: SPACING[1],
} as const;

const ROTATE_CLOSED = { transform: [{ scale: 1.3 }] } as const;
const ROTATE_OPEN = { transform: [{ scale: 1.3 }, { rotate: "90deg" }] } as const;

interface TimelineBadgeProps {
  theme: PluginTheme;
  /** Lucide icon shown in the leading slot while idle. */
  icon: string;
  label: string;
  /** Row summary. Wraps by default; `summaryLines` ellipsizes it instead. */
  summary: string;
  summaryLines?: number;
  /** Swaps the leading icon for a destructive alert. */
  failed?: boolean;
  /** Swaps the leading icon for a canceled marker. */
  canceled?: boolean;
  /** Highlights the label and summary, e.g. while expanded or hovered. */
  active: boolean;
  /** Dims the label the way native rows do while a call is still in flight. */
  loading?: boolean;
  expanded: boolean;
  onToggle: () => void;
  /** Detail block content, built only while expanded. */
  renderDetails?: () => ReactNode;
}

/**
 * Paseo's native expandable tool-call badge: borderless while collapsed, and a
 * header attached to a bordered detail block once expanded.
 *
 * Memoized like the native badge. The detail block is produced by a callback so
 * a collapsed row never builds it, which is what lets the memo skip streaming
 * re-renders whose summary did not change.
 */
export const TimelineBadge = memo(function TimelineBadge({
  theme,
  icon,
  label,
  summary,
  summaryLines,
  failed = false,
  canceled = false,
  active,
  loading = false,
  expanded,
  onToggle,
  renderDetails,
}: TimelineBadgeProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const onHoverIn = useCallback(() => setHovered(true), []);
  const onHoverOut = useCallback(() => setHovered(false), []);
  const onPressIn = useCallback(() => setPressed(true), []);
  const onPressOut = useCallback(() => setPressed(false), []);

  const styles = useMemo(
    () => ({
      container: {
        marginHorizontal: -TIMELINE_HORIZONTAL_INSET,
        marginBottom: SPACING[1],
      },
      pressable: {
        borderRadius: RADIUS.lg,
        borderWidth: 1,
        borderColor: "transparent",
        paddingHorizontal: SPACING[2],
        paddingVertical: SPACING[1],
        overflow: "hidden" as const,
      },
      pressablePressed: { opacity: 0.9 },
      pressableExpanded: {
        backgroundColor: theme.colors.surface1,
        borderColor: theme.colors.border,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
      },
      headerRow: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
      },
      iconBadge: {
        width: 22,
        height: 22,
        borderRadius: 11,
        alignItems: "center" as const,
        justifyContent: "center" as const,
        marginRight: SPACING[1],
        flexShrink: 0,
      },
      /**
       * Lucide glyphs sit inset inside their box; native nudges tool icons by
       * 1px and the 1.3x-scaled chevron by 4px so both land on the rail.
       */
      iconNudge: { marginLeft: -1 },
      chevronNudge: { marginLeft: -4 },
      labelRow: {
        flex: 1,
        flexDirection: "row" as const,
        alignItems: "center" as const,
        overflow: "hidden" as const,
      },
      label: {
        flexShrink: 0,
        fontFamily: UI_FONT,
        fontSize: FONT_SIZE.base,
        color: theme.colors.foregroundMuted,
      },
      labelActive: { color: theme.colors.foreground },
      labelLoading: { color: theme.colors.foreground, opacity: 0.72 },
      summary: {
        flexShrink: 1,
        minWidth: 0,
        marginLeft: SPACING[2],
        fontFamily: UI_FONT,
        fontSize: FONT_SIZE.base,
        color: theme.colors.foregroundMuted,
      },
      summaryActive: { color: theme.colors.foreground },
      detailWrapper: {
        borderWidth: 1,
        borderTopWidth: 0,
        borderColor: theme.colors.border,
        borderBottomLeftRadius: RADIUS.lg,
        borderBottomRightRadius: RADIUS.lg,
        backgroundColor: theme.colors.surface1,
        overflow: "hidden" as const,
        flexShrink: 1,
        minWidth: 0,
      },
    }),
    [theme],
  );

  const pressableStyle = useMemo(
    () => [
      styles.pressable,
      pressed ? styles.pressablePressed : null,
      expanded ? styles.pressableExpanded : null,
    ],
    [styles, pressed, expanded],
  );
  const labelStyle = useMemo(
    () => [styles.label, active ? styles.labelActive : null, loading ? styles.labelLoading : null],
    [styles, active, loading],
  );
  const summaryStyle = useMemo(
    () => [styles.summary, active ? styles.summaryActive : null],
    [styles, active],
  );
  const chevronStyle = useMemo(
    () => [styles.chevronNudge, expanded ? ROTATE_OPEN : ROTATE_CLOSED],
    [styles, expanded],
  );
  const accessibilityState = useMemo(() => ({ expanded }), [expanded]);

  // Native behavior: the tool icon while idle, a rotating chevron on hover or
  // while expanded.
  const showChevron = hovered || expanded;
  const iconColor = active ? theme.colors.foreground : theme.colors.foregroundMuted;
  const detailContent = expanded && renderDetails ? renderDetails() : null;

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={accessibilityState}
        accessibilityLabel={expanded ? `Collapse ${label}` : `Expand ${label}`}
        onPress={onToggle}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onHoverIn={onHoverIn}
        onHoverOut={onHoverOut}
        style={pressableStyle}
      >
        <View style={styles.headerRow}>
          <View style={styles.iconBadge}>
            {failed ? (
              <View style={styles.iconNudge}>
                <Icon name="TriangleAlert" size={12} color={theme.colors.statusDanger} />
              </View>
            ) : canceled ? (
              <View style={styles.iconNudge}>
                <Icon name="Ban" size={12} color={theme.colors.foregroundMuted} />
              </View>
            ) : showChevron ? (
              <View style={chevronStyle}>
                <Icon name="ChevronRight" size={12} color={theme.colors.foreground} />
              </View>
            ) : (
              <View style={styles.iconNudge}>
                <Icon name={icon} size={12} color={iconColor} />
              </View>
            )}
          </View>
          <View style={styles.labelRow}>
            <Text style={labelStyle}>{label}</Text>
            <Text style={summaryStyle} numberOfLines={summaryLines}>
              {summary}
            </Text>
          </View>
        </View>
      </Pressable>

      {detailContent ? <View style={styles.detailWrapper}>{detailContent}</View> : null}
    </View>
  );
});
