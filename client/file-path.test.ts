import { describe, expect, it } from "vitest";
import { displayPath } from "./file-path";

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
