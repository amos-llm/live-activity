import { useEffect, useState } from "react";

/**
 * A clock that re-renders the caller on a fixed interval.
 *
 * Elapsed-time labels must not be derived from polled query data: react-query's
 * structural sharing hands back the previous `data` reference when a running
 * task's json has not changed between two polls, so `Date.now()` evaluated
 * during render freezes with it (and would only step in 5s increments anyway).
 * This hook keeps its own ticking state, and stops the timer when `enabled` is
 * false (no running task) so idle panels stay quiet. The first tick lands one
 * interval after enabling, which is fine: the label is only read for tasks that
 * are still running, and it starts from the render-time value.
 */
export function useNow(intervalMs: number, enabled: boolean): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [enabled, intervalMs]);

  return now;
}
