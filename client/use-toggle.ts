import { useState } from "react";

/**
 * Row-local expansion state. The row follows `autoOpen` until the user taps it,
 * after which it keeps the user's choice for as long as the row is mounted.
 */
export function useToggle(autoOpen: boolean) {
  const [override, setOverride] = useState<boolean | null>(null);
  const expanded = override ?? autoOpen;
  return { expanded, toggle: () => setOverride(!expanded) };
}
