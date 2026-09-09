import test from "node:test";
import assert from "node:assert/strict";
import { deriveExportDatePreset } from "./exportDatePresets.js";

test("export date preset: this_month spans month start to today", () => {
  const range = deriveExportDatePreset("this_month", new Date(2026, 3, 15));
  assert.equal(range.start, "2026-04-01");
  assert.equal(range.end, "2026-04-15");
});

test("export date preset: this_year spans year start to today", () => {
  const range = deriveExportDatePreset("this_year", new Date(2026, 3, 15));
  assert.equal(range.start, "2026-01-01");
  assert.equal(range.end, "2026-04-15");
});

test("export date preset: last_month spans the full previous calendar month", () => {
  const range = deriveExportDatePreset("last_month", new Date(2026, 3, 15));
  assert.equal(range.start, "2026-03-01");
  assert.equal(range.end, "2026-03-31");
});

test("export date preset: last_month handles January rollover to prior year", () => {
  const range = deriveExportDatePreset("last_month", new Date(2026, 0, 10));
  assert.equal(range.start, "2025-12-01");
  assert.equal(range.end, "2025-12-31");
});
