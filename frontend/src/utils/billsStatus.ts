export type BillComputedStatus = "paid" | "overdue" | "due_soon" | "upcoming";

export interface Bill {
  bill_id: string;
  name: string;
  merchant?: string | null;
  expected_amount: number;
  frequency: "monthly" | "weekly" | "annual";
  due_day: number;
  auto_detected: boolean;
  linked_expense_ids: string[];
  status: "active" | "paused";
  created_at: string;
  profile_id: string;
  user_id: string;
}

/** Clamp due_day to actual days in current month. */
export function getEffectiveDueDay(dueDay: number): number {
  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  return Math.min(dueDay, daysInMonth);
}

/** Get the due date for the current month. */
export function getDueDateThisMonth(dueDay: number): Date {
  const today = new Date();
  const effectiveDueDay = getEffectiveDueDay(dueDay);
  return new Date(today.getFullYear(), today.getMonth(), effectiveDueDay);
}

/** Compute display status from bill data (frontend-only, no API call). */
export function computeBillStatus(bill: Bill): BillComputedStatus {
  const today = new Date();
  const todayDay = today.getDate();
  const effectiveDueDay = getEffectiveDueDay(bill.due_day);

  // Paid: has linked expenses (proxy for "paid this cycle")
  if ((bill.linked_expense_ids || []).length > 0) return "paid";

  const daysUntil = effectiveDueDay - todayDay;
  if (daysUntil < 0) return "overdue";
  if (daysUntil <= 3) return "due_soon";
  return "upcoming";
}

/** Count of bills due within the next 7 days (unpaid). */
export function countDueSoonBills(bills: Bill[]): number {
  const today = new Date();
  const todayDay = today.getDate();
  return bills.filter((b) => {
    if ((b.linked_expense_ids || []).length > 0) return false;
    if (b.status !== "active") return false;
    const effectiveDue = getEffectiveDueDay(b.due_day);
    const daysUntil = effectiveDue - todayDay;
    return daysUntil >= 0 && daysUntil <= 7;
  }).length;
}
