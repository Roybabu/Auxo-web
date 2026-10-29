import { newEntityBase, type Entity } from "./entity.js";
import type { UUID } from "./ids.js";

export class DayClosingError extends Error {}

/**
 * One cash-drawer reconciliation per business day. "businessDate" is a
 * plain "YYYY-MM-DD" string (not a timestamp) so a day closing is keyed
 * by calendar day regardless of timezone drift between devices.
 */
export interface DayClosing extends Entity {
  businessDate: string;
  openingCash: number;
  /** Sum of amountPaid across the day's completed invoices, computed at closing time. */
  collectedCash: number;
  /** Sum of cash-refund returns issued that day, computed at closing time. */
  refundedCash: number;
  /** openingCash + collectedCash - refundedCash. */
  expectedCash: number;
  /** What was actually counted in the drawer. */
  countedCash: number;
  /** countedCash - expectedCash. Positive = over, negative = short. */
  variance: number;
  employeeId: UUID | null;
  note: string | null;
}

const BUSINESS_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface NewDayClosingInput {
  businessDate: string;
  openingCash: number;
  collectedCash: number;
  refundedCash: number;
  countedCash: number;
  employeeId: UUID | null;
  note?: string | null;
}

export function validateNewDayClosingInput(input: NewDayClosingInput): void {
  if (!BUSINESS_DATE_RE.test(input.businessDate)) {
    throw new DayClosingError("businessDate must be in YYYY-MM-DD form.");
  }
  if (!Number.isFinite(input.openingCash) || input.openingCash < 0) {
    throw new DayClosingError("Opening cash cannot be negative.");
  }
  if (!Number.isFinite(input.countedCash) || input.countedCash < 0) {
    throw new DayClosingError("Counted cash cannot be negative.");
  }
}

export function newDayClosing(input: NewDayClosingInput): DayClosing {
  validateNewDayClosingInput(input);
  const expectedCash = input.openingCash + input.collectedCash - input.refundedCash;
  return {
    ...newEntityBase(),
    businessDate: input.businessDate,
    openingCash: input.openingCash,
    collectedCash: input.collectedCash,
    refundedCash: input.refundedCash,
    expectedCash,
    countedCash: input.countedCash,
    variance: input.countedCash - expectedCash,
    employeeId: input.employeeId,
    note: input.note ?? null,
  };
}

/** Today's date as "YYYY-MM-DD" in the caller's local timezone. */
export function businessDateFor(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
