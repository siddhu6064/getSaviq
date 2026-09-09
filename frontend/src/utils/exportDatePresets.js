function toDateString(d) {
  return d.toISOString().split("T")[0];
}

// Port of web's ExportPage quick-preset date ranges.
export function deriveExportDatePreset(preset, now = new Date()) {
  if (preset === "this_year") {
    return { start: toDateString(new Date(now.getFullYear(), 0, 1)), end: toDateString(now) };
  }
  if (preset === "last_month") {
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return {
      start: toDateString(lastMonth),
      end: toDateString(new Date(now.getFullYear(), now.getMonth(), 0)),
    };
  }
  // "this_month" (default)
  return {
    start: toDateString(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: toDateString(now),
  };
}
