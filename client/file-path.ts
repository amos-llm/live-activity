/**
 * Strips the agent's working directory from an absolute path, so a row header
 * shows `client/live-read-row.tsx` instead of the whole path — Paseo's native
 * tool-call summaries do the same (`stripCwdPrefix`).
 *
 * Not every provider puts `cwd` on the tool-call item (pi does not), so this is
 * often a no-op and `shortenPath` finishes the job.
 */
export function displayPath(filePath: string, cwd?: string): string {
  if (!cwd) return filePath;
  const root = cwd.endsWith("/") ? cwd.slice(0, -1) : cwd;
  // A root of `/` would turn every absolute path into a relative one.
  if (root === "" || root === "/") return filePath;
  if (filePath === root) return ".";
  return filePath.startsWith(`${root}/`) ? filePath.slice(root.length + 1) : filePath;
}

/** Roughly what fits beside the row label before the badge starts ellipsizing. */
export const MAX_SUMMARY_PATH_CHARS = 44;

/**
 * Shortens a path from the **front**, so the file name survives. Native rows put
 * the summary on one line and ellipsize its end, which on an absolute path cuts
 * off exactly the part that identifies the file (`/home/ubuntu/live-activity/cl…`).
 * The full path stays in the detail block.
 */
export function shortenPath(filePath: string, max = MAX_SUMMARY_PATH_CHARS): string {
  if (max <= 0 || filePath.length <= max) return filePath;

  const segments = filePath.split("/").filter((segment) => segment !== "");
  const last = segments[segments.length - 1] ?? filePath;
  // One segment that is already too long: keep its end, which is the file name.
  if (last.length > max - 1) return `…${last.slice(last.length - (max - 1))}`;

  let tail = last;
  for (let index = segments.length - 2; index >= 0; index -= 1) {
    const candidate = `${segments[index]}/${tail}`;
    if (candidate.length > max - 1) break;
    tail = candidate;
  }
  return `…/${tail}`;
}
