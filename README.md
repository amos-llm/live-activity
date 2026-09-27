# live-activity

Makes two kinds of Paseo timeline rows **visible in real time**:

| Row                      | Native behavior                                     | This plugin                                                                    |
| ------------------------ | --------------------------------------------------- | ------------------------------------------------------------------------------ |
| **shell tool calls**     | Output is only easy to read when finished           | Auto-expands while running, output grows as it runs; auto-collapses when done  |
| **thinking (reasoning)** | Collapsed, so you can't tell if the model is moving | Shows the latest chunk of thinking on **a single line**, changing as it thinks |

## What it looks like

Shell row (auto-expanded while running):

```
▾ Shell  npm run ceval -- --limit 5
  ┌────────────────────────────────┐
  │ [1/5] KYMI-058 ...             │
  │ [2/5] REBD-1003 ...            │  ← refreshes as it runs
  └────────────────────────────────┘
```

Shell row (auto-collapsed when finished; failure is shown by the alert icon):

```
▸ Shell  ffmpeg -i in.mp4 out.mkv
```

Thinking row (always one line, showing the latest chunk of thinking):

```
🧠 Thinking  Next I need to confirm whether Paseo's ACP adapter maps partialResult into…
```

In both cases you can click to see the full content (the full output for shell, the full thinking text for thinking).

## Behavior details

- **Only the shell command currently executing expands by default**; it auto-collapses when finished, and clicking toggles it manually (once you click, that row follows you and no longer changes automatically).
- When expanded, the row header takes a `surface1` background and joins the detail block below into one unit; when collapsed it is **completely borderless** (matching the native badge).
- Status is shown by icon only, never by text (no `failed` / `canceled` word, no `exit N`): `TriangleAlert` (danger) on failure, `Ban` (muted) when canceled. Other icons use their lucide names: `SquareTerminal` for shell, `Brain` for thinking, and a 90°-rotated `ChevronRight` on hover/expand (natively the arrow only appears on hover).
- While running, the command wraps across as many lines as it needs; once the command ends, the collapsed row keeps it on **one line with a trailing ellipsis**.
- The thinking row flattens the thought into a single line: while streaming it keeps the **last 220 characters**, so the line changes on every update; once the thought is complete it shows the **beginning**, which identifies what was thought.
- Output/thinking length is not limited: the provider (pi) already truncates to 2000 lines / 50 KB, keeping the tail.

## Alignment with native styles

The colors, radii, spacing, font sizes, and font stacks of the row header/detail block are copied from Paseo's own (`ExpandableBadge` in `packages/app/src/components/message.tsx`, `ShellDetailSection` in `tool-call-details.tsx`, and the tokens in `styles/theme.ts`):

```
spacing 1=4 2=8 3=12     fontSize base=14 code=12     lineHeight 18
borderRadius base=4 lg=8 borderWidth 1               timeline horizontal inset 13px
mono: SFMono-Regular, Menlo, Monaco, Consolas, … / ui-monospace
```

The plugin cannot read `theme.spacing` / `theme.fontSize`, so these values are hardcoded as constants at the top of `client/live-*-row.tsx`.

## Implementation

```
index.client.tsx                 registers 2 transformers + 2 renderers
client/timeline-badge.tsx        shared badge: native tokens + styles + icon slot (both rows use it)
client/use-toggle.ts             expand state: follows "is running", then follows the user once clicked
client/live-shell-item.ts        pure logic: read tool_call → shell data (tested)
client/live-shell-row.tsx        shell row (thin wrapper)
client/live-thinking-item.ts     pure logic: read reasoning + liveThinkingLine() (tested)
client/live-thinking-row.tsx     thinking row (thin wrapper)
shared/live-shell.ts             shell row data contract (v3)
shared/live-thinking.ts          thinking row data contract
client/host-modules.test.ts      asserts no private host packages are imported
```

Key implementation point: Paseo's `@getpaseo/protocol` is a **private** host package, and a plugin is rejected by the boundary check at install time even if it only does `import type` (that is exactly how the upstream `colorful-agent-activity` failed). So the shapes of the timeline items are **re-parsed at runtime** inside `readShellToolCall()` / `readReasoning()`, without importing any private types.

## Install / develop

Zero runtime dependencies (only host modules Paseo provides: `@getpaseo/plugin/*`, `react`, `react-native`, `zod`), so **a Git install also works directly** (Paseo's Git install does not run a package manager):

```bash
paseo plugin add <git-remote>:live-activity
paseo plugin reload live-activity
```

Local development:

```bash
npm install
npm run check                    # typecheck + lint + test
npm run format                   # oxfmt
npm run lint                     # oxlint
paseo plugin install "$PWD"      # directory install
paseo plugin reload live-activity
paseo plugin logs live-activity
```

Formatting/static checking uses Paseo's own toolchain (copied from its `.oxfmtrc.json`: printWidth 100, double quotes, trailing semicolons, trailing comma all; and `.oxlintrc.json`: react / react-perf / unicorn / typescript / import / promise, with correctness + suspicious + perf all set to error). `react-perf` is useful here: streaming rows re-render on every update, so style objects, style arrays, and callbacks are all required to be memoized.

A directory install remembers the path and the daemon loads from it on every start, so don't move the directory.

## Limitations

- Only shell rows inside `tool_call` and `reasoning` rows are taken over; `read` / `edit` / `search` / `todo` / assistant messages and so on keep their native rendering.
- Rows that have been taken over no longer have the interactive behavior of native rows (this only does display).
- When the provider does not report incremental output/incremental thinking, the row content only appears all at once at the end.
