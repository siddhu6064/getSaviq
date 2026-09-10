import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldRequireUnlock, isForegroundTransition } from "./appLockState.js";

test("shouldRequireUnlock: disabled or unauthenticated never locks", () => {
  assert.equal(
    shouldRequireUnlock({ enabled: false, isAuthenticated: true, unlockedAt: null, now: 1000 }),
    false,
  );
  assert.equal(
    shouldRequireUnlock({ enabled: true, isAuthenticated: false, unlockedAt: null, now: 1000 }),
    false,
  );
});

test("shouldRequireUnlock: first check with no prior unlock always locks", () => {
  assert.equal(
    shouldRequireUnlock({ enabled: true, isAuthenticated: true, unlockedAt: null, now: 1000 }),
    true,
  );
});

test("shouldRequireUnlock: within grace period stays unlocked", () => {
  assert.equal(
    shouldRequireUnlock({
      enabled: true,
      isAuthenticated: true,
      unlockedAt: 1000,
      now: 1000 + 10000,
      graceMs: 30000,
    }),
    false,
  );
});

test("shouldRequireUnlock: past grace period re-locks", () => {
  assert.equal(
    shouldRequireUnlock({
      enabled: true,
      isAuthenticated: true,
      unlockedAt: 1000,
      now: 1000 + 30001,
      graceMs: 30000,
    }),
    true,
  );
});

test("isForegroundTransition: only 'active' counts", () => {
  assert.equal(isForegroundTransition({ nextState: "active" }), true);
  assert.equal(isForegroundTransition({ nextState: "background" }), false);
  assert.equal(isForegroundTransition({ nextState: "inactive" }), false);
});
