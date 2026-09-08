import { useCallback, useEffect, useState } from "react";

/**
 * Validates a date-preset + custom-range selection and computes the
 * start/end ISO params to send to the API. Shared by pages that offer the
 * same 30d/90d/6m/1y/custom date filter (Dashboard, Transactions).
 */
export function useDateRangeFilter(datePreset, customStartDate, customEndDate) {
  const [dateValidationError, setDateValidationError] = useState("");

  useEffect(() => {
    if (datePreset !== "custom") {
      setDateValidationError("");
      return;
    }
    if (!customStartDate || !customEndDate) {
      setDateValidationError("Select both start and end dates to apply a custom range.");
      return;
    }
    if (new Date(customEndDate) < new Date(customStartDate)) {
      setDateValidationError("End date cannot be earlier than start date.");
      return;
    }
    setDateValidationError("");
  }, [customEndDate, customStartDate, datePreset]);

  const getDateRangeParams = useCallback(() => {
    if (datePreset === "custom") {
      if (!customStartDate || !customEndDate) return null;
      const start = new Date(`${customStartDate}T00:00:00`);
      const end = new Date(`${customEndDate}T23:59:59`);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return null;
      return { start_date: start.toISOString(), end_date: end.toISOString() };
    }
    const end = new Date();
    const start = new Date(end);
    if (datePreset === "30d") start.setDate(end.getDate() - 30);
    if (datePreset === "90d") start.setDate(end.getDate() - 90);
    if (datePreset === "6m") start.setMonth(end.getMonth() - 6);
    if (datePreset === "1y") start.setFullYear(end.getFullYear() - 1);
    return { start_date: start.toISOString(), end_date: end.toISOString() };
  }, [customEndDate, customStartDate, datePreset]);

  return { dateValidationError, getDateRangeParams };
}
