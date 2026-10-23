import { describe, expect, it } from "vitest";
import { pillLabel } from "./bg-task-format";

describe("pillLabel", () => {
  it("keeps the plain label while nothing runs", () => {
    expect(pillLabel(0)).toBe("Bg tasks");
  });

  it("carries the running count on the pill", () => {
    expect(pillLabel(1)).toBe("Bg tasks 1");
    expect(pillLabel(7)).toBe("Bg tasks 7");
  });
});
