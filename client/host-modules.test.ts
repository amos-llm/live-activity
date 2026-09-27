import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("..", import.meta.url));

/**
 * Paseo's daemon compiles plugin sources and rejects imports of packages it
 * does not hand to plugins. `@getpaseo/protocol` is private: importing it — even
 * for types — fails the install with "Could not resolve type dependency".
 * This guard keeps that failure out of the install path.
 */
const ALLOWED_HOST_MODULES = new Set([
  "@getpaseo/plugin",
  "@getpaseo/plugin/client",
  "@getpaseo/plugin/client/ui",
  "@getpaseo/plugin/client/react-native",
  "@tanstack/react-query",
  "react",
  "react/jsx-runtime",
  "react-native",
  "zod",
]);

function isTestFile(path: string): boolean {
  return /\.test\.tsx?$/.test(path);
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    if (entry === "node_modules" || entry.startsWith(".")) return [];
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    if (!/\.tsx?$/.test(path) || isTestFile(path)) return [];
    return [path];
  });
}

describe("host module imports", () => {
  it("imports only modules Paseo provides to plugins", () => {
    const violations: string[] = [];

    for (const path of sourceFiles(root)) {
      const source = readFileSync(path, "utf8");
      for (const match of source.matchAll(/from\s+"([^"]+)"/g)) {
        const specifier = match[1];
        if (specifier.startsWith(".")) continue;
        if (ALLOWED_HOST_MODULES.has(specifier)) continue;
        violations.push(`${relative(root, path)} imports ${specifier}`);
      }
    }

    expect(violations).toEqual([]);
  });
});
