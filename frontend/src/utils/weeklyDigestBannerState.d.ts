export function resolveWeeklyDigestBannerState(params: {
  loading?: boolean;
  error?: string | null;
  digest?: any;
}): "loading" | "hidden" | "ready";

export function mapWeeklyDigestBannerData(payload: any): {
  latestLabel: string;
  summary: string | null;
  recommendations: Array<{ id: string; text: string; polarity: string }>;
};

export function applyDigestBannerDismiss(currentState: any): any;
