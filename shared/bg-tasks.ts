import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

export const bgTaskStatus = z.enum(["pending", "running", "completed", "failed", "killed"]);

/**
 * Which pi session's tasks to read. pi's background-task extension writes each
 * session's state to `<cwd>/.pi/tasks/<sessionId>-<pid>/`, so a task list is
 * always scoped to a single agent session — there is no global tasks directory.
 * `cwd` is the agent's working directory and `sessionId` is pi's session id
 * (Paseo exposes it as `agent.persistence.sessionId`).
 */
export const bgSessionTarget = z.object({
  cwd: z.string().min(1),
  sessionId: z.string().min(1),
});
export type BgSessionTarget = z.infer<typeof bgSessionTarget>;

export type BgTaskMeta = {
  id: string;
  name: string;
  command: string;
  status: z.infer<typeof bgTaskStatus>;
  cwd: string;
  sessionId: string;
  startTime: number;
  endTime: number | null;
  exitCode: number | null;
  signal: string | null;
  pid: number | null;
  isAgent: boolean;
  bytesWritten: number;
  hasOutput: boolean;
  error: string | null;
  notified: boolean;
  timeoutSeconds: number | null;
};

export const bgListRpc = defineRpc({
  name: "live-activity.list",
  input: bgSessionTarget,
  output: z.object({
    tasksDir: z.string(),
    sessionDirs: z.array(z.string()),
    count: z.number().int().nonnegative(),
    tasks: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        command: z.string(),
        status: bgTaskStatus,
        cwd: z.string(),
        sessionId: z.string(),
        startTime: z.number().int(),
        endTime: z.number().int().nullable(),
        exitCode: z.number().int().nullable(),
        signal: z.string().nullable(),
        pid: z.number().int().nullable(),
        isAgent: z.boolean(),
        bytesWritten: z.number().int(),
        hasOutput: z.boolean(),
        error: z.string().nullable(),
        notified: z.boolean(),
        timeoutSeconds: z.number().int().nullable(),
      }),
    ),
  }),
});

export const bgLogRpc = defineRpc({
  name: "live-activity.log",
  input: bgSessionTarget.extend({
    id: z.string().min(1),
    bytes: z.number().int().min(256).max(65536).optional(),
  }),
  output: z.object({ text: z.string() }),
});

export const bgKillRpc = defineRpc({
  name: "live-activity.kill",
  input: bgSessionTarget.extend({ id: z.string().min(1) }),
  output: z.object({ sent: z.boolean(), pid: z.number().int().nullable(), note: z.string().nullable() }),
});
