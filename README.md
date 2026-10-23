# live-activity

Makes two kinds of Paseo timeline rows **visible in real time**, and adds a **"Bg tasks" composer pill** that opens a popover for **pi's background tasks**:

| Row                      | Native behavior                                     | This plugin                                                                    |
| ------------------------ | --------------------------------------------------- | ------------------------------------------------------------------------------ |
| **shell tool calls**     | Output is only easy to read when finished           | Auto-expands while running, output grows as it runs; auto-collapses when done  |
| **thinking (reasoning)** | Collapsed, so you can't tell if the model is moving | Auto-expands while the model thinks, reasoning visible as it streams; auto-collapses when done |

Plus: a **"Bg tasks" composer pill** (input-box row, alongside Tasks / Subagents) whose label carries the number of **running** background tasks (`Bg tasks 2`), and that opens a **popover** listing pi's running `bg_run` / `bg_delegate` tasks; tapping a row opens a detail tab with live log tail and a SIGTERM action — see below.

## What it looks like

Shell row (auto-expanded while running):

```
▾ Shell  npm run build
  ┌────────────────────────────────────────┐
  │ $ npm run build                        │
  │                                        │
  │ compiled 128 modules in 1.2s           │
  │ done in 1.8s                           │  ← refreshes as it runs, capped at 400px
  │                                        │
  └────────────────────────────────────────┘

Shell row (auto-collapsed when finished; failure is shown by the alert icon):

```

▸ Shell ffmpeg -i in.mp4 out.mkv

```

Thinking row (auto-expanded while the model is thinking; follows the newest text until you scroll up):

```

▾ Thought Check whether Paseo's ACP adapter maps partialResult into the timeline…
  ┌────────────────────────────────────────┐
  │ Check whether Paseo's ACP adapter maps  │
  │ partialResult into the timeline. If it  │
  │ does, reasoning updates arrive per      │  ← follows the newest text while you are at the bottom (capped at 400px)
  │ chunk and the row can stay live.        │
  └────────────────────────────────────────┘

```

Thinking row (auto-collapsed a few seconds after the thought ends; the header keeps the start of the thought on one line):

```

🧠 Thought Check whether Paseo's ACP adapter maps partialResult into the timeli…

```

In both cases you can click to see the full content (the full output for shell, the full thinking text for thinking).

## Behavior details

- **A row expands by itself while its content is still growing** — the shell command while it runs, the thought while the model thinks — and auto-collapses 5s after it ends; clicking toggles it manually (once you click, that row follows you and no longer changes automatically). Rows mounted already finished start collapsed.
- When expanded, the row header takes a `surface1` background and joins the detail block below into one unit; when collapsed it is **completely borderless** (matching the native badge).
- Status is shown by icon only in the header, never by word (no `failed` / `canceled`): `TriangleAlert` (danger) on failure, `Ban` (muted) when canceled. The detail block carries the facts instead — a non-zero-safe `exit N` line and the error message, both only visible once expanded. Other icons use their lucide names: `SquareTerminal` for shell, `Brain` for thinking, and a 90°-rotated `ChevronRight` on hover/expand (natively the arrow only appears on hover).
- While running, the command wraps across as many lines as it needs; once the command ends, the collapsed row keeps it on **one line with a trailing ellipsis**.
- The detail block is the native one: a **capped vertical scroll** (400px, 260px on a compact layout) around a horizontal scroll for unwrapped lines, so a chatty build never pushes the timeline off screen. Its content is the command and output in one monospace block prefixed by a muted `$ `.
- The thinking row expands while streaming and keeps its detail block on the **newest** text — but only while you are **at the bottom** of it. Scroll up and the row stops moving on its own: the stream keeps appending below and your view stays where you left it. Scroll back to the bottom and the follow resumes; opening the row again after it collapsed re-arms it. A few seconds after the thought completes it folds back to one line. The collapsed header keeps the **beginning** of the thought (220 characters, 120 on a compact layout), which identifies what was thought; the scan stops once the line is full, so a long thought costs no more than a short one.
- Output is **clamped by the transformer** to the tail (2000 lines / 50 KB, like the providers do), and the detail block says so when the head was dropped. Providers such as pi already truncate; this keeps a provider that doesn't from pushing megabytes through the timeline on every streaming update.

## Background tasks popover

Paseo sees pi's *sessions* (agents), but not pi's internal background tasks (`bg_run`, `bg_delegate`, subagent workflows). pi writes those to `<cwd>/.pi/tasks/<sessionId>-<pid>/<id>.json` (one folder per pi process, `cwd` = the agent's working directory) with a sibling `<id>.output` log — the plugin reads exactly that, so no pi-side change is needed. Each pill is scoped to **its own agent's session**: the client takes `cwd` + `persistence.sessionId` from the agent snapshot it already subscribes to, and the server lists only run dirs whose name starts with that session id, so a workspace's other sessions stay invisible. The pill's **label carries the live count of running tasks** (`Bg tasks 2`; plain `Bg tasks` at zero), so the count is readable without opening the popover. The popover shows **running tasks only**; tapping a row opens the task as a **tab in the workspace tab bar** (per-task workspace panel: status, command, cwd, exit info, live log tail, SIGTERM). The pill is **created lazily — on the session's first background task — and then kept forever**: a session that has never run one keeps the composer row free (no button at all), and once a task has been seen the pill stays, whether that task is still running, finished, or its run dir is gone. Both jobs need a poll (pi pushes nothing, it only writes `.pi/tasks`), so a per-session 5s ticker reads the task list for the agent's whole lifetime: it creates the pill at the first task it sees, and afterwards repaints the label only when the running count actually changes (a status update on an unchanged count never touches the registration, so the composer row does not re-render). The popover polls the same list at the same 5s cadence while it is open (`client/bg-tasks-popover.tsx`) — a task's detail tab, once opened, stays in the tab bar.

- **List** (`index.server.ts` → `server/bg-tasks.ts`, scanned in the daemon's Node subprocess): every task's name, command, status (`pending` / `running` / `completed` / `failed` / `killed`), exit code, signal, pid, cwd, agent flag, and size. Unknown statuses are skipped; a session with no run dir yet yields an empty list.
- **Live clock**: a running task's elapsed chip is driven by a local 1s ticker (`client/use-now.ts`), not by the 5s poll — pi keeps the task json byte-identical while the task runs, so polled data is deep-equal and would never re-render.
- **Log tail**: the detail tab polls the list and, for the selected task, fetches the last 32KB of `<id>.output` (the truncation is marked in the UI).
- **Kill**: sends `SIGTERM` directly to the recorded pid. This *bypasses pi on purpose* — the plugin observes pi's on-disk state and acts on the process. It refuses tasks that are not `running` and reports when no pid is recorded.

### Layout

```
index.client.tsx per-agent composer pill (ListTodo icon, "Bg tasks <running>" label refreshed by a 5s task-list poll; popover behavior; created on the session's first task, then permanent)
index.server.ts        new: contributes live-activity.list / .log / .kill RPCs
client/bg-tasks-popover.tsx  BgTasksPopover / BgTaskRow / BgLogView (5s polling; popover body)
client/bg-task-detail.tsx    BgTaskDetailBody (detail tab: chips, live log tail, SIGTERM)
client/bg-task-query.ts      react-query keys scoped by session target
client/use-now.ts            useNow(intervalMs, enabled) — 1s clock for running tasks
server/bg-tasks.ts     pure fs logic: sessionTasksHome / sessionTaskDirs / listTasks / tailLog / killTask (tested)
server/bg-tasks-handlers.ts  createBgListHandler / createBgLogHandler / createBgKillHandler
shared/bg-tasks.ts     rpc definitions + BgTaskMeta + BgSessionTarget contracts
```

The host-module guard (`client/host-modules.test.ts`) allows `@getpaseo/plugin/server` and `node:*` imports **only** in `index.server.ts` and `server/` files; client code stays on the host-provided module set.

The popover is hosted by Paseo's button surface: anchored to the pill on wide layouts (a bottom sheet on compact), 280–420px wide, 440px tall, scrollable, with 12px padding. The component renders only the body — a compact list of running tasks; the log tail and kill live in the detail tab.

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

index.client.tsx registers 2 transformers + 2 renderers + per-agent composer pills (popover behavior, live running-count label)
client/timeline-badge.tsx shared badge: native tokens + styles + icon slot (both rows use it)
client/use-auto-collapse.ts open while active, fold 5s after it ends (both rows)
client/use-pinned-scroll.ts follow the newest content only while the reader is at the bottom (isPinnedToBottom tested)
client/use-toggle.ts expand state: follows "is active", then follows the user once clicked
client/live-shell-item.ts pure logic: read tool_call → shell data, keepOutputTail() (tested)
client/live-shell-row.tsx shell row: badge + capped detail block
client/live-thinking-item.ts pure logic: read reasoning + liveThinkingLine() (tested)
client/live-thinking-row.tsx thinking row: badge + detail block
shared/live-shell.ts shell row data contract (v4: adds `truncated`)
shared/live-thinking.ts thinking row data contract
client/host-modules.test.ts asserts no private host packages are imported (from/import/require; server entries may use node:*)

````

Key implementation point: Paseo's `@getpaseo/protocol` is a **private** host package, and a plugin is rejected by the boundary check at install time even if it only does `import type` (that is exactly how the upstream `colorful-agent-activity` failed). So the shapes of the timeline items are **re-parsed at runtime** inside `readShellToolCall()` / `readReasoning()`, without importing any private types.

## Install / develop

Zero runtime dependencies (only host modules Paseo provides: `@getpaseo/plugin/*`, `react`, `react-native`, `zod`), so **a Git install also works directly** (Paseo's Git install does not run a package manager):

```bash
paseo plugin add <git-remote>:live-activity
paseo plugin reload live-activity
````

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
- The label shimmer native rows show while a call is loading is not reproduced: it needs the host's text measurement and gradient layers. Streaming rows use the color/opacity treatment, and `Thinking`/`Thought` carry the state.
- On a compact layout native opens tool-call details in a bottom sheet; this plugin always renders them inline (with a smaller 260px cap and a shorter thinking line) because plugins cannot open that sheet.
- `isLastInSequence` spacing (`spacing[4]` under the last row of a sequence) is host-internal, so every row gets the normal `spacing[1]` gap.
- Background tasks: the kill button sends `SIGTERM` to the recorded pid directly (bypassing pi); if that pid has been recycled by the OS the kill will fail and the UI shows the error. Tasks are visible only while the agent's own `<cwd>/.pi/tasks` exists (pi writes it), and only for the agent's own pi session; if Paseo has no `persistence.sessionId` for the agent yet, the popover says so instead of guessing.
