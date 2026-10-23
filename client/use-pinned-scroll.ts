import { useCallback, useRef } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent, ScrollView } from "react-native";

/**
 * How close to the bottom (in px) still counts as "following the newest
 * content". A wheel notch or a short drag overshoots the exact bottom, and the
 * detail block has 12px of bottom padding, so a small tolerance keeps the row
 * pinned while the user is effectively still at the bottom.
 */
export const PIN_TOLERANCE_PX = 16;

/**
 * Whether a scroll position is at (or within `tolerance` of) the end of its
 * content. Pure so the rule can be tested without a renderer.
 */
export function isPinnedToBottom(
  offsetY: number,
  contentHeight: number,
  viewportHeight: number,
  tolerance = PIN_TOLERANCE_PX,
): boolean {
  const distanceFromEnd = contentHeight - viewportHeight - offsetY;
  return distanceFromEnd <= tolerance;
}

/**
 * Auto-follow for a streaming detail block, without fighting the user for the
 * scroll position.
 *
 * The block follows the newest content only while the user is at the bottom. As
 * soon as the user scrolls up (as soon as a scroll event leaves the tolerance
 * band) the row stops moving on its own: new chunks append below and the view
 * stays exactly where the reader left it. Scrolling back down to the bottom
 * resumes the follow, so the row never needs a second control for it.
 *
 * The pin state is a ref, not state: a scroll event must not re-render a row
 * that is being streamed into.
 */
export function usePinnedScroll() {
  const ref = useRef<ScrollView>(null);
  const pinned = useRef(true);

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    pinned.current = isPinnedToBottom(
      contentOffset.y,
      contentSize.height,
      layoutMeasurement.height,
    );
  }, []);

  /** Jump to the newest content, but only when the user is still at the bottom. */
  const follow = useCallback(() => {
    if (!pinned.current) return;
    ref.current?.scrollToEnd({ animated: false });
  }, []);

  /** Re-arm the follow, e.g. when the block is (re)opened by the user. */
  const reset = useCallback(() => {
    pinned.current = true;
  }, []);

  return { ref, follow, reset, onScroll };
}
