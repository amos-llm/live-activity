import { describe, expect, it, vi } from "vitest";

/**
 * The rows themselves are untested here — this covers only the entry point's
 * contract with Paseo's loader. `react-native` ships Flow-typed entry files that
 * the test bundler cannot parse, so its surface is stubbed; only the row
 * components touch it.
 */
vi.mock("react-native", () => ({
  Platform: { OS: "ios", select: (values: Record<string, unknown>) => values.ios },
  Pressable: () => null,
  ScrollView: () => null,
  StyleSheet: { create: (styles: unknown) => styles, flatten: (styles: unknown) => styles },
  Text: () => null,
  View: () => null,
}));

/**
 * Paseo's loader rejects a default export that does not hand back a cleanup
 * function ("Plugin <id> contribution must return a cleanup function"). The
 * entry returned one only because it ended with `return () => {...}`; removing
 * that block during a feature delete broke the whole plugin with no TypeScript
 * error, because an implicit `undefined` return is still assignable to the
 * inferred type once the annotation is gone. This pins the contract instead.
 */
function fakeClient() {
  const cleanups: Array<() => void> = [];
  const register = () => {
    const cleanup = vi.fn();
    cleanups.push(cleanup);
    return cleanup;
  };
  return {
    client: {
      addTimelineRenderer: vi.fn(register),
      addTimelineTransformer: vi.fn(register),
    },
    cleanups,
  };
}

describe("plugin contribution", () => {
  it("returns a cleanup function", async () => {
    const { default: contribute } = await import("../index.client");
    const { client } = fakeClient();

    expect(typeof contribute(client as never)).toBe("function");
  });

  it("registers the 6 transformers + 6 renderers", async () => {
    const { default: contribute } = await import("../index.client");
    const { client } = fakeClient();

    contribute(client as never);

    expect(client.addTimelineTransformer).toHaveBeenCalledTimes(6);
    expect(client.addTimelineRenderer).toHaveBeenCalledTimes(6);
  });

  it("unregisters every contribution when cleanup runs", async () => {
    const { default: contribute } = await import("../index.client");
    const { client, cleanups } = fakeClient();

    contribute(client as never)();

    expect(cleanups).toHaveLength(12);
    for (const unregister of cleanups) expect(unregister).toHaveBeenCalledTimes(1);
  });
});
