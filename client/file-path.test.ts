import { describe, expect, it } from "vitest";
import { displayPath, shortenPath } from "./file-path";

describe("displayPath", () => {
  it("strips the agent's working directory", () => {
    expect(displayPath("/home/user/project/client/a.tsx", "/home/user/project")).toBe(
      "client/a.tsx",
    );
  });

  it("ignores a trailing slash on the working directory", () => {
    expect(displayPath("/home/user/project/client/a.tsx", "/home/user/project/")).toBe(
      "client/a.tsx",
    );
  });

  it("keeps the working directory itself visible", () => {
    expect(displayPath("/home/user/project", "/home/user/project")).toBe(".");
  });

  it("keeps paths outside the working directory", () => {
    expect(displayPath("/etc/hosts", "/home/user/project")).toBe("/etc/hosts");
    expect(displayPath("/home/user/project-old/a.ts", "/home/user/project")).toBe(
      "/home/user/project-old/a.ts",
    );
  });

  it("keeps relative paths and paths with no known cwd", () => {
    expect(displayPath("client/a.tsx")).toBe("client/a.tsx");
    expect(displayPath("client/a.tsx", "")).toBe("client/a.tsx");
  });

  it("does not treat the filesystem root as a prefix to strip", () => {
    expect(displayPath("/usr/local/bin", "/")).toBe("/usr/local/bin");
  });
});

describe("shortenPath", () => {
  it("leaves a path that fits alone", () => {
    expect(shortenPath("client/a.tsx", 20)).toBe("client/a.tsx");
  });

  it("keeps the deepest segments and marks the cut", () => {
    expect(shortenPath("/home/ubuntu/live-activity/client/live-read-row.tsx", 44)).toBe(
      "…/live-activity/client/live-read-row.tsx",
    );
    expect(shortenPath("/home/ubuntu/live-activity/client/live-read-row.tsx", 30)).toBe(
      "…/client/live-read-row.tsx",
    );
  });

  it("keeps the file name when a single segment is too long", () => {
    expect(shortenPath("/a/0123456789abcdef.ts", 10)).toBe("…abcdef.ts");
  });

  it("never grows a path", () => {
    const path = "/home/ubuntu/project/src/index.ts";
    for (const max of [1, 5, 12, 30]) {
      expect(shortenPath(path, max).length).toBeLessThanOrEqual(Math.max(max, 2));
    }
  });
});
