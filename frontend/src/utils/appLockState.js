/**
 * Pure decision logic for the biometric app-lock gate. Kept separate from
 * AppState/LocalAuthentication side effects so it's plain-Node testable.
 */

/**
 * @param {{
 *   enabled: boolean,
 *   isAuthenticated: boolean,
 *   unlockedAt: number|null,
 *   now: number,
 *   graceMs?: number,
 * }} params
 * @returns {boolean} whether the lock screen should be shown
 */
export function shouldRequireUnlock({
  enabled,
  isAuthenticated,
  unlockedAt,
  now,
  graceMs = 30000,
}) {
  if (!enabled || !isAuthenticated) return false;
  if (unlockedAt == null) return true;
  return now - unlockedAt > graceMs;
}

/**
 * Decide whether an AppState transition should re-arm the lock check.
 * Only transitions INTO "active" matter — background/inactive never need a check.
 * @param {{ nextState: string }} params
 */
export function isForegroundTransition({ nextState }) {
  return nextState === "active";
}
