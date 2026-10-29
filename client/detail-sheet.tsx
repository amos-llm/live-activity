import type { PluginTheme } from "@getpaseo/plugin";
import { Icon, Modal } from "@getpaseo/plugin/client/ui";
import { memo, useCallback, useMemo, type ReactNode } from "react";

/**
 * The body is one detail block that fills the sheet, so the host's default
 * sheet padding is dropped and the block brings its own.
 */
const SHEET_CONTENT_STYLE = { flex: 1, padding: 0 } as const;
/** Native tool sheets put the tool glyph next to the title at this size. */
const SHEET_ICON_SIZE = 20;

interface DetailSheetProps {
  theme: PluginTheme;
  /** Lucide icon shown beside the title. */
  icon: string;
  /** Sheet title: the same word the row's header carries. */
  title: string;
  open: boolean;
  /** Called when the reader dismisses the sheet (close button, swipe, backdrop). */
  onClose: () => void;
  /** The detail block. Built only while `open`, so a closed row costs nothing. */
  children: ReactNode;
}

/**
 * A compact-layout row's details in the host's bottom sheet.
 *
 * Native Paseo does not expand tool-call rows in place on a phone: the row stays
 * a badge and a tap opens the detail in a bottom sheet (`ToolCallSheetModal`),
 * with the tool name and a close button in the header. A plugin cannot reach
 * that sheet, but the host hands plugins the same `Modal` the app's own sheets
 * are built on, so the row gets the native surface instead of an inline block.
 *
 * Memoized like the rest of the row: a streaming row re-renders on every update.
 */
export const DetailSheet = memo(function DetailSheet({
  theme,
  icon,
  title,
  open,
  onClose,
  children,
}: DetailSheetProps) {
  const headerIcon = useMemo(
    () => <Icon name={icon} size={SHEET_ICON_SIZE} color={theme.colors.foreground} />,
    [icon, theme],
  );
  const onOpenChange = useCallback(
    (next: boolean) => {
      if (!next) onClose();
    },
    [onClose],
  );

  return (
    <Modal title={title} icon={headerIcon} open={open} onOpenChange={onOpenChange}>
      <Modal.Content scrollable={false} contentContainerStyle={SHEET_CONTENT_STYLE}>
        {children}
      </Modal.Content>
    </Modal>
  );
});
