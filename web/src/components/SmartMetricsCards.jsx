import React, { useMemo, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "./ui";
import { Button } from "./ui";
import { cn, formatCurrency } from "../lib/utils";
import { mapSmartMetricsToCards } from "../lib/smartMetricsPresentation";
import { getSmartMetricsGridClass } from "../lib/smartMetricsDashboardState";
import {
  deriveSmartMetricsSectionState,
  getSmartMetricsModeRoots,
} from "../lib/smartMetricsSectionState";
import { Info, RefreshCw, TrendingUp, ScrollText, ChevronRight } from "lucide-react";
import { useAppData } from "../contexts/AppDataContext";
import { netWorthAPI, billsAPI } from "../services/api";

function NetWorthCard() {
  const { activeProfile } = useAppData();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    const params = activeProfile?.profile_id ? { profile_id: activeProfile.profile_id } : {};
    netWorthAPI
      .getSummary(params)
      .then((res) => {
        if (!cancelled) {
          setData(res.data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeProfile?.profile_id]);

  const isPositive = (data?.net_worth ?? 0) >= 0;

  return (
    <Card
      className="relative overflow-hidden border-[#D6D1C7] bg-gradient-to-b from-white to-[#F8F6F1] p-5 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
      data-testid="net-worth-summary-card"
      onClick={() => navigate("/net-worth")}
    >
      <div
        aria-hidden="true"
        className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-brand-primary/5"
      />
      <div className="relative space-y-3">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs uppercase tracking-[0.18em] text-text-secondary">Net Worth</p>
          <span className="rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-text-secondary border border-border-color/70 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> Live
          </span>
        </div>
        <div>
          <p className="text-sm font-semibold text-text-primary">Total Net Worth</p>
          {loading ? (
            <div className="mt-1 h-8 w-32 rounded bg-surface-hover animate-pulse" />
          ) : error ? (
            <p className="mt-1 text-sm text-text-secondary">Unavailable</p>
          ) : (
            <p
              className={cn(
                "mt-1 text-2xl font-bold font-heading",
                isPositive ? "text-income" : "text-expense",
              )}
            >
              {isPositive ? "" : "-"}
              {formatCurrency(Math.abs(data?.net_worth ?? 0))}
            </p>
          )}
        </div>
        {!loading && !error && data && (
          <p className="text-xs text-text-secondary">
            <span className="font-medium text-income">{formatCurrency(data.assets_total)}</span>{" "}
            assets
            {" · "}
            <span className="font-medium text-expense">
              {formatCurrency(data.liabilities_total)}
            </span>{" "}
            liabilities
          </p>
        )}
        {loading && <div className="h-3 w-4/5 rounded bg-surface-hover animate-pulse" />}
      </div>
    </Card>
  );
}

function getEffectiveDueDay(dueDay) {
  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  return Math.min(dueDay, daysInMonth);
}

function computeBillStatusForCard(bill) {
  const todayDay = new Date().getDate();
  const effectiveDueDay = getEffectiveDueDay(bill.due_day);
  if ((bill.linked_expense_ids || []).length > 0) return "paid";
  const daysUntil = effectiveDueDay - todayDay;
  if (daysUntil < 0) return "overdue";
  if (daysUntil <= 3) return "due_soon";
  return "upcoming";
}

function UpcomingBillsCard() {
  const { activeProfile } = useAppData();
  const navigate = useNavigate();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    const params = { status: "active" };
    if (activeProfile?.profile_id) params.profile_id = activeProfile.profile_id;
    billsAPI
      .getAll(params)
      .then((res) => {
        if (!cancelled) {
          setBills(Array.isArray(res.data) ? res.data : []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeProfile?.profile_id]);

  // Sort by effective due day ascending; take first 3 upcoming/overdue/due_soon
  const upcomingBills = useMemo(() => {
    return bills
      .map((b) => ({ ...b, _status: computeBillStatusForCard(b) }))
      .filter((b) => b._status !== "paid")
      .sort((a, b) => getEffectiveDueDay(a.due_day) - getEffectiveDueDay(b.due_day))
      .slice(0, 3);
  }, [bills]);

  const totalMonthly = useMemo(
    () =>
      bills.reduce((sum, b) => {
        if (b.frequency === "monthly") return sum + b.expected_amount;
        if (b.frequency === "weekly") return sum + b.expected_amount * 4.33;
        if (b.frequency === "annual") return sum + b.expected_amount / 12;
        return sum;
      }, 0),
    [bills],
  );

  const statusDot = {
    overdue: "bg-red-400",
    due_soon: "bg-amber-400",
    upcoming: "bg-gray-400",
    paid: "bg-green-400",
  };

  return (
    <Card
      className="relative overflow-hidden border-[#D6D1C7] bg-gradient-to-b from-white to-[#F8F6F1] p-5 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => navigate("/bills")}
      data-testid="upcoming-bills-card"
    >
      <div
        aria-hidden="true"
        className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-brand-primary/5"
      />
      <div className="relative space-y-3">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs uppercase tracking-[0.18em] text-text-secondary">Bills</p>
          <span className="rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-text-secondary border border-border-color/70 flex items-center gap-1">
            <ScrollText className="w-3 h-3" /> Upcoming
          </span>
        </div>
        <div>
          <p className="text-sm font-semibold text-text-primary">Upcoming Bills</p>
          {loading ? (
            <div className="mt-2 space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-3 rounded bg-surface-hover animate-pulse w-full" />
              ))}
            </div>
          ) : error ? (
            <p className="mt-1 text-sm text-text-secondary">Unavailable</p>
          ) : upcomingBills.length === 0 ? (
            <p className="mt-1 text-sm text-income font-medium">All caught up!</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {upcomingBills.map((b) => (
                <li key={b.bill_id} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={cn(
                        "w-2 h-2 rounded-full flex-shrink-0",
                        statusDot[b._status] || "bg-gray-400",
                      )}
                    />
                    <span className="text-xs text-text-primary truncate">{b.name}</span>
                  </div>
                  <span className="text-xs font-bold text-text-primary whitespace-nowrap">
                    {formatCurrency(b.expected_amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {!loading && !error && (
          <p className="text-xs text-text-secondary flex items-center gap-1">
            {bills.length} bill{bills.length !== 1 ? "s" : ""} this month
            {" · "}
            <span className="font-medium text-text-primary">{formatCurrency(totalMonthly)}</span>
            <ChevronRight className="w-3 h-3 ml-auto" />
          </p>
        )}
        {loading && <div className="h-3 w-4/5 rounded bg-surface-hover animate-pulse" />}
      </div>
    </Card>
  );
}

function SmartMetricCard({ card }) {
  return (
    <Card
      className="relative overflow-hidden border-[#D6D1C7] bg-gradient-to-b from-white to-[#F8F6F1] p-5 shadow-sm"
      data-testid={`smart-metric-card-${card.id}`}
    >
      <div
        aria-hidden="true"
        className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-brand-primary/5"
      />
      <div className="relative space-y-3">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs uppercase tracking-[0.18em] text-text-secondary">Smart Metric</p>
          <span className="rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-text-secondary border border-border-color/70">
            {card.badge}
          </span>
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold text-text-primary">{card.title}</p>
            {card.helperText && (
              <button
                type="button"
                title={card.helperText}
                aria-label={`${card.title} help: ${card.helperText}`}
                className="rounded-full p-0.5 text-text-secondary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                data-testid={`smart-metric-helper-${card.id}`}
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <p className={cn("mt-1 text-2xl font-bold font-heading", card.accent)}>{card.value}</p>
        </div>
        <p className="text-xs text-text-secondary leading-relaxed">{card.context}</p>
      </div>
    </Card>
  );
}

function LoadingSmartMetrics() {
  return (
    <div
      className={cn(getSmartMetricsGridClass(6), "gap-5")}
      data-testid="smart-metrics-loading-grid"
    >
      {Array.from({ length: 6 }).map((_, index) => (
        <Card
          key={index}
          className="border-[#D6D1C7] bg-gradient-to-b from-white to-[#F8F6F1] p-5 shadow-sm"
        >
          <div className="animate-pulse space-y-3">
            <div className="h-3 w-20 rounded bg-surface-hover" />
            <div className="h-4 w-2/3 rounded bg-surface-hover" />
            <div className="h-8 w-1/2 rounded bg-surface-hover" />
            <div className="h-3 w-4/5 rounded bg-surface-hover" />
          </div>
        </Card>
      ))}
    </div>
  );
}

export default function SmartMetricsCards({
  metricsPayload,
  loading = false,
  error = null,
  requestState = "idle",
  requestUrl = "",
  debugLastStage = "idle",
  onRetry,
}) {
  const cards = useMemo(() => mapSmartMetricsToCards(metricsPayload), [metricsPayload]);
  const sectionState = useMemo(
    () => deriveSmartMetricsSectionState({ loading, error, metricsPayload }),
    [error, loading, metricsPayload],
  );
  const mode = useMemo(() => {
    if (sectionState?.mode === "loading") return "loading";
    if (sectionState?.mode === "error") return "error";
    if (sectionState?.mode === "success") return "success";
    return "empty";
  }, [sectionState?.mode]);
  const roots = useMemo(() => getSmartMetricsModeRoots(mode), [mode]);

  return (
    <section
      data-testid="smart-metrics-grid-section"
      className="space-y-4 rounded-2xl border border-brand-primary/15 bg-gradient-to-b from-brand-primary/[0.03] to-transparent p-4 sm:p-5"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-brand-primary/80 font-semibold">
            SAVIQ V2
          </p>
          <h2 className="text-lg font-bold font-heading text-text-primary">Smart Metrics</h2>
        </div>
      </div>
      <p className="sr-only" data-testid="smart-metrics-mode">
        {mode}
      </p>
      <p className="sr-only" data-testid="smart-metrics-request-state">
        {requestState}
      </p>
      <p className="sr-only" data-testid="smart-metrics-request-url">
        {requestUrl}
      </p>
      <p className="sr-only" data-testid="smart-metrics-debug-last-stage">
        {debugLastStage}
      </p>

      {roots.loading ? (
        <LoadingSmartMetrics />
      ) : roots.error ? (
        <Card
          className="border-[#D6D1C7] bg-gradient-to-b from-white to-[#F8F6F1] p-5 shadow-sm"
          data-testid="smart-metrics-error-state"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-text-primary">
                Smart metrics are temporarily unavailable
              </p>
              <p className="mt-1 text-sm text-text-secondary">{sectionState.message}</p>
            </div>
            {typeof onRetry === "function" && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onRetry}
                data-testid="smart-metrics-retry"
              >
                <RefreshCw className="w-4 h-4 mr-1" /> Retry
              </Button>
            )}
          </div>
        </Card>
      ) : roots.success ? (
        <div
          className={cn(getSmartMetricsGridClass(cards.length + 2), "gap-5")}
          data-testid="smart-metrics-grid"
        >
          {cards.map((card) => (
            <SmartMetricCard key={card.id} card={card} />
          ))}
          <NetWorthCard />
          <UpcomingBillsCard />
        </div>
      ) : (
        <Card
          className="border-[#D6D1C7] bg-gradient-to-b from-white to-[#F8F6F1] p-5 shadow-sm"
          data-testid="smart-metrics-empty-state"
        >
          <p className="text-sm font-semibold text-text-primary">Smart metrics are warming up</p>
          <p className="mt-1 text-sm text-text-secondary">
            Add more recent activity to populate this section.
          </p>
        </Card>
      )}
    </section>
  );
}
