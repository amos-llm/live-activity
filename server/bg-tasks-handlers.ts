import type { RpcInput } from "@getpaseo/plugin";
import { bgKillRpc, bgListRpc, bgLogRpc } from "../shared/bg-tasks";
import { killTask, listTasks, sessionTaskDirs, sessionTasksHome, tailLog } from "./bg-tasks";

export function createBgListHandler() {
  return async (input: RpcInput<typeof bgListRpc>) => {
    const tasksDir = sessionTasksHome(input.cwd);
    const sessionDirs = await sessionTaskDirs(tasksDir, input.sessionId);
    const tasks = await listTasks(sessionDirs, input.sessionId);
    return { tasksDir, sessionDirs, count: tasks.length, tasks };
  };
}

export function createBgLogHandler() {
  return async (input: RpcInput<typeof bgLogRpc>) => {
    const dirs = await sessionTaskDirs(sessionTasksHome(input.cwd), input.sessionId);
    const text = await tailLog(dirs, input.id, input.bytes ?? 16 * 1024);
    return { text };
  };
}

export function createBgKillHandler() {
  return async (input: RpcInput<typeof bgKillRpc>) => {
    const dirs = await sessionTaskDirs(sessionTasksHome(input.cwd), input.sessionId);
    return killTask(dirs, input.id);
  };
}
