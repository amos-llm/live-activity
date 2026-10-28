import { describe, expect, it } from "vitest";
import { liveReadDataSchema } from "../shared/live-read";
import {
  gutterNumbers,
  lineCount,
  liveReadTimelineItem,
  readRangeLabel,
  readReadToolCall,
} from "./live-read-item";

function readItem(overrides: Record<string, unknown> = {}) {
  return {
    type: "tool_call",
    callId: "call_1",
    name: "read",
    status: "running",
    error: null,
    cwd: "/home/user/project",
    detail: {
      type: "read",
      filePath: "/home/user/project/client/a.tsx",
      offset: 120,
      limit: 290,
    },
    ...overrides,
  };
}

describe("readReadToolCall", () => {
  it("reads a running read call before its content arrives", () => {
    expect(readReadToolCall(readItem())).toEqual({
      filePath: "/home/user/project/client/a.tsx",
      displayPath: "client/a.tsx",
      content: "",
      startLine: 120,
      limit: 290,
      status: "running",
      errorText: undefined,
    });
  });

  it("treats a missing offset as the top of the file", () => {
    const snapshot = readReadToolCall(
      readItem({ detail: { type: "read", filePath: "/tmp/a.ts" } }),
    );
    expect(snapshot?.startLine).toBe(1);
    expect(snapshot?.limit).toBeUndefined();
  });

  it("reads the content the call reported", () => {
    const snapshot = readReadToolCall(
      readItem({
        status: "completed",
        detail: { type: "read", filePath: "/tmp/a.ts", content: "one\ntwo\n" },
      }),
    );
    expect(snapshot?.content).toBe("one\ntwo");
  });

  it("ignores anything that is not a read call", () => {
    expect(
      readReadToolCall(readItem({ detail: { type: "shell", command: "ls" } })),
    ).toBeUndefined();
    expect(readReadToolCall({ type: "reasoning", text: "hmm" })).toBeUndefined();
    expect(readReadToolCall(null)).toBeUndefined();
    expect(readReadToolCall({ type: "tool_call", detail: null })).toBeUndefined();
  });

  it("keeps a failure message", () => {
    const snapshot = readReadToolCall(
      readItem({ status: "failed", error: { message: "no such file" } }),
    );
    expect(snapshot?.status).toBe("failed");
    expect(snapshot?.errorText).toBe("no such file");
  });
});

describe("lineCount", () => {
  it("counts lines without splitting the text", () => {
    expect(lineCount("")).toBe(0);
    expect(lineCount("one")).toBe(1);
    expect(lineCount("one\ntwo\nthree")).toBe(3);
    expect(lineCount("one\ntwo\n")).toBe(3);
  });
});

describe("gutterNumbers", () => {
  it("numbers the lines from the provider's offset", () => {
    expect(gutterNumbers(1, 3)).toBe("1\n2\n3");
    expect(gutterNumbers(98, 4)).toBe(" 98\n 99\n100\n101");
  });

  it("is empty when there is nothing to number", () => {
    expect(gutterNumbers(1, 0)).toBe("");
  });
});

describe("readRangeLabel", () => {
  it("shows the lines the content covers", () => {
    expect(readRangeLabel("/a/b.ts", 120, 3)).toBe("/a/b.ts:120–122");
  });

  it("shows the requested range while the content is still missing", () => {
    expect(readRangeLabel("/a/b.ts", 120, 0, 290)).toBe("/a/b.ts:120–409");
  });

  it("shows only the start when nothing is known", () => {
    expect(readRangeLabel("/a/b.ts", 7, 0)).toBe("/a/b.ts:7");
  });
});

describe("liveReadTimelineItem", () => {
  it("emits plugin item data that round-trips through JSON and validates", () => {
    const result = liveReadTimelineItem(
      readItem({
        status: "completed",
        detail: {
          type: "read",
          filePath: "/home/user/project/index.ts",
          offset: 1,
          content: "const a = 1;\nconst b = 2;\n",
        },
      }),
    );
    expect(result?.items).toHaveLength(1);

    const entry = result?.items[0];
    expect(entry?.type).toBe("plugin");
    expect(entry?.kind).toBe("live-read");
    expect(entry?.version).toBe(1);

    const roundTripped = JSON.parse(JSON.stringify(entry?.data));
    expect(liveReadDataSchema.safeParse(roundTripped).success).toBe(true);
    expect(roundTripped.displayPath).toBe("index.ts");
    expect(roundTripped.content).toBe("const a = 1;\nconst b = 2;");
    expect(roundTripped.startLine).toBe(1);
  });

  it("omits undefined optional fields", () => {
    const result = liveReadTimelineItem(
      readItem({ detail: { type: "read", filePath: "/tmp/a.ts" } }),
    );
    const data = result?.items[0]?.data as Record<string, unknown>;
    expect(Object.hasOwn(data, "limit")).toBe(false);
    expect(Object.hasOwn(data, "errorText")).toBe(false);
    expect(Object.hasOwn(data, "truncated")).toBe(false);
  });

  it("keeps the head of a huge file and flags the cut", () => {
    const lines = Array.from({ length: 5_000 }, (_, index) => `line ${index}`);
    const result = liveReadTimelineItem(
      readItem({
        status: "completed",
        detail: { type: "read", filePath: "/tmp/big.ts", content: lines.join("\n") },
      }),
    );
    const roundTripped = JSON.parse(JSON.stringify(result?.items[0]?.data));
    expect(liveReadDataSchema.safeParse(roundTripped).success).toBe(true);
    expect(roundTripped.truncated).toBe(true);
    expect(roundTripped.content.split("\n")).toHaveLength(2_000);
    expect(roundTripped.content.startsWith("line 0\n")).toBe(true);
  });

  it("returns undefined for anything that is not a read call", () => {
    expect(
      liveReadTimelineItem({ type: "tool_call", detail: { type: "edit", filePath: "/a" } }),
    ).toBeUndefined();
  });
});
