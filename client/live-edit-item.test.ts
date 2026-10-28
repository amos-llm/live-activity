import { describe, expect, it } from "vitest";
import { liveEditDataSchema } from "../shared/live-edit";
import {
  diffStat,
  liveEditTimelineItem,
  parseDiff,
  readEditToolCall,
  synthesizeDiff,
} from "./live-edit-item";

/** pi's dialect: `<sign><line number> <text>`, no hunk headers, `...` gaps. */
const PI_DIFF = [
  "     ...",
  '   4 import { useCallback } from "react";',
  '+  5 import { useNow } from "./use-now";',
  "   5 ",
  "+  6 const A = 1;",
  "-  7 const B = 2;",
  "   8 ",
].join("\n");

/** git's dialect: file headers and `@@` hunks. */
const GIT_DIFF = [
  "diff --git a/x.ts b/x.ts",
  "index 111..222 100644",
  "--- a/x.ts",
  "+++ b/x.ts",
  "@@ -1,3 +1,3 @@",
  " const a = 1;",
  "-const b = 2;",
  "+const b = 3;",
  "+const c = 4;",
].join("\n");

function editItem(overrides: Record<string, unknown> = {}) {
  return {
    type: "tool_call",
    callId: "call_1",
    name: "edit",
    status: "completed",
    error: null,
    cwd: "/home/user/project",
    detail: {
      type: "edit",
      filePath: "/home/user/project/client/a.tsx",
      unifiedDiff: PI_DIFF,
    },
    ...overrides,
  };
}

describe("parseDiff", () => {
  it("classifies pi's diff and counts the change", () => {
    const parsed = parseDiff(PI_DIFF);
    expect(parsed.additions).toBe(2);
    expect(parsed.deletions).toBe(1);
    expect(parsed.lines.map((line) => line.kind)).toEqual([
      "context",
      "context",
      "add",
      "context",
      "add",
      "remove",
      "context",
    ]);
    // The provider's own line numbers stay in the text.
    expect(parsed.lines[2]?.text).toBe('+  5 import { useNow } from "./use-now";');
  });

  it("does not count file headers as changed lines", () => {
    const parsed = parseDiff(GIT_DIFF);
    expect(parsed.additions).toBe(2);
    expect(parsed.deletions).toBe(1);
    expect(parsed.lines[0]?.kind).toBe("meta");
    expect(parsed.lines[4]?.kind).toBe("meta");
  });

  it("gives every line a key that is unique within the diff", () => {
    const keys = parseDiff(`${"+a\n+a\n+b\n-a\n-a"}`).lines.map((line) => line.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("drops the empty line a trailing newline leaves behind", () => {
    expect(parseDiff("+a\n").lines).toHaveLength(1);
    expect(parseDiff("").lines).toHaveLength(0);
  });
});

describe("synthesizeDiff", () => {
  it("marks the old text as removed and the new text as added", () => {
    expect(synthesizeDiff("one\ntwo\n", "one\nthree")).toBe("-one\n-two\n+one\n+three");
  });

  it("handles a missing side", () => {
    expect(synthesizeDiff(undefined, "new")).toBe("+new");
    expect(synthesizeDiff("old", undefined)).toBe("-old");
    expect(synthesizeDiff(undefined, undefined)).toBe("");
  });
});

describe("diffStat", () => {
  it("shows only the counts that happened", () => {
    expect(diffStat(12, 4)).toBe("+12 -4");
    expect(diffStat(3, 0)).toBe("+3");
    expect(diffStat(0, 2)).toBe("-2");
    expect(diffStat(0, 0)).toBe("");
  });
});

describe("readEditToolCall", () => {
  it("reads the patch and strips the cwd from the path", () => {
    const snapshot = readEditToolCall(editItem());
    expect(snapshot?.displayPath).toBe("client/a.tsx");
    expect(snapshot?.unifiedDiff).toBe(PI_DIFF);
    expect(snapshot?.status).toBe("completed");
  });

  it("treats an empty patch as no patch", () => {
    const snapshot = readEditToolCall(
      editItem({ detail: { type: "edit", filePath: "/tmp/a.ts", unifiedDiff: "" } }),
    );
    expect(snapshot?.unifiedDiff).toBeUndefined();
  });

  it("ignores anything that is not an edit call", () => {
    expect(
      readEditToolCall(editItem({ detail: { type: "write", filePath: "/tmp/a" } })),
    ).toBeUndefined();
    expect(readEditToolCall({})).toBeUndefined();
  });
});

describe("liveEditTimelineItem", () => {
  it("emits plugin item data that round-trips through JSON and validates", () => {
    const result = liveEditTimelineItem(editItem());
    const entry = result?.items[0];
    expect(entry?.kind).toBe("live-edit");
    expect(entry?.version).toBe(1);

    const roundTripped = JSON.parse(JSON.stringify(entry?.data));
    expect(liveEditDataSchema.safeParse(roundTripped).success).toBe(true);
    expect(roundTripped.displayPath).toBe("client/a.tsx");
    expect(roundTripped.additions).toBe(2);
    expect(roundTripped.deletions).toBe(1);
    expect(Object.hasOwn(roundTripped, "synthesized")).toBe(false);
  });

  it("falls back to the first edit's old/new text and says so", () => {
    const result = liveEditTimelineItem(
      editItem({
        status: "running",
        detail: {
          type: "edit",
          filePath: "/tmp/a.ts",
          oldString: "const b = 2;",
          newString: "const b = 3;",
        },
      }),
    );
    const roundTripped = JSON.parse(JSON.stringify(result?.items[0]?.data));
    expect(roundTripped.synthesized).toBe(true);
    expect(roundTripped.diff).toBe("-const b = 2;\n+const b = 3;");
    expect(roundTripped.additions).toBe(1);
    expect(roundTripped.deletions).toBe(1);
  });

  it("keeps the head of a huge patch and flags the cut", () => {
    const patch = Array.from({ length: 5_000 }, (_, index) => `+line ${index}`).join("\n");
    const result = liveEditTimelineItem(
      editItem({ detail: { type: "edit", filePath: "/tmp/a.ts", unifiedDiff: patch } }),
    );
    const roundTripped = JSON.parse(JSON.stringify(result?.items[0]?.data));
    expect(liveEditDataSchema.safeParse(roundTripped).success).toBe(true);
    expect(roundTripped.truncated).toBe(true);
    expect(roundTripped.diff.startsWith("+line 0\n")).toBe(true);
  });

  it("returns undefined for anything that is not an edit call", () => {
    expect(
      liveEditTimelineItem({ type: "tool_call", detail: { type: "read", filePath: "/a" } }),
    ).toBeUndefined();
  });
});
