import { Expense } from "../types";

export function filterTransactionsForMonth(
  expenses: Expense[],
  month: number,
  year: number,
): Expense[];
export function searchTransactions(
  expenses: Expense[],
  query: string,
  categoryNameById?: Record<string, string>,
): Expense[];
export function upsertTransaction(expenses: Expense[], nextExpense: Expense): Expense[];
export function removeTransaction(expenses: Expense[], expenseId: string): Expense[];
export function deriveVisibleTransactions(params: {
  expenses: Expense[];
  month: number;
  year: number;
  searchQuery: string;
  txType?: string;
  categoryNameById?: Record<string, string>;
}): Expense[];
export function buildTransactionRowHandlers(params: {
  expense: Expense;
  onPress?: (expense: Expense) => void;
  onEdit?: (expense: Expense) => void;
  onDelete?: (expense: Expense) => void;
}): { onPress: () => void; onEdit: () => void; onDelete: () => void };
export function deriveTransactionEmptyState(params: {
  hasFiltersApplied: boolean;
  filteredCount: number;
}): { title: string; subtitle: string; showClearFilters: boolean };
export function shouldCloseDetailModalAfterDelete(params: {
  selectedExpenseId?: string;
  deletedExpenseId?: string;
}): boolean;
export function shouldResetTransactionDetailOnProfileChange(params: {
  previousProfileId?: string | null;
  nextProfileId?: string | null;
  isDetailModalOpen: boolean;
}): boolean;
export function buildTransactionExportIntentParams(params: {
  activeProfileId?: string;
  month: number;
  year: number;
}): { intent: string; profile_id: string; month: string; year: string; month_start: string } | null;
