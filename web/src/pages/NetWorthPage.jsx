import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAppData } from "../contexts/AppDataContext";
import { Card, Button, Badge, Spinner } from "../components/ui";
import { Plus, Pencil, Trash2, TrendingUp, Wallet, CreditCard } from "lucide-react";
import { formatCurrency, cn } from "../lib/utils";
import { netWorthAPI } from "../services/api";
import AssetModal from "../components/AssetModal";
import LiabilityModal from "../components/LiabilityModal";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

const ASSET_TYPE_COLORS = {
  cash: "income",
  property: "default",
  investment: "warning",
  other: "default",
};

const LIABILITY_TYPE_COLORS = {
  loan: "expense",
  credit: "expense",
  mortgage: "warning",
  other: "default",
};

function TypeBadge({ type, colorMap }) {
  return (
    <Badge variant={colorMap[type] || "default"} className="capitalize text-xs">
      {type}
    </Badge>
  );
}

function SectionEmpty({ icon: Icon, label, onAdd }) {
  return (
    <div className="text-center py-10">
      <Icon className="w-10 h-10 text-text-secondary/40 mx-auto mb-3" />
      <p className="text-sm text-text-secondary mb-4">No {label} yet</p>
      <Button size="sm" onClick={onAdd}>
        <Plus className="w-4 h-4 mr-1" /> Add {label.replace(/s$/, "")}
      </Button>
    </div>
  );
}

function NetWorthChart({ profileId }) {
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    const params = { days: 180 };
    if (profileId) params.profile_id = profileId;
    netWorthAPI
      .getHistory(params)
      .then((res) => {
        if (cancelled) return;
        const raw = res.data?.snapshots || [];
        const chartData = raw.map((s) => ({
          date: new Date(s.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          net_worth: s.net_worth,
          assets: s.assets_total,
          liabilities: s.liabilities_total,
        }));
        setSnapshots(chartData);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  return (
    <Card className="space-y-4" data-testid="net-worth-chart-card">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-brand-primary" />
        <h2 className="text-lg font-bold font-heading text-text-primary">6-Month Trend</h2>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-48 text-sm text-text-secondary">
          Failed to load history
        </div>
      ) : snapshots.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-sm text-text-secondary">
          <TrendingUp className="w-8 h-8 text-text-secondary/30 mb-2" />
          No snapshots yet — nightly job runs at midnight UTC
        </div>
      ) : (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={snapshots} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="netWorthGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "#9b9589" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#9b9589" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(v) => formatCurrency(v)}
                labelStyle={{ fontSize: 12, color: "#3d3a35" }}
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid #e8e3dc",
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="net_worth"
                name="Net Worth"
                stroke="#6366f1"
                strokeWidth={2}
                fill="url(#netWorthGrad)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

export default function NetWorthPage() {
  const { profiles, activeProfile, setActiveProfile, loading: appLoading } = useAppData();

  const [assets, setAssets] = useState([]);
  const [liabilities, setLiabilities] = useState([]);
  const [summary, setSummary] = useState(null);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [liabsLoading, setLiabsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showAssetModal, setShowAssetModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [showLiabModal, setShowLiabModal] = useState(false);
  const [editingLiab, setEditingLiab] = useState(null);

  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Auto-clear success banner
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(""), 2400);
    return () => clearTimeout(t);
  }, [success]);

  const profileId = activeProfile?.profile_id;

  const loadSummary = useCallback(async () => {
    if (!profileId) return;
    try {
      const res = await netWorthAPI.getSummary({ profile_id: profileId });
      if (isMounted.current) setSummary(res.data);
    } catch {
      // non-critical — summary card shows its own error
    }
  }, [profileId]);

  const loadAssets = useCallback(async () => {
    if (!profileId) return;
    setAssetsLoading(true);
    try {
      const res = await netWorthAPI.getAssets({ profile_id: profileId });
      if (isMounted.current) {
        setAssets(res.data || []);
        setError("");
      }
    } catch {
      if (isMounted.current) setError("Failed to load assets.");
    } finally {
      if (isMounted.current) setAssetsLoading(false);
    }
  }, [profileId]);

  const loadLiabilities = useCallback(async () => {
    if (!profileId) return;
    setLiabsLoading(true);
    try {
      const res = await netWorthAPI.getLiabilities({ profile_id: profileId });
      if (isMounted.current) {
        setLiabilities(res.data || []);
        setError("");
      }
    } catch {
      if (isMounted.current) setError("Failed to load liabilities.");
    } finally {
      if (isMounted.current) setLiabsLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    loadAssets();
    loadLiabilities();
    loadSummary();
  }, [loadAssets, loadLiabilities, loadSummary]);

  const handleDeleteAsset = async (assetId) => {
    if (!window.confirm("Delete this asset?")) return;
    try {
      await netWorthAPI.deleteAsset(assetId);
      await Promise.all([loadAssets(), loadSummary()]);
      setSuccess("Asset deleted.");
    } catch {
      setError("Failed to delete asset.");
    }
  };

  const handleDeleteLiability = async (liabId) => {
    if (!window.confirm("Delete this liability?")) return;
    try {
      await netWorthAPI.deleteLiability(liabId);
      await Promise.all([loadLiabilities(), loadSummary()]);
      setSuccess("Liability deleted.");
    } catch {
      setError("Failed to delete liability.");
    }
  };

  const openAddAsset = () => {
    setEditingAsset(null);
    setShowAssetModal(true);
  };
  const openEditAsset = (a) => {
    setEditingAsset(a);
    setShowAssetModal(true);
  };
  const openAddLiab = () => {
    setEditingLiab(null);
    setShowLiabModal(true);
  };
  const openEditLiab = (l) => {
    setEditingLiab(l);
    setShowLiabModal(true);
  };

  const isPositive = (summary?.net_worth ?? 0) >= 0;

  if (appLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="net-worth-page">
      {/* Feedback banners */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
          {success}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-heading text-text-primary">
            Net Worth
          </h1>
          <p className="text-text-secondary mt-1">Track your assets and liabilities over time</p>
        </div>

        {/* Profile switcher */}
        <select
          value={profileId || ""}
          onChange={(e) => {
            const p = profiles.find((x) => x.profile_id === e.target.value);
            setActiveProfile(p || null);
          }}
          className="w-full sm:w-auto px-4 py-2 bg-white border border-border-color rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
          data-testid="net-worth-profile-select"
        >
          {profiles.map((p) => (
            <option key={p.profile_id} value={p.profile_id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Summary banner */}
      {summary && (
        <Card className="bg-gradient-to-r from-brand-primary/5 to-transparent border-brand-primary/20">
          <div className="flex flex-wrap gap-6 items-center">
            <div>
              <p className="text-xs uppercase tracking-widest text-text-secondary font-semibold mb-1">
                Net Worth
              </p>
              <p
                className={cn(
                  "text-3xl font-bold font-heading",
                  isPositive ? "text-income" : "text-expense",
                )}
              >
                {isPositive ? "" : "-"}
                {formatCurrency(Math.abs(summary.net_worth))}
              </p>
            </div>
            <div className="flex gap-6">
              <div>
                <p className="text-xs text-text-secondary mb-0.5">Total Assets</p>
                <p className="text-lg font-bold text-income">
                  {formatCurrency(summary.assets_total)}
                </p>
              </div>
              <div>
                <p className="text-xs text-text-secondary mb-0.5">Total Liabilities</p>
                <p className="text-lg font-bold text-expense">
                  {formatCurrency(summary.liabilities_total)}
                </p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Assets ── */}
        <Card className="space-y-4" data-testid="assets-section">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-income" />
              <h2 className="text-lg font-bold font-heading text-text-primary">Assets</h2>
              <span className="text-sm text-text-secondary">
                ({formatCurrency(assets.reduce((s, a) => s + (a.value || 0), 0))})
              </span>
            </div>
            <Button size="sm" onClick={openAddAsset} data-testid="add-asset-btn">
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </div>

          {assetsLoading ? (
            <div className="flex items-center justify-center h-32">
              <Spinner size="lg" />
            </div>
          ) : assets.length === 0 ? (
            <SectionEmpty icon={Wallet} label="assets" onAdd={openAddAsset} />
          ) : (
            <ul className="divide-y divide-border-color" data-testid="assets-list">
              {assets.map((a) => (
                <li
                  key={a.asset_id}
                  className="flex items-center justify-between py-3 gap-3"
                  data-testid="asset-row"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text-primary truncate">{a.name}</p>
                    <TypeBadge type={a.type} colorMap={ASSET_TYPE_COLORS} />
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-bold text-income">
                      {formatCurrency(a.value || 0)}
                    </span>
                    <button
                      onClick={() => openEditAsset(a)}
                      className="p-1.5 rounded-lg text-text-secondary hover:text-brand-primary hover:bg-surface-hover transition-colors"
                      title="Edit asset"
                      data-testid="edit-asset-btn"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteAsset(a.asset_id)}
                      className="p-1.5 rounded-lg text-text-secondary hover:text-expense hover:bg-expense-bg transition-colors"
                      title="Delete asset"
                      data-testid="delete-asset-btn"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* ── Liabilities ── */}
        <Card className="space-y-4" data-testid="liabilities-section">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-expense" />
              <h2 className="text-lg font-bold font-heading text-text-primary">Liabilities</h2>
              <span className="text-sm text-text-secondary">
                ({formatCurrency(liabilities.reduce((s, l) => s + (l.balance || 0), 0))})
              </span>
            </div>
            <Button
              size="sm"
              variant="danger"
              onClick={openAddLiab}
              data-testid="add-liability-btn"
            >
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </div>

          {liabsLoading ? (
            <div className="flex items-center justify-center h-32">
              <Spinner size="lg" />
            </div>
          ) : liabilities.length === 0 ? (
            <SectionEmpty icon={CreditCard} label="liabilities" onAdd={openAddLiab} />
          ) : (
            <ul className="divide-y divide-border-color" data-testid="liabilities-list">
              {liabilities.map((l) => (
                <li
                  key={l.liability_id}
                  className="flex items-center justify-between py-3 gap-3"
                  data-testid="liability-row"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text-primary truncate">{l.name}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <TypeBadge type={l.type} colorMap={LIABILITY_TYPE_COLORS} />
                      {l.interest_rate != null && (
                        <span className="text-xs text-text-secondary">{l.interest_rate}% APR</span>
                      )}
                      {l.monthly_payment != null && (
                        <span className="text-xs text-text-secondary">
                          {formatCurrency(l.monthly_payment)}/mo
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-bold text-expense">
                      {formatCurrency(l.balance || 0)}
                    </span>
                    <button
                      onClick={() => openEditLiab(l)}
                      className="p-1.5 rounded-lg text-text-secondary hover:text-brand-primary hover:bg-surface-hover transition-colors"
                      title="Edit liability"
                      data-testid="edit-liability-btn"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteLiability(l.liability_id)}
                      className="p-1.5 rounded-lg text-text-secondary hover:text-expense hover:bg-expense-bg transition-colors"
                      title="Delete liability"
                      data-testid="delete-liability-btn"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Trend chart — full width */}
      <NetWorthChart profileId={profileId} />

      {/* Modals */}
      <AssetModal
        isOpen={showAssetModal}
        onClose={() => {
          setShowAssetModal(false);
          setEditingAsset(null);
        }}
        onSuccess={(msg) => {
          setShowAssetModal(false);
          setEditingAsset(null);
          setSuccess(msg);
          loadAssets();
          loadSummary();
        }}
        profileId={profileId}
        editingAsset={editingAsset}
      />

      <LiabilityModal
        isOpen={showLiabModal}
        onClose={() => {
          setShowLiabModal(false);
          setEditingLiab(null);
        }}
        onSuccess={(msg) => {
          setShowLiabModal(false);
          setEditingLiab(null);
          setSuccess(msg);
          loadLiabilities();
          loadSummary();
        }}
        profileId={profileId}
        editingLiability={editingLiab}
      />
    </div>
  );
}
