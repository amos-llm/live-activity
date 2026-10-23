import { describe, expect, it } from "vitest";
import { isPinnedToBottom, PIN_TOLERANCE_PX } from "./use-pinned-scroll";

describe("isPinnedToBottom", () => {
  it("is pinned when the content ends exactly at the viewport edge", () => {
    expect(isPinnedToBottom(600, 1000, 400)).toBe(true);
  });

  it("is pinned while the reader is still effectively at the bottom", () => {
    expect(isPinnedToBottom(600 - PIN_TOLERANCE_PX, 1000, 400)).toBe(true);
  });

  it("unpins as soon as the reader scrolls up past the tolerance", () => {
    expect(isPinnedToBottom(600 - PIN_TOLERANCE_PX - 1, 1000, 400)).toBe(false);
    expect(isPinnedToBottom(0, 1000, 400)).toBe(false);
  });

  it("is pinned when the content is shorter than the viewport", () => {
    expect(isPinnedToBottom(0, 120, 400)).toBe(true);
  });

  it("honours an explicit tolerance", () => {
    expect(isPinnedToBottom(590, 1000, 400, 10)).toBe(true);
    expect(isPinnedToBottom(589, 1000, 400, 10)).toBe(false);
  });
});
