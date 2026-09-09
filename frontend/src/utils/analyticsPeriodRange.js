function pad(n) {
  return String(n).padStart(2, "0");
}

function toDateString(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Current week/month/year date range (inclusive), anchored on `now`.
export function deriveAnalyticsPeriodRange(period, now = new Date()) {
  if (period === "week") {
    const day = now.getDay(); // 0=Sun
    const start = new Date(now);
    start.setDate(now.getDate() - day);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start_date: toDateString(start), end_date: toDateString(end) };
  }

  if (period === "year") {
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear(), 11, 31);
    return { start_date: toDateString(start), end_date: toDateString(end) };
  }

  // "month" (default)
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start_date: toDateString(start), end_date: toDateString(end) };
}
