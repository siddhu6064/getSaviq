// Shared Utility Functions for SAVIQ
// Used by both Web and Mobile apps

/**
 * The user's preferred display currency (ISO 4217 code), set once from
 * `/settings` on app load. This is a display/formatting preference only —
 * amounts are not converted between currencies, just relabeled/reformatted.
 */
let activeCurrency = "USD";

export function setActiveCurrency(currency: string | undefined | null): void {
  if (currency) activeCurrency = currency;
}

export function getActiveCurrency(): string {
  return activeCurrency;
}

/**
 * Format currency amount. Defaults to the app-wide preferred currency (see
 * `setActiveCurrency`) rather than hardcoding USD, so every existing call
 * site picks up the user's currency preference without needing to pass it
 * explicitly.
 */
export function formatCurrency(amount: number, currency: string = activeCurrency): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
  }).format(amount);
}

/**
 * Format date to readable string
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

/**
 * Format short date (month + day only)
 */
export function formatShortDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

/**
 * Format time string (HH:MM to readable)
 */
export function formatTime(timeString: string): string {
  if (!timeString) return "";
  const [hours, minutes] = timeString.split(":");
  const date = new Date();
  date.setHours(parseInt(hours), parseInt(minutes));
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

/**
 * Calculate percentage
 */
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100 * 10) / 10;
}

/**
 * Group transactions by date
 */
export function groupByDate<T extends { date: string }>(items: T[]): Record<string, T[]> {
  return items.reduce(
    (groups, item) => {
      const date = new Date(item.date).toISOString().split("T")[0];
      if (!groups[date]) groups[date] = [];
      groups[date].push(item);
      return groups;
    },
    {} as Record<string, T[]>,
  );
}

/**
 * Get initials from name
 */
export function getInitials(name: string): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Generate a random ID
 */
export function generateId(prefix: string = "id"): string {
  return `${prefix}_${Math.random().toString(36).substr(2, 12)}`;
}
