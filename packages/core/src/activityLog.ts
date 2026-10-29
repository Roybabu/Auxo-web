import { newEntityBase, type Entity } from "./entity.js";
import type { UUID } from "./ids.js";

export class ActivityLogError extends Error {}

/**
 * An append-only audit trail entry. "action" is a short dot-namespaced
 * machine code (e.g. "sale.completed", "product.created") for future
 * filtering; "summary" is the human-readable line shown in the UI.
 * Entries are never edited or deleted — only ever appended.
 */
export interface ActivityLog extends Entity {
  employeeId: UUID | null;
  action: string;
  summary: string;
  /** Optional small set of extra details (e.g. { invoiceNumber: "A1-000001" }). Strings only, kept flat and simple. */
  metadata: Record<string, string> | null;
}

export interface NewActivityLogInput {
  employeeId: UUID | null;
  action: string;
  summary: string;
  metadata?: Record<string, string> | null;
}

export function validateNewActivityLogInput(input: NewActivityLogInput): void {
  if (input.action.trim().length === 0) {
    throw new ActivityLogError("Activity log action is required.");
  }
  if (input.summary.trim().length === 0) {
    throw new ActivityLogError("Activity log summary is required.");
  }
}

export function newActivityLog(input: NewActivityLogInput): ActivityLog {
  validateNewActivityLogInput(input);
  return {
    ...newEntityBase(),
    employeeId: input.employeeId,
    action: input.action.trim(),
    summary: input.summary.trim(),
    metadata: input.metadata ?? null,
  };
}
