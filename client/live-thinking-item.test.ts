import { describe, expect, it } from "vitest";
import { liveThinkingLine, liveThinkingTimelineItem, readReasoning } from "./live-thinking-item";

describe("readReasoning", () => {
  it("reads the accumulated reasoning text", () => {
    expect(readReasoning({ type: "reasoning", text: "checking the repo" })).toBe(
      "checking the repo",
    );
  });

  it("ignores everything that is not reasoning", () => {
    expect(readReasoning({ type: "assistant_message", text: "hi" })).toBeUndefined();
    expect(readReasoning({ type: "reasoning", text: "   " })).toBeUndefined();
    expect(readReasoning({ type: "reasoning" })).toBeUndefined();
    expect(readReasoning(null)).toBeUndefined();
  });
});

describe("liveThinkingLine", () => {
  it("collapses whitespace into a single line", () => {
    expect(liveThinkingLine("first\n\nsecond   third")).toBe("first second third");
  });

  it("keeps the newest end of a long thought while it streams", () => {
    expect(liveThinkingLine("a".repeat(300) + " NEWEST", { max: 10 })).toBe("aaa NEWEST");
  });

  it("keeps the beginning of a long thought once it is complete", () => {
    expect(liveThinkingLine(`START ${"a".repeat(300)}`, { end: "start", max: 10 })).toBe(
      "START aaaa",
    );
  });
});

describe("liveThinkingTimelineItem", () => {
  it("marks the row streaming while the model is still thinking", () => {
    const result = liveThinkingTimelineItem({ type: "reasoning", text: "step one" }, "streaming");
    expect(result?.items[0]?.kind).toBe("live-thinking");
    expect(result?.items[0]?.data).toEqual({ text: "step one", streaming: true });
  });

  it("marks the row complete once the thought is committed", () => {
    const result = liveThinkingTimelineItem({ type: "reasoning", text: "step one" }, "complete");
    expect(result?.items[0]?.data).toEqual({ text: "step one", streaming: false });
  });

  it("returns undefined for anything that is not reasoning", () => {
    expect(
      liveThinkingTimelineItem({ type: "assistant_message", text: "hi" }, "streaming"),
    ).toBeUndefined();
    expect(liveThinkingTimelineItem({ type: "reasoning", text: " " }, "streaming")).toBeUndefined();
  });
});
