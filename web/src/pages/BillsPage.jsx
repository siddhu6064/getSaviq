import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAppData } from "../contexts/AppDataContext";
import { Card, Button, Spinner } from "../components/ui";
import {
  Plus,
  Pencil,
  Trash2,
  Calendar,
  List,
  ScrollText,
  ChevronRight,
} from "lucide-react";
import { formatCurrency, cn } from "../lib/utils";
import { billsAPI } from "../services/api";
import AddBillModal from "../components/AddBillModal";

// ===================== STATUS LOGIC =====================

function getEffectiveDueDay(dueDay) {
  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  return Math.min(dueDay, daysInMonth);
}

function getDueDateThisMonth(dueDay) {
  const today = new Date();
  const effectiveDueDay = getEffectiveDueDay(dueDay);
  return new Date(today.getFullYear(), today.getMonth(), effectiveDueDay);
}

function computeBillStatus(bill) {
  const today = new Date();
  const todayDay = today.getDate();
  const effectiveDueDay = getEffectiveDueDay(bill.due_day);

  if ((bill.linked_expense_ids || []).length > 0) return "paid";

  const daysUntil = effectiveDueDay - todayDay;
  if (daysUntil < 0) return "overdue";
  if (daysUntil <= 3) return "due_soon";
  return "upcoming";
}

// ===================== STATUS PILLS =====================

const STATUS_CONFIG = {
  overdue: {
    label: "Overdue",
    className: "bg-red-100 text-red-700 border border-red-200",
    order: 0,
  },
  due_soon: {
    label: "Due Soon",
    className: "bg-amber-100 text-amber-700 border border-amber-200",
    order: 1,
  },
  upcoming: {
    label: "Upcoming",
    className: "bg-gray-100 text-gray-600 border border-gray-200",
    order: 2,
  },
  paid: {
    label: "Paid",
    className: "bg-green-100 text-green-700 border border-green-200",
    order: 3,
  },
};

const FREQ_BADGE = {
  monthly: "Monthly",
  weekly: "Weekly",
  annual: "Annual",
};

function StatusPill({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.upcoming;
  return (
    <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full", cfg.className)}>
      {cfg.label}
    </span>
  );
}

function FreqBadge({ frequency }) {
  return (
    <span className="text-xs font-medium px-2 py-0.5 rounded bg-surface-hover text-text-secondary border border-border-color">
      {FREQ_BADGE[frequency] || frequency}
    </span>
  );
}

// ===================== BILL ROW =====================

function BillRow({ bill, computedStatus, onEdit, onDelete }) {
  const dueDate = getDueDateThisMonth(bill.due_day);
  const dueDateStr = dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <div className="flex items-center gap-4 px-5 py-4 hover:bg-surface-hover transition-colors">
      {/* Left */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-text-primary truncate">{bill.name}</span>
          <FreqBadge frequency={bill.frequency} />
          {bill.status === "paused" && (
            <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200">
              Paused
            </span>
          )}
        </div>
        {bill.merchant && (
          <p className="text-xs text-text-secondary mt-0.5 truncate">{bill.merchant}</p>
        )}
      </div>

      {/* Due date */}
      <div className="hidden sm:block text-sm text-text-secondary whitespace-nowrap">
        Due {dueDateStr}
      </div>

      {/* Amount */}
      <div className="text-base font-bold text-text-primary whitespace-nowrap">
        {formatCurrency(bill.expected_amount)}
      </div>

      {/* Status */}
      <StatusPill status={computedStatus} />

      {/* Actions */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onEdit(bill)}
          className="p-2 rounded-lg text-text-secondary hover:text-brand-primary hover:bg-brand-primary/10 transition-colors"
          title="Edit bill"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={() => onDelete(bill)}
          className="p-2 rounded-lg text-text-secondary hover:text-expense hover:bg-expense-bg transition-colors"
          title="Delete bill"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ===================== SECTION HEADER =====================

function SectionHeader({ title, count, totalAmount }) {
  return (
    <div className="flex items-center justify-between px-5 py-2 bg-surface-hover border-b border-border-color">
      <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
        {title}
      </span>
      <div className="flex items-center gap-3">
        <span className="text-xs text-text-secondary">{count} bill{count !== 1 ? "s" : ""}</span>
        {totalAmount > 0 && (
          <span className="text-xs font-bold text-text-primary">{formatCurrency(totalAmount)}</span>
        )}
      </div>
    </div>
  );
}

// ===================== CALENDAR VIEW =====================

function CalendarView({ bills }) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0=Sun

  // Map due_day → bills
  const billsByDay = {};
  bills.forEach((b) => {
    const effectiveDay = Math.min(b.due_day, daysInMonth);
    if (!billsByDay[effectiveDay]) billsByDay[effectiveDay] = [];
    billsByDay[effectiveDay].push(b);
  });

  // Build calendar cells: leading empties + days
  const cells = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const monthName = today.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const todayDay = today.getDate();

  return (
    <div>
      <h3 className="text-center text-sm font-semibold text-text-primary mb-3">{monthName}</h3>
      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="text-center text-xs font-medium text-text-secondary py-1">
            {d}
          </div>
        ))}
      </div>
      {/* Day cells */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, idx) => {
          const dayBills = day ? (billsByDay[day] || []) : [];
          const isToday = day === todayDay;
          return (
            <div
              key={idx}
              className={cn(
                "min-h-[56px] rounded-xl border p-1 text-xs",
                day ? "bg-white border-border-color" : "bg-transparent border-transparent",
                isToday && "border-brand-primary/40 ring-1 ring-brand-primary/30",
              )}
            >
              {day && (
                <>
                  <div
                    className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center font-semibold mb-1",
                      isToday
                        ? "bg-brand-primary text-white"
                        : "text-text-secondary",
                    )}
                  >
                    {day}
                  </div>
                  <div className="space-y-0.5">
                    {dayBills.slice(0, 2).map((b) => {
                      const s = computeBillStatus(b);
                      const dotColor =
                        s === "overdue"
                          ? "bg-red-400"
                          : s === "due_soon"
                          ? "bg-amber-400"
                          : s === "paid"
                          ? "bg-green-400"
                          : "bg-gray-400";
                      return (
                        <div key={b.bill_id} className="flex items-center gap-1 min-w-0">
                          <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", dotColor)} />
                          <span className="truncate text-[10px] text-text-primary leading-tight">
                            {b.name}
                          </span>
                        </div>
                      );
                    })}
                    {dayBills.length > 2 && (
                      <div className="text-[10px] text-text-secondary">
                        +{dayBills.length - 2} more
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ===================== DELETE CONFIRM =====================

function DeleteConfirmDialog({ bill, onConfirm, onCancel, isDeleting }) {
  if (!bill) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
        <h3 className="text-lg font-bold text-text-primary mb-2">Delete Bill</h3>
        <p className="text-sm text-text-secondary mb-5">
          Delete &quot;{bill.name}&quot;? This cannot be undone.
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onCancel} disabled={isDeleting} className="flex-1">
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isDeleting} className="flex-1 bg-expense text-white hover:bg-expense/90">
            {isDeleting ? <Spinner size="sm" className="text-white" /> : "Delete"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ===================== MAIN PAGE =====================

export default function BillsPage() {
  const { activeProfile } = useAppData();
  const navigate = useNavigate();

  const [bills, setBills] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [view, setView] = useState("list"); // "list" | "calendar"
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBill, setEditingBill] = useState(null);
  const [deletingBill, setDeletingBill] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchBills = useCallback(async () => {
    if (!activeProfile?.profile_id) {
      setBills([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const res = await billsAPI.getAll({ profile_id: activeProfile.profile_id });
      setBills(Array.isArray(res.data) ? res.data : []);
    } catch {
      setError("Failed to load bills. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [activeProfile?.profile_id]);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(""), 3000);
    return () => clearTimeout(t);
  }, [success]);

  // Enrich with computed status
  const enrichedBills = useMemo(
    () => bills.map((b) => ({ ...b, _status: computeBillStatus(b) })),
    [bills],
  );

  // Summary stats
  const activeBills = useMemo(
    () => enrichedBills.filter((b) => b.status === "active"),
    [enrichedBills],
  );
  const totalMonthly = useMemo(
    () =>
      activeBills.reduce((sum, b) => {
        if (b.frequency === "monthly") return sum + b.expected_amount;
        if (b.frequency === "weekly") return sum + b.expected_amount * 4.33;
        if (b.frequency === "annual") return sum + b.expected_amount / 12;
        return sum;
      }, 0),
    [activeBills],
  );

  // Group by computed status (ordered: overdue, due_soon, upcoming, paid)
  const grouped = useMemo(() => {
    const groups = { overdue: [], due_soon: [], upcoming: [], paid: [] };
    enrichedBills.forEach((b) => {
      if (groups[b._status]) groups[b._status].push(b);
    });
    return groups;
  }, [enrichedBills]);

  const handleEdit = (bill) => {
    setEditingBill(bill);
    setShowAddModal(true);
  };

  const handleDeleteClick = (bill) => {
    setDeletingBill(bill);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingBill) return;
    setIsDeleting(true);
    try {
      await billsAPI.delete(deletingBill.bill_id);
      setBills((prev) => prev.filter((b) => b.bill_id !== deletingBill.bill_id));
      setDeletingBill(null);
      setSuccess("Bill deleted.");
    } catch {
      setError("Failed to delete bill.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleModalSuccess = (msg) => {
    setShowAddModal(false);
    setEditingBill(null);
    setSuccess(msg);
    fetchBills();
  };

  const handleModalClose = () => {
    setShowAddModal(false);
    setEditingBill(null);
  };

  const groupEntries = [
    { key: "overdue", label: "Overdue" },
    { key: "due_soon", label: "Due Soon" },
    { key: "upcoming", label: "Upcoming" },
    { key: "paid", label: "Paid This Cycle" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ScrollText className="w-6 h-6 text-brand-primary" />
            <h1 className="text-2xl font-bold font-heading text-text-primary">Bills</h1>
          </div>
          {!isLoading && !error && (
            <p className="text-sm text-text-secondary mt-1">
              {activeBills.length} bill{activeBills.length !== 1 ? "s" : ""} this month ·{" "}
              <span className="font-semibold text-text-primary">
                {formatCurrency(totalMonthly)}
              </span>{" "}
              total
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-xl border border-border-color overflow-hidden">
            <button
              onClick={() => setView("list")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors",
                view === "list"
                  ? "bg-brand-primary text-white"
                  : "bg-white text-text-secondary hover:bg-surface-hover",
              )}
            >
              <List className="w-4 h-4" />
              List
            </button>
            <button
              onClick={() => setView("calendar")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors",
                view === "calendar"
                  ? "bg-brand-primary text-white"
                  : "bg-white text-text-secondary hover:bg-surface-hover",
              )}
            >
              <Calendar className="w-4 h-4" />
              Calendar
            </button>
          </div>

          <Button
            onClick={() => {
              setEditingBill(null);
              setShowAddModal(true);
            }}
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Bill
          </Button>
        </div>
      </div>

      {/* Error / Success banners */}
      {error && (
        <div className="p-3 bg-expense-bg text-expense text-sm rounded-xl flex items-center gap-2">
          {error}
          <button
            onClick={fetchBills}
            className="ml-auto text-xs underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}
      {success && (
        <div className="p-3 bg-income-bg text-income text-sm rounded-xl">{success}</div>
      )}

      {/* No profile */}
      {!activeProfile && !isLoading && (
        <Card className="p-6 text-center">
          <ScrollText className="w-10 h-10 text-text-secondary mx-auto mb-3" />
          <p className="font-semibold text-text-primary">No profile selected</p>
          <p className="text-sm text-text-secondary mt-1">
            Select a profile to manage your bills.
          </p>
        </Card>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      )}

      {/* Empty */}
      {!isLoading && !error && activeProfile && bills.length === 0 && (
        <Card className="p-10 text-center">
          <ScrollText className="w-12 h-12 text-text-secondary mx-auto mb-4" />
          <p className="font-semibold text-text-primary text-lg">No bills yet</p>
          <p className="text-sm text-text-secondary mt-1 mb-5">
            Track recurring expenses like subscriptions, rent, and utilities.
          </p>
          <Button
            onClick={() => {
              setEditingBill(null);
              setShowAddModal(true);
            }}
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Your First Bill
          </Button>
        </Card>
      )}

      {/* Content */}
      {!isLoading && bills.length > 0 && (
        <>
          {view === "list" ? (
            <Card className="overflow-hidden border-[#D6D1C7]">
              {groupEntries.map(({ key, label }) => {
                const groupBills = grouped[key];
                if (groupBills.length === 0) return null;
                const groupTotal = groupBills.reduce(
                  (sum, b) => sum + b.expected_amount,
                  0,
                );
                return (
                  <div key={key}>
                    <SectionHeader
                      title={label}
                      count={groupBills.length}
                      totalAmount={groupTotal}
                    />
                    <div className="divide-y divide-border-color">
                      {groupBills.map((bill) => (
                        <BillRow
                          key={bill.bill_id}
                          bill={bill}
                          computedStatus={bill._status}
                          onEdit={handleEdit}
                          onDelete={handleDeleteClick}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </Card>
          ) : (
            <Card className="p-5 border-[#D6D1C7]">
              <CalendarView bills={enrichedBills} />
            </Card>
          )}
        </>
      )}

      {/* Add/Edit Modal */}
      <AddBillModal
        isOpen={showAddModal}
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
        profileId={activeProfile?.profile_id}
        editingBill={editingBill}
      />

      {/* Delete Confirm */}
      {deletingBill && (
        <DeleteConfirmDialog
          bill={deletingBill}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeletingBill(null)}
          isDeleting={isDeleting}
        />
      )}
    </div>
  );
}
