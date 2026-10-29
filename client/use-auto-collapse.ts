import { useEffect, useRef, useState } from "react";

/** Grace period after a row's content stops growing before it auto-collapses. */
export const AUTO_COLLAPSE_DELAY_MS = 5000;

/**
 * Open while `active` (a command is running, a thought is streaming) and for a
 * grace period after it ends, so the final content stays readable before the
 * row folds itself. A row that mounts already finished never opens.
 *
 * Shell and thinking rows share this: both expand while their content grows and
 * collapse once it stops.
 */
export function useAutoCollapse(active: boolean, delayMs = AUTO_COLLAPSE_DELAY_MS): boolean {
  // The previous-activity ref is read during the effect on purpose: React's
  // official "previous props" pattern, so the active→idle transition is visible.
  const prevActive = useRef(active);
  const [holdingOpen, setHoldingOpen] = useState(false);
  const [graceOver, setGraceOver] = useState(false);
  /* The synchronous setStates below implement the active→idle transition
     (React's official "previous props" pattern); each fires at most once per
     status change, so the set-state-in-effect warning is a false positive. */
  /* eslint-disable react/set-state-in-effect */
  useEffect(() => {
    const was = prevActive.current;
    prevActive.current = active;
    if (active) {
      setGraceOver(false);
      if (!holdingOpen) setHoldingOpen(true);
    } else if (was && !graceOver) {
      const timer = setTimeout(() => {
        setGraceOver(true);
        setHoldingOpen(false);
      }, delayMs);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [active, delayMs, holdingOpen, graceOver]);
  /* eslint-enable react/set-state-in-effect */
  return active || holdingOpen;
}

/**
 * Whether a row opens itself because its content is still arriving.
 *
 * Rows expand themselves while they are live — that is the point of this
 * plugin — but on a compact layout expanding means opening the host's bottom
 * sheet, and a sheet that opens by itself would cover the timeline the reader is
 * watching. Native rows never open by themselves either, so on a phone the
 * reader is the one who opens the sheet; the row only reports that it is live
 * (`loading`) until they do.
 */
export function useAutoOpen(active: boolean, compact: boolean): boolean {
  return useAutoCollapse(active && !compact);
}
