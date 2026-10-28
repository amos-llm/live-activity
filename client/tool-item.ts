import type { LiveStatus } from "../shared/live-status";

const KNOWN_STATUSES = new Set(["running", "completed", "failed", "canceled"]);

/** Record view of an unknown JSON value, or `undefined` when it is not an object. */
export function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

export function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/**
 * Non-empty failure message from a tool call's `error`, which providers shape
 * as a string, as `{ message }`, or as an arbitrary JSON value.
 */
export function describeError(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string") return value.trim() === "" ? undefined : value;
  const message = asString(asRecord(value)?.message);
  if (message && message.trim() !== "") return message;
  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
}

/** Tool-call status, narrowed to the set the rows render. */
export function readStatus(value: unknown): LiveStatus {
  const status = asString(value);
  return status && KNOWN_STATUSES.has(status) ? (status as LiveStatus) : "unknown";
}

/**
 * The agent's working directory, which Paseo puts on the tool-call item itself
 * (`cwd`) rather than inside `detail`.
 */
export function readItemCwd(record: Record<string, unknown>): string | undefined {
  return asString(record.cwd);
}
