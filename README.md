# live-activity

Makes six kinds of Paseo timeline rows **visible in real time**:

| Row                       | Native behavior                                     | This plugin                                                                                    |
| ------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **shell tool calls**      | Output is only easy to read when finished           | Auto-expands while running, output grows as it runs; auto-collapses when done                  |
| **read tool calls**       | Collapsed to a path, so what was read is hidden     | Auto-expands and shows the file with line numbers starting at the read's `offset`              |
| **edit tool calls**       | Collapsed to a path                                 | Auto-expands into a colored diff (adds in success green, removes in danger red) with `+a -d`   |
| **search tool calls**     | Collapsed to the query                              | Auto-expands into the matches, file list or web results, with counts and duration when sent    |
| **every other tool call** | Collapsed to a name and a summary                   | Auto-expands into what it wrote, fetched, asked a sub-agent, or its raw input / output JSON    |
| **thinking (reasoning)**  | Collapsed, so you can't tell if the model is moving | Auto-expands while the model thinks, reasoning visible as it streams; auto-collapses when done |

## What it looks like

Shell row (auto-expanded while running):

```
▾ Shell  npm run build
  ┌──────────────────────────────┐
  │ $ npm run build              │
  │                              │
  │ compiled 128 modules in 1.2s │
  │ done in 1.8s                 │  ← follows the newest output while you are at the bottom (capped at 400px)
  │                              │
  └──────────────────────────────┘
```

Shell row (auto-collapsed when finished; failure is shown by the alert icon):

```

▸ Shell ffmpeg -i in.mp4 out.mkv

```

Thinking row (auto-expanded while the model is thinking; follows the newest text until you scroll up):

```

▾ Thought Check whether Paseo's ACP adapter maps partialResult into the timeline…
  ┌────────────────────────────────────────┐
  │ Check whether Paseo's ACP adapter maps │
  │ partialResult into the timeline. If it │
  │ does, reasoning updates arrive per     │  ← follows the newest text while you are at the bottom (capped at 400px)
  │ chunk and the row can stay live.       │
  └────────────────────────────────────────┘
```

Thinking row (auto-collapsed a few seconds after the thought ends; the header keeps the start of the thought on one line):

```

🧠 Thought Check whether Paseo's ACP adapter maps partialResult into the timeli…

```

Read row (auto-expanded while the file is being read):

```
▾ Read  …/live-activity/client/live-read-row.tsx
  /home/ubuntu/live-activity/client/live-read-row.tsx:1–110
   1 import type { PluginTimelineItemProps } from "@getpaseo/plugin/client";
   2 import { useCallback, useMemo } from "react";
   3 import { Text } from "react-native";        ← line numbers start at the read's offset
   4 …
```

Edit row (auto-expanded; the header carries the change counts, the block colors the patch):

```
▾ Edit  …/live-activity/client/live-read-row.tsx +12 -4
  /home/ubuntu/live-activity/client/live-read-row.tsx
     4 import { useCallback, useMemo } from "react";
  +  5 import { useNow } from "./use-now";     ← green
  -  6 const A = 1;                            ← red
  +  7 const B = 2;
```

A path that does not fit the header is shortened from the **front** (`…/live-activity/client/live-read-row.tsx`) instead of being ellipsized at the end like a native summary — cutting an absolute path at the end removes the file name, which is the part that identifies the row. The detail block always shows the full path.

Search row (auto-expanded; the header keeps the query, the block the matches):

```
▾ Search  TODO
  12 matches · 8 files · 340ms
  client/live-read-row.tsx:41:  // TODO: …
  client/live-search-row.tsx:12:  // TODO: …
```

In every case you can click to see the full content.

Every other tool call — `write`, `fetch`, `sub_agent`, `plain_text`, and `unknown`, which is what any tool Paseo has no typed detail for reports (MCP tools included) — gets the same treatment. The header carries the tool's word and the same glyph native gives it (`Pencil` for a write, `Search` for a fetch, `Bot` for a sub-agent, `Wrench` otherwise), and the block carries what the call produced:

```
▾ Write  …/live-activity/client/use-now.ts
  /home/ubuntu/live-activity/client/use-now.ts
  import { useEffect, useState } from "react";
  …

▾ mcp__fs__read                              ← an unknown detail: native's Input / Output groups
  Input
  {
    "path": "/home/ubuntu/live-activity"
  }

  Output
  {
    "entries": ["client", "shared", "README.md"]
  }
```

## Behavior details

- **A row expands by itself while its content is still growing or arriving** — the shell command while it runs, the file while it is read, the patch while it is applied, the results while the search runs, the thought while the model thinks — and auto-collapses 5s after it ends; clicking toggles it manually (once you click, that row follows you and no longer changes automatically). Rows mounted already finished start collapsed.
- When expanded, the row header takes a `surface1` background and joins the detail block below into one unit; when collapsed it is **completely borderless** (matching the native badge).
- Status is shown by icon only in the header, never by word (no `failed` / `canceled`): `TriangleAlert` (danger) on failure, `Ban` (muted) when canceled. The detail block carries the facts instead — a non-zero-safe `exit N` line and the error message, both only visible once expanded. Other icons use their lucide names: `SquareTerminal` for shell, `Eye` for read, `Pencil` for edit and write, `Search` for search and fetch, `Bot` for a sub-agent, `Wrench` for a tool with no typed detail, `Brain` for thinking, and a 90°-rotated `ChevronRight` on hover/expand (natively the arrow only appears on hover).
- While running, the command wraps across as many lines as it needs; once the command ends, the collapsed row keeps it on **one line with a trailing ellipsis**.
- The detail block is the native one: a **capped vertical scroll** (400px on every layout) around a horizontal scroll for unwrapped lines, so a chatty build never pushes the timeline off screen. Its content is the command and output in one monospace block prefixed by a muted `$ `.
- The shell row keeps the block on the **newest** output while the command is still writing, with the same rule as the thinking row below: only while you are at the bottom, only an **upward** scroll stops it, and scrolling back down (or reopening the row) resumes it. A finished command is **history**: expanding it starts at the top, so you read it from the command line down.
- The thinking row expands while streaming and keeps its detail block on the **newest** text — but only while you are **at the bottom** of it. Scroll up and the row stops moving on its own: the stream keeps appending below and your view stays where you left it. Scroll back to the bottom and the follow resumes; opening the row again after it collapsed re-arms it. A thought that had already completed when you opened it is **history** and starts at the top. Only an **upward** scroll stops the follow: the block is scrolled and measured a frame after the text lands (and the web client re-reads the node 100ms after scrolling goes idle), so an event that merely reports a content size that grew past the row's own scroll is not the reader moving, and must not freeze the row mid-stream. Every follow scrolls twice — now and one frame later — because the content size change can arrive before the new text is laid out. The follow lasts one chunk past the end, because the last chunk arrives together with the `complete` phase. A few seconds after the thought completes it folds back to one line. The collapsed header keeps the **beginning** of the thought (220 characters on every layout), which identifies what was thought; the scan stops once the line is full, so a long thought costs no more than a short one.
- The catch-all row follows native's detail content for each type: a `write` and a `fetch` put the full path / url on the muted line above the block and the content in it, a `sub_agent` puts its log in the block (with `session <id>` above it when the provider names one), and an `unknown` detail is native's **Input / Output** groups, pretty-printed JSON with a muted heading each. A detail that is one plain string is shown as the block, with no headings — native does the same.
- Output is **clamped by the transformer** to the tail (2000 lines / 50 KB, like the providers do), and the detail block says so when the head was dropped. Providers such as pi already truncate; this keeps a provider that doesn't from pushing megabytes through the timeline on every streaming update.
- The read / edit / search rows clamp the **head** instead: a file is read from its first line, a patch from its first hunk, a result list from its first match. Dropped content is reported in a muted line under the block.
- Those three rows are not scrolled for you. Every provider seen so far reports a read, a patch or a set of matches **all at once when the call ends** (pi sends partial results only for shell output), so the block is static once it has content and starts at the top — the position you want for a file, a patch or a list. The edit row falls back to the **first edit's old/new text** (marked as such under the block) when the provider reports no patch, which is what a running edit looks like before the result lands.

## Alignment with native styles

The colors, radii, spacing, font sizes, and font stacks of the row header/detail block are copied from Paseo's own (`ExpandableBadge` in `packages/app/src/components/message.tsx`, `ShellDetailSection` in `tool-call-details.tsx`, and the tokens in `styles/theme.ts`):

```

spacing 1=4 2=8 3=12 4=16 fontSize base=14 code=12 lineHeight 18
borderRadius base=4 lg=8 borderWidth 1 timeline horizontal inset 13px
detail: vertical scroll maxHeight 400, horizontal content paddingRight 16, code block padding 12
icons: tool glyph nudge -1px, chevron 1.3x with -4px nudge
mono: SFMono-Regular, Menlo, Monaco, Consolas, … / ui-monospace

```

Behavior matched to the native badge as well:

- `memo`ized like native, and the detail block is built by a callback, so a collapsed row never renders it (a streaming collapsed row whose summary did not change does not re-render at all).
- `accessibilityState={{ expanded }}` on the pressable, plus press feedback (`opacity: 0.9`).
- The label is muted at rest, foreground when active (hover or expanded), and at `opacity: 0.72` while a call is still in flight.
- One `spacing[1]` gap under each row.

The plugin cannot read `theme.spacing` / `theme.fontSize`, so these values are hardcoded as constants at the top of `client/timeline-badge.tsx` and `client/live-*-row.tsx`.

## Implementation

```

index.client.tsx registers 6 transformers + 6 renderers
client/timeline-badge.tsx shared badge: native tokens + styles + icon slot (every row uses it)
client/detail-block.tsx shared detail block: capped vertical scroll, optional line-number gutter, meta / footnote / error lines
client/use-auto-collapse.ts open while active, fold 5s after it ends (every row)
client/use-pinned-scroll.ts follow the newest content only while the reader is at the bottom; only an upward scroll stops it (isPinnedToBottom + resolvePinned tested); shell and thinking use it
client/use-toggle.ts expand state: follows "is active", then follows the user once clicked
client/clamp-output.ts keepOutputTail() for shell output / keepOutputHead() for reads, patches and results (tested)
client/file-path.ts displayPath(): strips the agent's cwd like the native row summaries, and shortenPath(): keeps the file name when a path does not fit the header (both tested)
client/tool-item.ts runtime readers shared by the tool_call rows: asRecord / asString / describeError / readStatus / readItemCwd
client/live-shell-item.ts pure logic: read tool_call → shell data (tested)
client/live-shell-row.tsx shell row: badge + capped detail block that follows the newest output (usePinnedScroll)
client/live-read-item.ts pure logic: read tool_call → file data, lineCount / gutterNumbers / readRangeLabel (tested)
client/live-read-row.tsx read row: badge + line-numbered content
client/live-edit-item.ts pure logic: read tool_call → patch data, parseDiff / synthesizeDiff / diffStat (tested)
client/live-edit-row.tsx edit row: badge + colored diff
client/live-search-item.ts pure logic: read tool_call → results, searchMeta / searchBody (tested)
client/live-search-row.tsx search row: badge + results block
client/live-thinking-item.ts pure logic: read reasoning + liveThinkingLine() (tested)
client/live-thinking-row.tsx thinking row: badge + detail block
client/live-tool-item.ts pure logic: every other tool_call → label / icon / summary / sections, displayToolName() / isMeaningfulDetail() / detailJson() (tested)
client/live-tool-row.tsx catch-all row (write / fetch / sub_agent / plain_text / unknown): badge + sections block
shared/live-status.ts status enum shared by every row contract
shared/live-shell.ts shell row data contract (v4: adds `truncated`)
shared/live-read.ts read row data contract
shared/live-edit.ts edit row data contract
shared/live-search.ts search row data contract
shared/live-thinking.ts thinking row data contract
shared/live-tool.ts catch-all row data contract
client/host-modules.test.ts asserts no private host packages are imported (from/import/require)

```

The host-module guard (`client/host-modules.test.ts`) keeps client code on the module set Paseo hands to plugins.

Key implementation point: Paseo's `@getpaseo/protocol` is a **private** host package, and a plugin is rejected by the boundary check at install time even if it only does `import type` (that is exactly how the upstream `colorful-agent-activity` failed). So the shapes of the timeline items are **re-parsed at runtime** inside `readShellToolCall()` / `readReadToolCall()` / `readEditToolCall()` / `readSearchToolCall()` / `readReasoning()`, without importing any private types. The tool-call rows each own one transformer on `itemType: "tool_call"`: the host tries them in registration order and takes the first one that returns items, and each returns `undefined` for the detail types it does not handle.

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

- Every tool call is taken over except the ones native gives a different surface: `plan` (a `PlanCard` with approve / reject, not a badge), `worktree_setup` (native opens no details for it), `speak` (a player) and `todo_list` (a `TodoListCard`). Assistant and user messages are untouched.
- Rows that have been taken over no longer have the interactive behavior of native rows (this only does display).
- When the provider does not report incremental output / content / thinking, the row content only appears all at once at the end. That is the normal case for reads, patches and searches; only the shell row is streamed.
- No syntax highlighting: native colors reads and diffs per token with the host's highlighter, which a plugin cannot reach. The read row gets line numbers and the edit row gets one color per diff line, nothing finer.
- The edit diff is colored text, not the native `DiffViewer`: git-style patches keep their `@@` hunks as muted lines and show no line-number gutter (pi's patches carry their own numbers in the text).
- Web results in the search row are plain text, not links.
- The label shimmer native rows show while a call is loading is not reproduced: it needs the host's text measurement and gradient layers. Streaming rows use the color/opacity treatment, and `Thinking`/`Thought` carry the state.
- A row expands inline on a compact layout too, exactly like on the desktop one: native opens tool-call details in a bottom sheet there, which a plugin cannot do (the host's own `Modal` is a different sheet), so the block is inline with the native cap and the native tokens rather than a compact-only variant of them.
- `isLastInSequence` spacing (`spacing[4]` under the last row of a sequence) is host-internal, so every row gets the normal `spacing[1]` gap.
