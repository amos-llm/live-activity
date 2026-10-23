import type { PluginScreenProps } from "@getpaseo/plugin/client";
import { useRpc } from "@getpaseo/plugin/client";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { bgKillRpc, bgListRpc, bgLogRpc, type BgSessionTarget } from "../shared/bg-tasks";
import { bgListQueryKey, bgLogQueryKey } from "./bg-task-query";
import { fmtDuration, fmtTime } from "./bg-task-format";
import { useNow } from "./use-now";

const CONTAINER_STYLE = { gap: 12 } as const;
const ROW_STYLE = { flexDirection: "row" as const, alignItems: "center" as const, gap: 8 };
const GRID_STYLE = { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 6 } as const;
const LOG_SECTION_STYLE = { gap: 4 } as const;
const LOG_MAX_HEIGHT = 420;
const DOT_STYLE = { width: 10, height: 10, borderRadius: 5 } as const;

/**
 * Detail body for one background task: status dot, meta chips, command, cwd,
 * error, SIGTERM, and a 32KB log tail — all polled every 5 seconds.
 */
export function BgTaskDetailBody({
  theme,
  taskId,
  target,
  layout,
}: {
  theme: PluginScreenProps["theme"];
  taskId: string;
  target: BgSessionTarget | null;
  layout?: { compact?: boolean };
}) {
  const fetchList = useRpc(bgListRpc);
  const fetchLog = useRpc(bgLogRpc);
  const fetchKill = useRpc(bgKillRpc);
  const [notice, setNotice] = useState<string | null>(null);

  const metaQuery = useQuery({
    queryKey: bgListQueryKey(target),
    queryFn: useCallback(() => {
      if (!target) throw new Error("session unknown");
      return fetchList(target);
    }, [fetchList, target]),
    refetchInterval: 5000,
    enabled: Boolean(taskId) && target !== null,
  });
  const logQuery = useQuery({
    queryKey: bgLogQueryKey(target, taskId),
    queryFn: useCallback(() => {
      if (!target) throw new Error("session unknown");
      return fetchLog({ ...target, id: taskId, bytes: 32 * 1024 });
    }, [fetchLog, target, taskId]),
    refetchInterval: 5000,
    enabled: Boolean(taskId) && target !== null,
  });

  const styles = useMemo(
    () => ({
      heading: { color: theme.colors.foreground, fontSize: 16, fontWeight: "700" as const, flexShrink: 1 },
      dim: { color: theme.colors.foregroundMuted, fontSize: 11 },
      mono: { color: theme.colors.foregroundMuted, fontSize: 11, fontFamily: "monospace" as const },
      error: { color: theme.colors.statusDanger, fontSize: 12 },
      chip: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        backgroundColor: theme.colors.surface1,
        borderColor: theme.colors.border,
        borderWidth: 1,
      },
      chipText: { color: theme.colors.foreground, fontSize: 11 },
      sectionTitle: {
        color: theme.colors.foregroundMuted,
        fontSize: 11,
        textTransform: "uppercase" as const,
        letterSpacing: 0.5,
      },
      logBox: {
        backgroundColor: theme.colors.surface1,
        borderColor: theme.colors.border,
        borderWidth: 1,
        borderRadius: 8,
        padding: 10,
        minHeight: 80,
        maxHeight: LOG_MAX_HEIGHT,
      },
      killChip: {
        flexShrink: 0,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        backgroundColor: theme.colors.surface1,
        borderColor: theme.colors.statusDanger,
        borderWidth: 1,
      },
      killChipText: { color: theme.colors.statusDanger, fontSize: 11, fontWeight: "600" as const },

      notice: { color: theme.colors.statusWarning, fontSize: 12 },
      missing: { color: theme.colors.foregroundMuted, fontSize: 13 },
    }),
    [theme],
  );

  const task = metaQuery.data?.tasks.find((t) => t.id === taskId);
  const isPending = metaQuery.isPending || logQuery.isPending;
  // The elapsed chip is driven by its own 1s clock, not by the 5s poll: polled
  // data is deep-equal while a task runs, so nothing would re-render meanwhile.
  const now = useNow(1000, task?.status === "running");

  const dotStyle = useMemo(
    () => ({
      ...DOT_STYLE,
      backgroundColor:
        task?.status === "running"
          ? theme.colors.accent
          : task?.status === "completed"
            ? theme.colors.statusSuccess
            : task?.status === "failed"
              ? theme.colors.statusDanger
              : task?.status === "killed"
                ? theme.colors.statusWarning
                : theme.colors.foregroundMuted,
    }),
    [theme, task?.status],
  );

  const handleKill = useCallback(() => {
    if (!taskId || !target) return;
    setNotice(null);
    void fetchKill({ ...target, id: taskId })
      .then((result) => setNotice(result.sent ? `SIGTERM → pid ${result.pid}` : result.note ?? "kill failed"))
      .catch((e: Error) => setNotice(e.message));
  }, [fetchKill, target, taskId]);

  const containerStyle = useMemo(
    () => ({ ...CONTAINER_STYLE, padding: layout?.compact ? 12 : 16 }),
    [layout?.compact],
  );

  return (
    <ScrollView contentContainerStyle={containerStyle}>
      {isPending ? <Text style={styles.missing}>loading {taskId}…</Text> : null}
      {!target ? <Text style={styles.notice}>Session unknown — cannot locate this agent's pi task state.</Text> : null}
      {metaQuery.error ? (
        <Text style={styles.error}>{metaQuery.error instanceof Error ? metaQuery.error.message : "rpc failed"}</Text>
      ) : null}
      {task === undefined ? (
        !metaQuery.isPending && (
          <Text style={styles.missing}>Task {taskId} not found in this session's task directory ({target?.cwd}/.pi/tasks).</Text>
        )
      ) : (
        <>
          <View style={ROW_STYLE}>
            <View style={dotStyle} />
            <Text style={styles.heading} numberOfLines={1}>
              {task.name}
            </Text>
            {task.status === "running" && task.pid ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Send SIGTERM"
                onPress={handleKill}
                style={styles.killChip}
              >
                <Text style={styles.killChipText}>SIGTERM</Text>
              </Pressable>
            ) : null}
          </View>
          <Text style={styles.mono}>{task.command}</Text>
          <View style={GRID_STYLE}>
            <View style={styles.chip}>
              <Text style={styles.chipText}>{task.status}</Text>
            </View>
            <View style={styles.chip}>
              <Text style={styles.chipText}>{task.isAgent ? "agent" : "shell"}</Text>
            </View>
            <View style={styles.chip}>
              <Text style={styles.chipText}>
                {fmtTime(task.startTime)} · {fmtDuration(task.startTime, task.endTime ?? now)}
              </Text>
            </View>
            {task.exitCode !== null ? (
              <View style={styles.chip}>
                <Text style={styles.chipText}>exit {task.exitCode}</Text>
              </View>
            ) : null}
            {task.pid !== null ? (
              <View style={styles.chip}>
                <Text style={styles.chipText}>pid {task.pid}</Text>
              </View>
            ) : null}
            {task.timeoutSeconds !== null ? (
              <View style={styles.chip}>
                <Text style={styles.chipText}>timeout {task.timeoutSeconds}s</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.dim}>cwd: {task.cwd}</Text>
          {task.error ? <Text style={styles.error}>{task.error}</Text> : null}
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
          <View style={LOG_SECTION_STYLE}>
            <Text style={styles.sectionTitle}>
              output {task.hasOutput ? `(${Math.round(task.bytesWritten / 1024)}KB on disk, tail)` : "(no output file)"}
            </Text>
            <ScrollView nestedScrollEnabled style={styles.logBox}>
              <Text style={styles.mono}>{logQuery.data?.text || "(empty)"}</Text>
            </ScrollView>
          </View>
        </>
      )}
    </ScrollView>
  );
}
