import { newActivityLog, type NewActivityLogInput } from "@auxo/core";
import { getRepositories } from "./repositories.js";

/**
 * Records an audit-trail entry. Swallows its own errors — a logging
 * failure should never surface as a user-facing error for the action
 * that triggered it, so callers fire-and-forget this after their own
 * save succeeds rather than wrapping it in their try/catch.
 */
export async function logActivity(input: NewActivityLogInput): Promise<void> {
  try {
    const repos = getRepositories();
    await repos.activityLogs.save(newActivityLog(input));
  } catch (err) {
    console.error("Failed to record activity log entry", err);
  }
}
