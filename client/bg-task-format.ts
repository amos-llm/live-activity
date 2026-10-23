export function fmtTime(ms: number): string {
  if (!ms) return "-";
  return new Date(ms).toLocaleTimeString();
}

export function fmtDuration(start: number, end: number | null): string {
  if (!start) return "-";
  const stop = end ?? Date.now();
  const s = Math.max(0, Math.round((stop - start) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m${s % 60}s`;
}
