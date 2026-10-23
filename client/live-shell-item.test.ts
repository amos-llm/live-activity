import { describe, expect, it } from "vitest";
import { liveShellDataSchema } from "../shared/live-shell";
import { keepOutputTail, liveShellTimelineItem, readShellToolCall } from "./live-shell-item";

function shellItem(overrides: Record<string, unknown> = {}) {
  return {
    type: "tool_call",
    callId: "call_1",
    name: "bash",
    status: "running",
    error: null,
    detail: {
      type: "shell",
      command: "npm run build",
      cwd: "/home/user/project",
      output: "building...\n",
      exitCode: null,
    },
    ...overrides,
  };
}

describe("readShellToolCall", () => {
  it("reads a running shell call", () => {
    expect(readShellToolCall(shellItem())).toEqual({
      command: "npm run build",
      output: "building...\n",
      status: "running",
      exitCode: null,
      errorText: undefined,
    });
  });

  it("grows the output as the provider streams updates", () => {
    const first = readShellToolCall(shellItem());
    const second = readShellToolCall(
      shellItem({
        detail: {
          type: "shell",
          command: "npm run build",
          output: "building...\nstep 1\nstep 2\n",
        },
      }),
    );
    expect(first?.output).toBe("building...\n");
    expect(second?.output).toBe("building...\nstep 1\nstep 2\n");
  });

  it("keeps the output as reported, without truncating it on read", () => {
    const long = `${"line\n".repeat(20_000)}tail-marker`;
    const snapshot = readShellToolCall(
      shellItem({ detail: { type: "shell", command: "cat big.log", output: long } }),
    );
    expect(snapshot?.output).toBe(long);
  });

  it("drops the blank lines providers add around command and output", () => {
    const snapshot = readShellToolCall(
      shellItem({
        detail: { type: "shell", command: "npm run build\n\n", output: "\n\nbuilding...\n" },
      }),
    );
    expect(snapshot?.command).toBe("npm run build");
    expect(snapshot?.output).toBe("building...\n");
  });

  it("clamps a huge output to its tail", () => {
    const lines = Array.from({ length: 5_000 }, (_, index) => `line ${index}`);
    const { output, truncated } = keepOutputTail(lines.join("\n"));
    expect(truncated).toBe(true);
    expect(output.split("\n")).toHaveLength(2_000);
    expect(output.endsWith("line 4999")).toBe(true);
  });

  it("drops the half line left by a byte clamp", () => {
    const { output, truncated } = keepOutputTail(`${"x".repeat(60_000)}\ncomplete tail`);
    expect(truncated).toBe(true);
    expect(output).toBe("complete tail");
  });

  it("leaves a short output alone", () => {
    expect(keepOutputTail("building...\n")).toEqual({ output: "building...\n", truncated: false });
  });

  it("ignores non-shell tool calls so Paseo keeps its own row", () => {
    expect(
      readShellToolCall(shellItem({ detail: { type: "read", filePath: "/tmp/a" } })),
    ).toBeUndefined();
    expect(readShellToolCall({ type: "reasoning", text: "thinking" })).toBeUndefined();
    expect(readShellToolCall(null)).toBeUndefined();
    expect(readShellToolCall("nope")).toBeUndefined();
    expect(readShellToolCall({})).toBeUndefined();
  });

  it("survives junk in the item without throwing", () => {
    expect(readShellToolCall({ type: "tool_call", detail: null })).toBeUndefined();
    expect(readShellToolCall({ type: "tool_call", detail: { type: "shell" } })).toEqual({
      command: "",
      output: "",
      status: "unknown",
      exitCode: undefined,
      errorText: undefined,
    });
  });

  it("keeps a failure message and exit code", () => {
    const snapshot = readShellToolCall(
      shellItem({
        status: "failed",
        error: { message: "command timed out" },
        detail: { type: "shell", command: "sleep 999", exitCode: 124 },
      }),
    );
    expect(snapshot?.status).toBe("failed");
    expect(snapshot?.errorText).toBe("command timed out");
    expect(snapshot?.exitCode).toBe(124);
  });
});

describe("liveShellTimelineItem", () => {
  it("emits plugin item data that round-trips through JSON and validates", () => {
    const result = liveShellTimelineItem(shellItem());
    expect(result?.items).toHaveLength(1);

    const entry = result?.items[0];
    expect(entry?.type).toBe("plugin");
    expect(entry?.kind).toBe("live-shell");
    expect(entry?.version).toBe(4);

    const roundTripped = JSON.parse(JSON.stringify(entry?.data));
    expect(liveShellDataSchema.safeParse(roundTripped).success).toBe(true);
    expect(roundTripped.command).toBe("npm run build");
    expect(roundTripped.status).toBe("running");
  });

  it("omits undefined optional fields", () => {
    const result = liveShellTimelineItem(shellItem({ detail: { type: "shell", command: "ls" } }));
    const data = result?.items[0]?.data as Record<string, unknown>;
    expect(Object.hasOwn(data, "exitCode")).toBe(false);
    expect(Object.hasOwn(data, "errorText")).toBe(false);
    expect(Object.hasOwn(data, "truncated")).toBe(false);
  });

  it("flags a clamped output and stays valid after JSON round-trip", () => {
    const long = Array.from({ length: 5_000 }, (_, index) => `line ${index}`).join("\n");
    const result = liveShellTimelineItem(
      shellItem({ detail: { type: "shell", command: "cat big.log", output: long } }),
    );
    const roundTripped = JSON.parse(JSON.stringify(result?.items[0]?.data));
    expect(liveShellDataSchema.safeParse(roundTripped).success).toBe(true);
    expect(roundTripped.truncated).toBe(true);
    expect(roundTripped.output.split("\n").length).toBe(2_000);
  });

  it("returns undefined for anything that is not a shell call", () => {
    expect(
      liveShellTimelineItem({ type: "tool_call", detail: { type: "edit", filePath: "/a" } }),
    ).toBeUndefined();
  });
});
