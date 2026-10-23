import type { PluginServerContext } from "@getpaseo/plugin/server";
import { createBgKillHandler, createBgListHandler, createBgLogHandler } from "./server/bg-tasks-handlers";
import { bgKillRpc, bgListRpc, bgLogRpc } from "./shared/bg-tasks";

/**
 * Read-only view over the pi runtime's background tasks, which pi writes as
 * plain JSON next to its sessions under `<cwd>/.pi/tasks/<sessionId>-<pid>/`.
 * The handlers read that directory only; pi itself is unaware of this plugin.
 */
export default function contribute(server: PluginServerContext) {
  server.handle(bgListRpc, createBgListHandler());
  server.handle(bgLogRpc, createBgLogHandler());
  server.handle(bgKillRpc, createBgKillHandler());
  return () => {};
}
