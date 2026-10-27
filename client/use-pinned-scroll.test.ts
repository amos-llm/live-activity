import { describe, expect, it } from "vitest";
import { isPinnedToBottom, PIN_TOLERANCE_PX, resolvePinned } from "./use-pinned-scroll";

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

describe("resolvePinned", () => {
  const at = (offsetY: number, contentHeight: number, previousOffsetY: number) => ({
    offsetY,
    contentHeight,
    viewportHeight: 400,
    previousOffsetY,
  });

  it("re-arms the follow as soon as the reader is back at the bottom", () => {
    expect(resolvePinned(false, at(600, 1000, 300))).toBe(true);
  });

  it("stops the follow when the reader moves up", () => {
    expect(resolvePinned(true, at(500, 1000, 600))).toBe(false);
  });

  it("keeps following when its own scroll lands short because the block grew", () => {
    // The row scrolled to 600; the event reports the same offset with content
    // that grew in the meantime, and the platform replays it 100ms idle.
    expect(resolvePinned(true, at(600, 1200, 600))).toBe(true);
  });

  it("keeps following when the block grew faster than the follow could scroll", () => {
    expect(resolvePinned(true, at(620, 1200, 600))).toBe(true);
  });

  it("does not re-arm a row the reader left, while the stream keeps growing", () => {
    expect(resolvePinned(false, at(500, 1200, 500))).toBe(false);
    expect(resolvePinned(false, at(560, 1200, 500))).toBe(false);
  });

  it("ignores an upward move that stays inside the tolerance band", () => {
    expect(resolvePinned(true, at(600 - PIN_TOLERANCE_PX, 1000, 600))).toBe(true);
    expect(resolvePinned(true, at(600 - PIN_TOLERANCE_PX - 1, 1000, 600))).toBe(false);
  });

  it("honours an explicit tolerance", () => {
    expect(resolvePinned(true, at(591, 1000, 600), 10)).toBe(true);
    expect(resolvePinned(true, at(589, 1000, 600), 10)).toBe(false);
  });
});
