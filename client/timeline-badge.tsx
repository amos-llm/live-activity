import type { PluginTheme } from "@getpaseo/plugin";
import { Icon } from "@getpaseo/plugin/client/react-native";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Platform, Pressable, Text, View } from "react-native";

/**
 * Token values copied from Paseo's own theme (`packages/app/src/styles/theme.ts`)
 * and its native tool-call row (`packages/app/src/components/message.tsx`,
 * `ExpandableBadge`). Plugins cannot read `theme.spacing` / `theme.fontSize`, so
 * the numbers live here.
 */
const SPACING = { 1: 4, 2: 8, 3: 12 } as const;
const RADIUS = { lg: 8 } as const;
const FONT_SIZE = { base: 14 } as const;
/** The timeline row insets its content by 13px; the native badge bleeds back out. */
const TIMELINE_HORIZONTAL_INSET = 13;
/** Padding inside a detail block, matching `code-insets.ts` (`spacing[3]`). */
const DETAIL_PADDING = SPACING[3];

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

export const DETAIL_CONTENT_STYLE = { padding: DETAIL_PADDING } as const;

const ROTATE_OPEN = { transform: [{ rotate: "90deg" }] } as const;
const ROTATE_CLOSED = { transform: [{ rotate: "0deg" }] } as const;

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
  /** Highlights the label and summary, e.g. while running. */
  active: boolean;
  expanded: boolean;
  onToggle: () => void;
  /** Detail block content, rendered only while expanded. */
  children?: ReactNode;
}

/**
 * Paseo's native expandable tool-call badge: borderless while collapsed, and a
 * header attached to a bordered detail block once expanded.
 */
export function TimelineBadge({
  theme,
  icon,
  label,
  summary,
  summaryLines,
  failed = false,
  canceled = false,
  active,
  expanded,
  onToggle,
  children,
}: TimelineBadgeProps) {
  const [hovered, setHovered] = useState(false);
  const onHoverIn = useCallback(() => setHovered(true), []);
  const onHoverOut = useCallback(() => setHovered(false), []);

  const styles = useMemo(
    () => ({
      container: { marginHorizontal: -TIMELINE_HORIZONTAL_INSET },
      pressable: {
        borderRadius: RADIUS.lg,
        borderWidth: 1,
        borderColor: "transparent",
        paddingHorizontal: SPACING[2],
        paddingVertical: SPACING[1],
        overflow: "hidden" as const,
      },
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
      label: {
        flexShrink: 0,
        fontFamily: UI_FONT,
        fontSize: FONT_SIZE.base,
        color: theme.colors.foregroundMuted,
      },
      labelActive: { color: theme.colors.foreground },
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
      },
    }),
    [theme],
  );

  const pressableStyle = useMemo(
    () => [styles.pressable, expanded ? styles.pressableExpanded : null],
    [styles, expanded],
  );
  const labelStyle = useMemo(
    () => [styles.label, active ? styles.labelActive : null],
    [styles, active],
  );
  const summaryStyle = useMemo(
    () => [styles.summary, active ? styles.summaryActive : null],
    [styles, active],
  );
  // Native behavior: the tool icon while idle, a rotating chevron on hover or
  // while expanded.
  const showChevron = hovered || expanded;
  const iconColor = active ? theme.colors.foreground : theme.colors.foregroundMuted;

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={expanded ? `Collapse ${label}` : `Expand ${label}`}
        onPress={onToggle}
        onHoverIn={onHoverIn}
        onHoverOut={onHoverOut}
        style={pressableStyle}
      >
        <View style={styles.headerRow}>
          <View style={styles.iconBadge}>
            {failed ? (
              <Icon name="TriangleAlert" size={12} color={theme.colors.statusDanger} />
            ) : canceled ? (
              <Icon name="Ban" size={12} color={theme.colors.foregroundMuted} />
            ) : showChevron ? (
              <View style={expanded ? ROTATE_OPEN : ROTATE_CLOSED}>
                <Icon name="ChevronRight" size={12} color={theme.colors.foreground} />
              </View>
            ) : (
              <Icon name={icon} size={12} color={iconColor} />
            )}
          </View>
          <Text style={labelStyle}>{label}</Text>
          <Text style={summaryStyle} numberOfLines={summaryLines}>
            {summary}
          </Text>
        </View>
      </Pressable>

      {expanded && children ? <View style={styles.detailWrapper}>{children}</View> : null}
    </View>
  );
}
