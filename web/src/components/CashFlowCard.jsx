import React, { useEffect, useState } from "react";
import { Card, Spinner } from "./ui";
import { CalendarClock, AlertTriangle } from "lucide-react";
import { forecastAPI } from "../services/api";
import { formatCurrency } from "../lib/utils";

export default function CashFlowCard({ profileId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!profileId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    forecastAPI
      .getCashFlow({ profile_id: profileId, days: 30 })
      .then((response) => {
        if (!cancelled) setData(response.data);
      })
      .catch((err) => {
        console.error("Failed to load cash-flow forecast:", err);
        if (!cancelled) setError("Cash-flow forecast unavailable right now.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  if (loading) {
    return (
      <Card data-testid="cash-flow-card-loading">
        <div className="flex items-center justify-center h-20">
          <Spinner size="md" />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card data-testid="cash-flow-card-error">
        <p className="text-sm text-text-secondary">{error}</p>
      </Card>
    );
  }

  if (!data) return null;

  const upcomingDays = data.days.filter((d) => d.events.length > 0).slice(0, 8);

  return (
    <Card data-testid="cash-flow-card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold font-heading text-text-primary flex items-center gap-2">
          <CalendarClock className="w-5 h-5 text-brand-primary" />
          30-Day Cash Flow
        </h2>
      </div>

      {data.will_go_negative && (
        <div
          className="flex items-center gap-2 p-3 mb-4 bg-expense-bg rounded-xl text-expense text-sm"
          data-testid="cash-flow-negative-warning"
        >
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          Projected balance may go negative around{" "}
          {new Date(data.first_negative_date).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
          .
        </div>
      )}

      {upcomingDays.length === 0 ? (
        <p className="text-sm text-text-secondary" data-testid="cash-flow-empty">
          No upcoming bills or recurring transactions in the next 30 days.
        </p>
      ) : (
        <div className="space-y-2">
          {upcomingDays.map((day) => (
            <div
              key={day.date}
              className="flex items-center justify-between py-2 border-b border-border-color last:border-0"
            >
              <div>
                <p className="text-sm font-medium text-text-primary">
                  {new Date(day.date).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </p>
                <p className="text-xs text-text-secondary">
                  {day.events.map((e) => e.label).join(", ")}
                </p>
              </div>
              <p
                className={`text-sm font-semibold ${day.projected_balance < 0 ? "text-expense" : "text-text-primary"}`}
              >
                {formatCurrency(day.projected_balance)}
              </p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
