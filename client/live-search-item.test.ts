import { describe, expect, it } from "vitest";
import { liveSearchDataSchema } from "../shared/live-search";
import {
  liveSearchTimelineItem,
  readSearchToolCall,
  searchBody,
  searchMeta,
} from "./live-search-item";

function searchItem(overrides: Record<string, unknown> = {}) {
  return {
    type: "tool_call",
    callId: "call_1",
    name: "grep",
    status: "running",
    error: null,
    detail: { type: "search", query: "TODO", toolName: "grep" },
    ...overrides,
  };
}

describe("readSearchToolCall", () => {
  it("reads the shape pi reports: a query and the matched text", () => {
    expect(readSearchToolCall(searchItem())).toEqual({
      query: "TODO",
      toolName: "grep",
      content: "",
      filePaths: [],
      webResults: [],
      numMatches: undefined,
      numFiles: undefined,
      durationMs: undefined,
      status: "running",
      errorText: undefined,
    });
  });

  it("reads the richer shape other providers report", () => {
    const snapshot = readSearchToolCall(
      searchItem({
        status: "completed",
        detail: {
          type: "search",
          query: "usePaseo",
          toolName: "web_search",
          content: "\nresult text\n",
          filePaths: ["/a.ts", 42, "/b.ts"],
          webResults: [{ title: "Docs", url: "https://example.com" }, { url: "https://x.dev" }, {}],
          numMatches: 12,
          numFiles: 8,
          durationMs: 340,
          truncated: true,
        },
      }),
    );
    expect(snapshot?.content).toBe("result text");
    expect(snapshot?.filePaths).toEqual(["/a.ts", "/b.ts"]);
    expect(snapshot?.webResults).toEqual([
      { title: "Docs", url: "https://example.com" },
      { title: "https://x.dev", url: "https://x.dev" },
    ]);
    expect(snapshot?.numMatches).toBe(12);
    expect(snapshot?.numFiles).toBe(8);
    expect(snapshot?.durationMs).toBe(340);
  });

  it("ignores anything that is not a search call", () => {
    expect(readSearchToolCall(searchItem({ detail: { type: "shell", command: "ls" } }))).toBe(
      undefined,
    );
    expect(readSearchToolCall({ type: "tool_call", detail: { type: "search" } })?.query).toBe("");
    expect(readSearchToolCall("nope")).toBeUndefined();
  });
});

describe("searchMeta", () => {
  it("reports only what the provider sent", () => {
    expect(searchMeta({})).toBeUndefined();
    expect(searchMeta({ numMatches: 12, numFiles: 8, durationMs: 340 })).toBe(
      "12 matches · 8 files · 340ms",
    );
  });

  it("uses singular labels and seconds where they read better", () => {
    expect(searchMeta({ numMatches: 1, numFiles: 1 })).toBe("1 match · 1 file");
    expect(searchMeta({ durationMs: 1_240 })).toBe("1.2s");
  });
});

describe("searchBody", () => {
  it("prefers the matched text", () => {
    expect(searchBody({ content: "a:1:x", filePaths: ["/a"], webResults: [] })).toBe("a:1:x");
  });

  it("falls back to the file list, then to web results", () => {
    expect(searchBody({ content: "", filePaths: ["/a", "/b"], webResults: [] })).toBe("/a\n/b");
    expect(
      searchBody({
        content: "",
        filePaths: [],
        webResults: [{ title: "Docs", url: "https://example.com" }],
      }),
    ).toBe("Docs\nhttps://example.com");
  });

  it("is empty when the search reported nothing", () => {
    expect(searchBody({ content: "", filePaths: [], webResults: [] })).toBe("");
  });
});

describe("liveSearchTimelineItem", () => {
  it("emits plugin item data that round-trips through JSON and validates", () => {
    const result = liveSearchTimelineItem(
      searchItem({
        status: "completed",
        detail: { type: "search", query: "TODO", content: "a:1" },
      }),
    );
    const entry = result?.items[0];
    expect(entry?.kind).toBe("live-search");
    expect(entry?.version).toBe(1);

    const roundTripped = JSON.parse(JSON.stringify(entry?.data));
    expect(liveSearchDataSchema.safeParse(roundTripped).success).toBe(true);
    expect(roundTripped.query).toBe("TODO");
    expect(roundTripped.content).toBe("a:1");
    expect(Object.hasOwn(roundTripped, "numMatches")).toBe(false);
    expect(Object.hasOwn(roundTripped, "truncated")).toBe(false);
  });

  it("keeps the head of very long results and flags the cut", () => {
    const lines = Array.from({ length: 5_000 }, (_, index) => `match ${index}`);
    const result = liveSearchTimelineItem(
      searchItem({
        status: "completed",
        detail: { type: "search", query: "x", content: lines.join("\n") },
      }),
    );
    const roundTripped = JSON.parse(JSON.stringify(result?.items[0]?.data));
    expect(liveSearchDataSchema.safeParse(roundTripped).success).toBe(true);
    expect(roundTripped.truncated).toBe(true);
    expect(roundTripped.content.split("\n")).toHaveLength(2_000);
  });

  it("returns undefined for anything that is not a search call", () => {
    expect(
      liveSearchTimelineItem({ type: "tool_call", detail: { type: "read", filePath: "/a" } }),
    ).toBeUndefined();
  });
});
