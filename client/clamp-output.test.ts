import { describe, expect, it } from "vitest";
import { keepOutputHead, keepOutputTail } from "./clamp-output";

describe("keepOutputHead", () => {
  it("leaves a short text alone", () => {
    expect(keepOutputHead("a\nb\n")).toEqual({ output: "a\nb\n", truncated: false });
  });

  it("keeps the first lines of a long text", () => {
    const lines = Array.from({ length: 5_000 }, (_, index) => `line ${index}`);
    const { output, truncated } = keepOutputHead(lines.join("\n"));
    expect(truncated).toBe(true);
    expect(output.split("\n")).toHaveLength(2_000);
    expect(output.startsWith("line 0\n")).toBe(true);
    expect(output.endsWith("line 1999")).toBe(true);
  });

  it("drops the half line left by a byte clamp", () => {
    const { output, truncated } = keepOutputHead(`complete head\n${"x".repeat(60_000)}`);
    expect(truncated).toBe(true);
    expect(output).toBe("complete head");
  });
});

describe("keepOutputTail", () => {
  it("keeps the last lines of a long text", () => {
    const lines = Array.from({ length: 5_000 }, (_, index) => `line ${index}`);
    const { output, truncated } = keepOutputTail(lines.join("\n"));
    expect(truncated).toBe(true);
    expect(output.split("\n")).toHaveLength(2_000);
    expect(output.endsWith("line 4999")).toBe(true);
  });
});
