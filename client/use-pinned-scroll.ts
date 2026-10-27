import { useCallback, useEffect, useRef } from "react";
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

/** One scroll position, plus where the previous event left the reader. */
export interface ScrollSample {
  /** Current scroll offset of the detail block. */
  offsetY: number;
  /** Height of the content inside the block. */
  contentHeight: number;
  /** Height of the window onto that content. */
  viewportHeight: number;
  /** Offset reported by the previous scroll event. */
  previousOffsetY: number;
}

/**
 * What a scroll position means for the follow, given whether the row was
 * following before it.
 *
 * A scroll event is not proof that the reader moved. The block is measured and
 * scrolled a frame or more after the text was appended, and the platform
 * replays a scroll event once scrolling goes idle (react-native-web re-reads
 * the node 100ms later), so an event routinely reports a content size that has
 * already grown past the offset the row itself just scrolled to. Treating that
 * gap as "the reader left the bottom" froze the row for the rest of the
 * stream, because nothing ever put the pin back.
 *
 * Only an upward move is the reader, so only an upward move stops the follow:
 *
 * - at the bottom: follow, which also re-arms a row that stopped earlier;
 * - moved up since the previous event: stop;
 * - anything else (the row's own scroll landing short while the block grows):
 *   leave the state alone.
 */
export function resolvePinned(
  pinned: boolean,
  sample: ScrollSample,
  tolerance = PIN_TOLERANCE_PX,
): boolean {
  const { offsetY, contentHeight, viewportHeight, previousOffsetY } = sample;
  if (isPinnedToBottom(offsetY, contentHeight, viewportHeight, tolerance)) return true;
  return offsetY < previousOffsetY - tolerance ? false : pinned;
}

/**
 * Auto-follow for a streaming detail block, without fighting the user for the
 * scroll position.
 *
 * The block follows the newest content only while the user is at the bottom. As
 * soon as the user scrolls up (as soon as a scroll event shows an offset above
 * the previous one, outside the tolerance band) the row stops moving on its
 * own: new chunks append below and the view stays exactly where the reader left
 * it. Scrolling back down to the bottom resumes the follow, so the row never
 * needs a second control for it.
 *
 * The pin state is a ref, not state: a scroll event must not re-render a row
 * that is being streamed into.
 */
export function usePinnedScroll() {
  const ref = useRef<ScrollView>(null);
  const pinned = useRef(true);
  const lastOffset = useRef(0);
  const frame = useRef<number | null>(null);

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const sample = {
      offsetY: contentOffset.y,
      contentHeight: contentSize.height,
      viewportHeight: layoutMeasurement.height,
      previousOffsetY: lastOffset.current,
    };
    pinned.current = resolvePinned(pinned.current, sample);
    lastOffset.current = sample.offsetY;
  }, []);

  /**
   * Jump to the newest content, but only when the user is still at the bottom.
   *
   * Twice: the content size change is reported before the new text is fully
   * laid out on web, so the first scroll can land a line short. The second pass
   * one frame later catches up with the final height — Paseo's own detail
   * blocks scroll the same way.
   */
  const follow = useCallback(() => {
    if (!pinned.current) return;
    const scrollToEnd = () => ref.current?.scrollToEnd({ animated: false });
    scrollToEnd();
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      if (pinned.current) scrollToEnd();
    });
  }, []);

  /** Re-arm the follow, e.g. when the block is (re)opened by the user. */
  const reset = useCallback(() => {
    pinned.current = true;
    lastOffset.current = 0;
  }, []);

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
    },
    [],
  );

  return { ref, follow, reset, onScroll };
}
