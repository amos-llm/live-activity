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

const SOURCE_FILE = /\.(?:tsx?|jsx?|mjs|cjs)$/;

function isTestFile(path: string): boolean {
  return /\.test\.(?:tsx?|jsx?|mjs|cjs)$/.test(path);
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    if (entry === "node_modules" || entry.startsWith(".")) return [];
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    if (!SOURCE_FILE.test(path) || isTestFile(path)) return [];
    return [path];
  });
}

/**
 * Every way a module can be referenced from source: static and re-exported
 * imports, side-effect imports, dynamic imports, and `require`.
 */
const SPECIFIER_PATTERNS = [
  /\bfrom\s+"([^"]+)"/g,
  /\bimport\s+"([^"]+)"/g,
  /\bimport\s*\(\s*"([^"]+)"\s*\)/g,
  /\brequire\s*\(\s*"([^"]+)"\s*\)/g,
];

function importedSpecifiers(source: string): string[] {
  return SPECIFIER_PATTERNS.flatMap((pattern) =>
    [...source.matchAll(pattern)].map((match) => match[1] ?? ""),
  ).filter((specifier) => specifier !== "");
}
describe("host module imports", () => {
  it("imports only modules Paseo provides to plugins", () => {
    const violations: string[] = [];

    for (const path of sourceFiles(root)) {
      const source = readFileSync(path, "utf8");
      for (const specifier of importedSpecifiers(source)) {
        if (specifier.startsWith(".")) continue;
        if (ALLOWED_HOST_MODULES.has(specifier)) continue;
        violations.push(`${relative(root, path)} imports ${specifier}`);
      }
    }

    expect(violations).toEqual([]);
  });
});
