export function shouldRequireUnlock(params: {
  enabled: boolean;
  isAuthenticated: boolean;
  unlockedAt: number | null;
  now: number;
  graceMs?: number;
}): boolean;

export function isForegroundTransition(params: { nextState: string }): boolean;
