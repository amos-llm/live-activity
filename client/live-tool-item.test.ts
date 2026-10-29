import { describe, expect, it } from "vitest";
import { liveToolDataSchema } from "../shared/live-tool";
import {
  detailJson,
  displayToolName,
  isMeaningfulDetail,
  liveToolTimelineItem,
  readDetailToolCall,
} from "./live-tool-item";

function toolItem(overrides: Record<string, unknown> = {}) {
  return {
    type: "tool_call",
    callId: "call_1",
    name: "write",
    status: "running",
    error: null,
    detail: { type: "write", filePath: "/home/user/project/a.ts" },
    ...overrides,
  };
}

describe("readDetailToolCall", () => {
  it("reads a write call: the path in the header, the content in the block", () => {
    const snapshot = readDetailToolCall(
      toolItem({
        cwd: "/home/user/project",
        detail: { type: "write", filePath: "/home/user/project/src/a.ts", content: "a\nb\n" },
      }),
    );
    expect(snapshot).toEqual({
      label: "Write",
      icon: "Pencil",
      summary: "src/a.ts",
      summaryIsPath: true,
      meta: "/home/user/project/src/a.ts",
      sections: [{ text: "a\nb" }],
      status: "running",
      errorText: undefined,
    });
  });

  it("reads a fetch call: the url in the header, the result in the block", () => {
    const snapshot = readDetailToolCall(
      toolItem({
        name: "fetch",
        detail: { type: "fetch", url: "https://example.com/docs", result: "\nhello\n" },
      }),
    );
    expect(snapshot?.label).toBe("Fetch");
    expect(snapshot?.icon).toBe("Search");
    expect(snapshot?.summary).toBe("https://example.com/docs");
    expect(snapshot?.meta).toBe("https://example.com/docs");
    expect(snapshot?.sections).toEqual([{ text: "hello" }]);
  });

  it("reads a sub-agent call: its type is the row's word, its log the block", () => {
    const snapshot = readDetailToolCall(
      toolItem({
        name: "task",
        detail: {
          type: "sub_agent",
          subAgentType: "explore",
          description: "find the callers",
          childSessionId: "sess_42",
          log: "[Read] a.ts\nmore log",
        },
      }),
    );
    expect(snapshot?.label).toBe("explore");
    expect(snapshot?.icon).toBe("Bot");
    expect(snapshot?.summary).toBe("find the callers");
    expect(snapshot?.meta).toBe("session sess_42");
    expect(snapshot?.sections).toEqual([{ text: "[Read] a.ts\nmore log" }]);
  });

  it("falls back to Task for a sub-agent that reports no type", () => {
    expect(
      readDetailToolCall(toolItem({ name: "task", detail: { type: "sub_agent", log: "" } }))?.label,
    ).toBe("Task");
  });

  it("reads a plain_text call: the tool's name, its label as the summary", () => {
    const snapshot = readDetailToolCall(
      toolItem({
        name: "terminal",
        detail: { type: "plain_text", label: "npm test", text: "ok", icon: "square_terminal" },
      }),
    );
    expect(snapshot?.label).toBe("Terminal");
    expect(snapshot?.icon).toBe("SquareTerminal");
    expect(snapshot?.summary).toBe("npm test");
    expect(snapshot?.sections).toEqual([{ text: "ok" }]);
  });

  it("reads an unknown call as Input / Output groups", () => {
    const snapshot = readDetailToolCall(
      toolItem({
        name: "mcp__fs__read",
        detail: { type: "unknown", input: { path: "/a" }, output: { text: "hi" } },
      }),
    );
    expect(snapshot?.label).toBe("mcp__fs__read");
    expect(snapshot?.icon).toBe("Wrench");
    expect(snapshot?.sections).toEqual([
      { title: "Input", text: '{\n  "path": "/a"\n}' },
      { title: "Output", text: '{\n  "text": "hi"\n}' },
    ]);
  });

  it("drops an unknown group that has nothing in it", () => {
    const snapshot = readDetailToolCall(
      toolItem({
        name: "web_search",
        detail: { type: "unknown", input: { q: "x" }, output: null },
      }),
    );
    expect(snapshot?.sections).toEqual([{ title: "Input", text: '{\n  "q": "x"\n}' }]);
  });

  it("shows a lone string input as the block, without headings", () => {
    const snapshot = readDetailToolCall(
      toolItem({ name: "say", detail: { type: "unknown", input: "hello", output: null } }),
    );
    expect(snapshot?.sections).toEqual([{ text: "hello" }]);
  });

  it("leaves the tool calls that keep a native row alone", () => {
    for (const type of ["shell", "read", "edit", "search", "plan", "worktree_setup"]) {
      expect(readDetailToolCall(toolItem({ detail: { type } }))).toBeUndefined();
    }
    expect(
      readDetailToolCall(toolItem({ name: "speak", detail: { type: "unknown" } })),
    ).toBeUndefined();
    expect(readDetailToolCall({ type: "reasoning", text: "hmm" })).toBeUndefined();
    expect(readDetailToolCall(null)).toBeUndefined();
    expect(readDetailToolCall({ type: "tool_call", detail: null })).toBeUndefined();
  });

  it("picks native's detail surface for the type", () => {
    const surfaceOf = (detail: Record<string, unknown>, name = "tool") =>
      readDetailToolCall(toolItem({ name, detail }))?.inset;
    // Full-bleed `surface1`: native's `fullBleedBlock`.
    expect(surfaceOf({ type: "write", filePath: "/a.ts", content: "x" })).toBeUndefined();
    expect(surfaceOf({ type: "sub_agent", log: "x" }, "task")).toBeUndefined();
    // Inset `surface2`: native's `scrollArea` / `jsonScroll`.
    expect(surfaceOf({ type: "fetch", url: "https://x", result: "x" })).toBe(true);
    expect(surfaceOf({ type: "plain_text", text: "x" }, "terminal")).toBe(true);
    expect(surfaceOf({ type: "unknown", input: { a: 1 } }, "mcp__x")).toBe(true);
    expect(surfaceOf({ type: "unknown", input: "hi" }, "say")).toBe(true);
  });

  it("keeps a failure message", () => {
    const snapshot = readDetailToolCall(
      toolItem({ status: "failed", error: { message: "EACCES" } }),
    );
    expect(snapshot?.status).toBe("failed");
    expect(snapshot?.errorText).toBe("EACCES");
  });
});

describe("displayToolName", () => {
  it("turns a tool name into a display name", () => {
    expect(displayToolName("web_search")).toBe("Web search");
    expect(displayToolName("todo-write")).toBe("Todo write");
    expect(displayToolName("Write")).toBe("Write");
  });

  it("leaves a namespaced identifier alone", () => {
    expect(displayToolName("mcp__fs__read")).toBe("mcp__fs__read");
    expect(displayToolName("paseo.agent.spawn")).toBe("paseo.agent.spawn");
    expect(displayToolName("a/b")).toBe("a/b");
  });
});

describe("isMeaningfulDetail", () => {
  it("treats the empty shapes a provider sends as nothing", () => {
    expect(isMeaningfulDetail(null)).toBe(false);
    expect(isMeaningfulDetail("")).toBe(false);
    expect(isMeaningfulDetail("  ")).toBe(false);
    expect(isMeaningfulDetail([])).toBe(false);
    expect(isMeaningfulDetail({})).toBe(false);
    expect(isMeaningfulDetail(0)).toBe(true);
    expect(isMeaningfulDetail(false)).toBe(true);
    expect(isMeaningfulDetail({ a: 1 })).toBe(true);
  });
});

describe("detailJson", () => {
  it("pretty-prints objects and passes strings through", () => {
    expect(detailJson({ a: 1 })).toBe('{\n  "a": 1\n}');
    expect(detailJson("plain")).toBe("plain");
  });
});

describe("liveToolTimelineItem", () => {
  it("emits plugin item data that round-trips through JSON and validates", () => {
    const result = liveToolTimelineItem(
      toolItem({
        status: "completed",
        detail: { type: "write", filePath: "/tmp/a.ts", content: "one\ntwo\n" },
      }),
    );
    expect(result?.items).toHaveLength(1);

    const entry = result?.items[0];
    expect(entry?.type).toBe("plugin");
    expect(entry?.kind).toBe("live-tool");
    expect(entry?.version).toBe(1);

    const roundTripped = JSON.parse(JSON.stringify(entry?.data));
    expect(liveToolDataSchema.safeParse(roundTripped).success).toBe(true);
    expect(roundTripped.label).toBe("Write");
    expect(roundTripped.summary).toBe("/tmp/a.ts");
    expect(roundTripped.summaryIsPath).toBe(true);
    expect(roundTripped.sections).toEqual([{ text: "one\ntwo" }]);
  });

  it("omits undefined optional fields", () => {
    const result = liveToolTimelineItem(
      toolItem({ name: "task", detail: { type: "sub_agent", description: "look" } }),
    );
    const data = result?.items[0]?.data as Record<string, unknown>;
    expect(Object.hasOwn(data, "errorText")).toBe(false);
    expect(Object.hasOwn(data, "truncated")).toBe(false);
    expect(Object.hasOwn(data, "meta")).toBe(false);
    expect(Object.hasOwn(data, "summaryIsPath")).toBe(false);
    expect(Object.hasOwn(data, "inset")).toBe(false);
  });

  it("keeps the head of a huge section and flags the cut", () => {
    const lines = Array.from({ length: 5_000 }, (_, index) => `line ${index}`);
    const result = liveToolTimelineItem(
      toolItem({
        status: "completed",
        detail: { type: "write", filePath: "/tmp/big.ts", content: lines.join("\n") },
      }),
    );
    const roundTripped = JSON.parse(JSON.stringify(result?.items[0]?.data));
    expect(liveToolDataSchema.safeParse(roundTripped).success).toBe(true);
    expect(roundTripped.truncated).toBe(true);
    expect(roundTripped.sections[0].text.split("\n")).toHaveLength(2_000);
    expect(roundTripped.sections[0].text.startsWith("line 0\n")).toBe(true);
  });

  it("carries the inset surface through to the renderer", () => {
    const result = liveToolTimelineItem(
      toolItem({ detail: { type: "fetch", url: "https://x", result: "r" } }),
    );
    const data = result?.items[0]?.data as Record<string, unknown>;
    expect(data.inset).toBe(true);
    expect(JSON.parse(JSON.stringify(data)).inset).toBe(true);
  });

  it("returns undefined for every tool call another row owns", () => {
    expect(
      liveToolTimelineItem({ type: "tool_call", detail: { type: "shell", command: "ls" } }),
    ).toBeUndefined();
    expect(
      liveToolTimelineItem({ type: "tool_call", detail: { type: "plan", text: "do it" } }),
    ).toBeUndefined();
  });
});
