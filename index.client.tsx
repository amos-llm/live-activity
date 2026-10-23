import type { PluginButtonContentProps, PluginButtonRegistration, PluginClientContext, PluginWorkspacePanelProps } from "@getpaseo/plugin/client";
import { useCallback, useState } from "react";
import { BgTaskDetailBody } from "./client/bg-task-detail";
import { BgTasksPopover } from "./client/bg-tasks-popover";
import { liveShellTimelineItem } from "./client/live-shell-item";
import { LiveShellRow } from "./client/live-shell-row";
import { liveThinkingTimelineItem } from "./client/live-thinking-item";
import { LiveThinkingRow } from "./client/live-thinking-row";
import { LIVE_SHELL_KIND, LIVE_SHELL_VERSION, liveShellDataSchema } from "./shared/live-shell";
import { bgListRpc, type BgSessionTarget } from "./shared/bg-tasks";
import {
  LIVE_THINKING_KIND,
  LIVE_THINKING_VERSION,
  liveThinkingDataSchema,
} from "./shared/live-thinking";

const BG_TASKS_PILL_ID = "bg-tasks";
const BG_TASK_PANEL_PREFIX = "bg-task-"; // contribution ids must match /^[a-z][a-z0-9-]*$/ (no ':')
/** How often a not-yet-revealed session asks "has my first task started?". */
const PILL_DISCOVERY_INTERVAL_MS = 5000;

/**
 * The pi session whose tasks a pill shows: the agent's working directory plus
 * pi's own session id (Paseo records it as `persistence.sessionId`). pi writes
 * background-task state to `<cwd>/.pi/tasks/<sessionId>-<pid>/`, so both halves
 * are needed to find a session's tasks.
 */
type PillAgent = {
  id: string;
  workspaceId?: string | null;
  provider?: string | null;
  cwd?: string | null;
  persistence?: { sessionId?: string | null } | null;
};

function sessionTarget(agent: PillAgent): BgSessionTarget | null {
  const cwd = agent.cwd ?? null;
  const sessionId = agent.persistence?.sessionId ?? null;
  return cwd && sessionId ? { cwd, sessionId } : null;
}

/**
 * Replaces shell tool-call rows with a live view of their output, and reasoning
 * rows with a live view that expands while the model thinks and folds once the
 * thought is done.
 *
 * Every other item returns `undefined` from a transformer, so Paseo keeps
 * rendering its own row.
 */

/**
 * Registers a "Bg tasks" composer pill (input-box row, alongside Tasks /
 * Subagents) for every agent. The pill opens a popover listing the pi
 * background tasks, with log tails and a SIGTERM action.
 * Returns the entry's cleanup function.
 */
/**
 * The popover host only injects PluginButtonContentProps (no openScreen), so
 * a per-client wrapper component routes row taps into a workspace tab in the
 * tab bar. Each task gets its own registered panel (id `bg-task:<taskId>`);
 * opening the same task again reveals the existing tab.
 */
function contributeBgTasksPills(client: PluginClientContext): () => void {
  const panels = new Map<string, () => void>();

  const ensureTaskPanel = (taskId: string, taskName: string, target: BgSessionTarget | null): string => {
    const panelId = `${BG_TASK_PANEL_PREFIX}${taskId}`;
    if (!panels.has(panelId)) {
      const BgTaskPanel = (props: PluginWorkspacePanelProps) => (
        <BgTaskDetailBody theme={props.theme} taskId={taskId} target={target} layout={props.layout} />
      );
      const remove = client.addWorkspacePanel({
        id: panelId,
        title: taskName,
        icon: "Activity",
        context: "workspace",
        Component: BgTaskPanel,
      });
      panels.set(panelId, remove);
    }
    return panelId;
  };
  const openTaskDetail = (
    taskId: string,
    taskName: string,
    workspaceId: string,
    target: BgSessionTarget | null,
  ) => {
    client.openPanel(ensureTaskPanel(taskId, taskName, target), { workspaceId });
  };

  // Session targets by agent id, refreshed on every agent update. The popover
  // host is one stable component (props carry only ids), so it reads the map.
  const targets = new Map<string, BgSessionTarget | null>();

  function BgTasksPopoverHost(props: PluginButtonContentProps) {
    const [openError, setOpenError] = useState<string | null>(null);
    const target = props.context === "agent" ? (targets.get(props.agentId) ?? null) : null;
    const onOpenDetail = useCallback(
      (id: string, name: string) => {
        setOpenError(null);
        try {
          openTaskDetail(id, name, props.workspaceId, target);
        } catch (e: unknown) {
          setOpenError(e instanceof Error ? e.message : String(e));
        }
      },
      [props.workspaceId, target],
    );
    return <BgTasksPopover {...props} target={target} onOpenDetail={onOpenDetail} openError={openError} />;
  }
  type PillState = {
    /** null until the session's first background task is discovered. */
    registration: PluginButtonRegistration | null;
    workspaceId: string;
    target: BgSessionTarget | null;
    /** Discovery ticker; runs only while `registration` is null. */
    timer: ReturnType<typeof setInterval> | null;
    probeInFlight: boolean;
  };
  const pills = new Map<string, PillState>();
  const lifetime = new AbortController();
  let stopped = false;

  const sameTarget = (a: BgSessionTarget | null, b: BgSessionTarget | null) =>
    a === b || (a !== null && b !== null && a.cwd === b.cwd && a.sessionId === b.sessionId);

  const stopDiscovery = (state: PillState) => {
    if (state.timer === null) return;
    clearInterval(state.timer);
    state.timer = null;
  };

  const dropPill = (agentId: string) => {
    const state = pills.get(agentId);
    if (!state) return;
    stopDiscovery(state);
    state.registration?.remove();
    pills.delete(agentId);
  };

  /** Adds the composer pill for an agent. Idempotent: one pill per agent. */
  const addPill = (agentId: string, state: PillState) => {
    if (state.registration) return;
    stopDiscovery(state);
    const workspaceId = state.workspaceId;
    state.registration = client.addComposerPill({
      id: BG_TASKS_PILL_ID,
      workspaceId,
      agentId,
      button: {
        title: "Background tasks",
        icon: "ListTodo",
        label: "Bg tasks",
        visible: true,
        behavior: {
          kind: "popover",
          Content: BgTasksPopoverHost,
        },
      },
    });
  };

  /**
   * Creates the pill on the session's **first** background task and then leaves
   * it alone for good: a session that has never run one keeps the composer row
   * free, and once the pill exists it never disappears again — not when the
   * task ends, not when the run dir is cleaned up.
   *
   * The trigger has to be polled: pi only writes `<cwd>/.pi/tasks/...` on disk
   * and pushes nothing, so "is there a task?" is only answerable by asking. The
   * poll is therefore bounded — it exists solely to catch the first task and
   * stops for good the moment one is seen.
   */
  const probeForFirstTask = (agentId: string) => {
    const state = pills.get(agentId);
    if (!state || state.registration || state.probeInFlight) return;
    const target = state.target;
    // Without cwd + sessionId the task dir cannot be located; keep waiting for
    // an agent update that carries them (the ticker re-probes).
    if (!target) return;
    state.probeInFlight = true;
    void client
      .rpc(bgListRpc, target)
      .then(({ tasks }) => {
        const current = pills.get(agentId);
        // ANY task counts, not just a running one: the pill is a permanent
        // marker that this session uses background tasks.
        if (stopped || !current || current.registration || tasks.length === 0) return;
        addPill(agentId, current);
      })
      .catch(() => {
        // Unreadable task state (missing dir, permissions) looks the same as a
        // session with no tasks yet, so stay hidden and let the next tick retry.
      })
      .finally(() => {
        state.probeInFlight = false;
      });
  };

  const startDiscovery = (state: PillState, agentId: string) => {
    if (state.registration) return;
    // Re-check right away (a new target may already have tasks) and keep the
    // ticker going only until the first one shows up.
    if (state.timer === null) {
      state.timer = setInterval(() => probeForFirstTask(agentId), PILL_DISCOVERY_INTERVAL_MS);
    }
    probeForFirstTask(agentId);
  };

  const register = (agent: PillAgent) => {
    if (stopped || !agent.workspaceId) return;
    // Background tasks are a pi concept; other providers have nothing to show.
    if (agent.provider !== undefined && agent.provider !== "pi") {
      dropPill(agent.id);
      targets.delete(agent.id);
      return;
    }
    const target = sessionTarget(agent);
    targets.set(agent.id, target);
    const existing = pills.get(agent.id);
    if (existing) {
      const unchanged = existing.workspaceId === agent.workspaceId && sameTarget(existing.target, target);
      existing.target = target;
      // Agent updates arrive constantly (title, status, last message); an
      // unchanged workspace + session is the common case and must not touch the
      // registration.
      if (unchanged) return;
      // A moved session (new cwd or new pi session) needs a pill bound to the
      // new target — but once revealed, a pill stays revealed.
      if (existing.registration) {
        existing.registration.remove();
        existing.registration = null;
        existing.workspaceId = agent.workspaceId;
        addPill(agent.id, existing);
      } else {
        existing.workspaceId = agent.workspaceId;
        startDiscovery(existing, agent.id);
      }
      return;
    }
    const state: PillState = {
      registration: null,
      workspaceId: agent.workspaceId,
      target,
      timer: null,
      probeInFlight: false,
    };
    pills.set(agent.id, state);
    startDiscovery(state, agent.id);
  };
  const removePill = (agentId: string) => {
    dropPill(agentId);
    targets.delete(agentId);
  };

  void client.paseo.agents
    .list({ subscribe: {}, signal: lifetime.signal })
    .then(({ subscription }) => {
      subscription.subscribe({
        snapshot: ({ entries }) => {
          const live = new Set(entries.map(({ agent }) => agent.id));
          for (const agentId of Array.from(pills.keys())) if (!live.has(agentId)) removePill(agentId);
          for (const agentId of Array.from(targets.keys())) if (!live.has(agentId)) targets.delete(agentId);
          for (const { agent } of entries) register(agent);
        },
        update: (message) => {
          if (message.type !== "agent_update") return;
          const update = message.payload;
          if (update.kind === "remove") removePill(update.agentId);
          else register(update.agent);
        },
      });
      return undefined;
    })
    .catch((error) => {
      if (!stopped) console.error("Agent observation failed", error);
    });

  return () => {
    stopped = true;
    lifetime.abort();
    for (const agentId of Array.from(pills.keys())) dropPill(agentId);
    targets.clear();
    for (const remove of panels.values()) remove();
    panels.clear();
  };
}

export default function contribute(client: PluginClientContext) {
  client.addTimelineTransformer({
    id: "live-shell",
    query: { itemType: "tool_call" },
    transform({ item }) {
      return liveShellTimelineItem(item);
    },
  });

  client.addTimelineRenderer({
    kind: LIVE_SHELL_KIND,
    version: LIVE_SHELL_VERSION,
    schema: liveShellDataSchema,
    Component: LiveShellRow,
  });

  client.addTimelineTransformer({
    id: "live-thinking",
    query: { itemType: "reasoning" },
    transform({ item, phase }) {
      return liveThinkingTimelineItem(item, phase);
    },
  });

  client.addTimelineRenderer({
    kind: LIVE_THINKING_KIND,
    version: LIVE_THINKING_VERSION,
    schema: liveThinkingDataSchema,
    Component: LiveThinkingRow,
  });

  const removeBgTasksPills = contributeBgTasksPills(client);

  return () => {
    removeBgTasksPills();
  };
}
