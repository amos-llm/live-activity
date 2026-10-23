import type { BgSessionTarget } from "../shared/bg-tasks";

/**
 * React Query keys for one pi session's background tasks. The list is cached
 * per session, so the popover and the task detail tab (which both poll it)
 * always share one entry.
 */
export function bgListQueryKey(target: BgSessionTarget | null) {
  return ["live-activity", "list", target?.sessionId ?? null] as const;
}

export function bgLogQueryKey(target: BgSessionTarget | null, taskId: string) {
  return ["live-activity", "log", target?.sessionId ?? null, taskId] as const;
}
