/**
 * Strips the agent's working directory from an absolute path, so a row header
 * shows `client/live-read-row.tsx` instead of the whole path — Paseo's native
 * tool-call summaries do the same (`stripCwdPrefix`).
 */
export function displayPath(filePath: string, cwd?: string): string {
  if (!cwd) return filePath;
  const root = cwd.endsWith("/") ? cwd.slice(0, -1) : cwd;
  // A root of `/` would turn every absolute path into a relative one.
  if (root === "" || root === "/") return filePath;
  if (filePath === root) return ".";
  return filePath.startsWith(`${root}/`) ? filePath.slice(root.length + 1) : filePath;
}
