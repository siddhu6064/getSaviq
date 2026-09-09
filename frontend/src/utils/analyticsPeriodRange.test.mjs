import test from "node:test";
import assert from "node:assert/strict";
import { deriveAnalyticsPeriodRange } from "./analyticsPeriodRange.js";

test("analytics period range: month (default) spans full calendar month", () => {
  const range = deriveAnalyticsPeriodRange("month", new Date(2026, 3, 15)); // Apr 15 2026
  assert.equal(range.start_date, "2026-04-01");
  assert.equal(range.end_date, "2026-04-30");
});

test("analytics period range: year spans full calendar year", () => {
  const range = deriveAnalyticsPeriodRange("year", new Date(2026, 3, 15));
  assert.equal(range.start_date, "2026-01-01");
  assert.equal(range.end_date, "2026-12-31");
});

test("analytics period range: week spans Sunday to Saturday containing the date", () => {
  // Apr 15 2026 is a Wednesday
  const range = deriveAnalyticsPeriodRange("week", new Date(2026, 3, 15));
  assert.equal(range.start_date, "2026-04-12"); // Sunday
  assert.equal(range.end_date, "2026-04-18"); // Saturday
});
