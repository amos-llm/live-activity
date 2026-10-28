/**
 * Output kept in a timeline item. Providers truncate themselves (pi keeps
 * 2000 lines / 50 KB), but not all of them do, and the whole item is
 * serialized on every streaming update, so the transformers clamp here.
 *
 * A command's output is history that ends at its last line, so a shell row
 * keeps the **tail**. A file read, a patch and a result list start where the
 * provider started them — and are read from the top — so those rows keep the
 * **head**.
 */
export const MAX_OUTPUT_CHARS = 50 * 1024;
export const MAX_OUTPUT_LINES = 2_000;

/** Keeps the beginning of a long text, dropping a half line at the cut. */
export function keepOutputHead(text: string): { output: string; truncated: boolean } {
  let output = text;
  let truncated = false;

  if (output.length > MAX_OUTPUT_CHARS) {
    output = output.slice(0, MAX_OUTPUT_CHARS);
    // The last line is almost certainly cut in half; drop it.
    const lastBreak = output.lastIndexOf("\n");
    if (lastBreak !== -1) output = output.slice(0, lastBreak);
    truncated = true;
  }

  let lines = 1;
  for (let index = 0; index < output.length; index += 1) {
    if (output.charCodeAt(index) !== 10) continue;
    lines += 1;
    if (lines > MAX_OUTPUT_LINES) return { output: output.slice(0, index), truncated: true };
  }

  return { output, truncated };
}

/**
 * Keeps the end of a long text. Counting runs backwards on purpose: an output
 * from a provider that does not truncate can be megabytes, and splitting it
 * into an array to count lines would allocate all of it first.
 */
export function keepOutputTail(text: string): { output: string; truncated: boolean } {
  let output = text;
  let truncated = false;

  if (output.length > MAX_OUTPUT_CHARS) {
    output = output.slice(output.length - MAX_OUTPUT_CHARS);
    // The first line is almost certainly cut in half; drop it.
    const firstBreak = output.indexOf("\n");
    if (firstBreak !== -1) output = output.slice(firstBreak + 1);
    truncated = true;
  }

  let lines = 1;
  for (let index = output.length - 1; index >= 0; index -= 1) {
    if (output.charCodeAt(index) !== 10) continue;
    lines += 1;
    if (lines > MAX_OUTPUT_LINES) return { output: output.slice(index + 1), truncated: true };
  }

  return { output, truncated };
}
