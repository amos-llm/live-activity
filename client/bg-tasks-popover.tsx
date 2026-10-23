import type { PluginButtonContentProps } from "@getpaseo/plugin/client";
import { useRpc } from "@getpaseo/plugin/client";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { bgListRpc, type BgSessionTarget, type BgTaskMeta } from "../shared/bg-tasks";
import { bgListQueryKey } from "./bg-task-query";
import { fmtDuration, fmtTime } from "./bg-task-format";
import { useNow } from "./use-now";

const ROW_CONTAINER_STYLE = { paddingVertical: 6, gap: 2 } as const;
const ROW_HEADER_STYLE = { flexDirection: "row" as const, alignItems: "center" as const, gap: 6 };
const DOT_BASE_STYLE = { width: 8, height: 8, borderRadius: 4 } as const;
const LIST_CONTAINER_STYLE = { gap: 0 } as const;

interface BgTaskRowProps {
  task: BgTaskMeta;
  theme: PluginButtonContentProps["theme"];
  now: number;
  onOpen: (id: string, name: string) => void;
}

function BgTaskRow({ task, theme, now, onOpen }: BgTaskRowProps) {
  const styles = useMemo(() => {
    const muted = theme.colors.foregroundMuted;
    const dotColor =
      task.status === "running"
        ? theme.colors.accent
        : task.status === "completed"
          ? theme.colors.statusSuccess
          : task.status === "failed"
            ? theme.colors.statusDanger
            : task.status === "killed"
              ? theme.colors.statusWarning
              : muted;
    return {
      dot: { ...DOT_BASE_STYLE, backgroundColor: dotColor },
      name: { color: theme.colors.foreground, fontWeight: "600" as const, flexShrink: 1 },
      kind: { color: muted, fontSize: 11 },
      timing: { color: muted, fontSize: 11, flex: 1 },
      command: { color: muted, fontSize: 12 },
      error: { color: theme.colors.statusDanger, fontSize: 11 },
    };
  }, [theme, task.status]);

  const handleOpen = useCallback(() => {
    onOpen(task.id, task.name);
  }, [onOpen, task.id, task.name]);

  const metaLine = `${fmtTime(task.startTime)} · ${fmtDuration(task.startTime, task.endTime ?? now)}${
    task.exitCode !== null ? ` · exit ${task.exitCode}` : ""
  }`;

  const body = (
    <>
      <View style={ROW_HEADER_STYLE}>
        <View style={styles.dot} />
        <Text style={styles.name} numberOfLines={1}>
          {task.name}
        </Text>
        <Text style={styles.kind}>{task.isAgent ? "agent" : "shell"}</Text>
        <Text style={styles.timing} numberOfLines={1}>
          {metaLine}
        </Text>
      </View>
      <Text style={styles.command} numberOfLines={1}>
        {task.command}
      </Text>
      {task.error ? (
        <Text style={styles.error} numberOfLines={1}>
          {task.error}
        </Text>
      ) : null}
    </>
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open details for ${task.name}`}
      onPress={handleOpen}
      style={ROW_CONTAINER_STYLE}
    >
      {body}
    </Pressable>
  );
}

/**
 * Composer-pill popover body. The host owns anchoring, scrolling, padding, and
 * the sheet presentation (280–420px wide, 440px tall, scrollable), so this is
 * just a compact list of running tasks. Tapping a row opens the task as a
 * workspace tab in the tab bar.
 */
export function BgTasksPopover({
  theme,
  target,
  onOpenDetail,
  openError,
}: PluginButtonContentProps & {
  target: BgSessionTarget | null;
  onOpenDetail: (id: string, name: string) => void;
  openError?: string | null;
}) {
  const fetchList = useRpc(bgListRpc);

  const { data, error, refetch, isFetching } = useQuery({
    queryKey: bgListQueryKey(target),
    queryFn: useCallback(() => {
      if (!target) throw new Error("session unknown");
      return fetchList(target);
    }, [fetchList, target]),
    enabled: target !== null,
    refetchInterval: 5000,
  });

  const styles = useMemo(
    () => ({
      title: { color: theme.colors.foreground, fontWeight: "600" as const, flexShrink: 1 },
      meta: { color: theme.colors.foregroundMuted, fontSize: 11 },
      row: {
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
      },
      notice: { color: theme.colors.statusDanger, fontSize: 11 },
      refresh: { padding: 2 },
      refreshText: { color: theme.colors.accent, fontSize: 12 },
      empty: { color: theme.colors.foregroundMuted },
    }),
    [theme],
  );

  const handleRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  const handleOpenDetail = useCallback(
    (id: string, name: string) => {
      onOpenDetail(id, name);
    },
    [onOpenDetail],
  );

  const running = data?.tasks.filter((task) => task.status === "running") ?? [];
  // Same reason as the detail tab: polled rows are deep-equal while running, so
  // the per-row elapsed label needs its own 1s clock to keep counting.
  const now = useNow(1000, running.length > 0);

  return (
    <View style={LIST_CONTAINER_STYLE}>
      <View style={ROW_HEADER_STYLE}>
        <Text style={styles.title}>Background tasks</Text>
        {data ? (
          <Text style={styles.meta}>{running.length}</Text>
        ) : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Refresh" onPress={handleRefresh} style={styles.refresh}>
          <Text style={styles.refreshText}>{isFetching ? "…" : "refresh"}</Text>
        </Pressable>
      </View>
      {openError ? <Text style={styles.notice}>open failed: {openError}</Text> : null}
      {error ? <Text style={styles.notice}>{error instanceof Error ? error.message : "rpc failed"}</Text> : null}
      {!target ? <Text style={styles.empty}>Session unknown — cannot locate this agent's pi task state.</Text> : null}
      {running.map((task) => (
        <View key={`${task.sessionId}-${task.id}`} style={styles.row}>
          <BgTaskRow task={task} theme={theme} now={now} onOpen={handleOpenDetail} />
        </View>
      ))}
      {data && running.length === 0 ? <Text style={styles.empty}>No running tasks</Text> : null}
    </View>
  );
}
