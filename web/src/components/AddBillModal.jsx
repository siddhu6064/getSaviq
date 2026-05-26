import React, { useState, useEffect } from "react";
import { Modal, Button, Spinner } from "./ui";
import { DollarSign, Tag, Store, Calendar } from "lucide-react";
import { billsAPI } from "../services/api";

const FREQUENCY_OPTIONS = [
  { value: "monthly", label: "Monthly" },
  { value: "weekly", label: "Weekly" },
  { value: "annual", label: "Annual" },
];

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
];

export default function AddBillModal({
  isOpen,
  onClose,
  onSuccess,
  profileId,
  editingBill = null,
}) {
  const mode = editingBill ? "edit" : "create";

  const [name, setName] = useState("");
  const [merchant, setMerchant] = useState("");
  const [expectedAmount, setExpectedAmount] = useState("");
  const [frequency, setFrequency] = useState("monthly");
  const [dueDay, setDueDay] = useState("1");
  const [status, setStatus] = useState("active");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const resetForm = () => {
    setName("");
    setMerchant("");
    setExpectedAmount("");
    setFrequency("monthly");
    setDueDay("1");
    setStatus("active");
    setError("");
    setFieldErrors({});
  };

  useEffect(() => {
    if (!isOpen) return;
    if (mode === "edit" && editingBill) {
      setName(editingBill.name || "");
      setMerchant(editingBill.merchant || "");
      setExpectedAmount(
        editingBill.expected_amount != null ? String(editingBill.expected_amount) : "",
      );
      setFrequency(editingBill.frequency || "monthly");
      setDueDay(editingBill.due_day != null ? String(editingBill.due_day) : "1");
      setStatus(editingBill.status || "active");
      setError("");
      setFieldErrors({});
      return;
    }
    resetForm();
  }, [isOpen, mode, editingBill]);

  const handleClose = () => {
    if (isSubmitting) return;
    resetForm();
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    const nextErrors = {};
    if (!name.trim()) nextErrors.name = "Name is required.";
    const amountVal = parseFloat(expectedAmount);
    if (!expectedAmount || isNaN(amountVal) || amountVal <= 0) {
      nextErrors.expectedAmount = "Enter a valid amount greater than 0.";
    }
    const dueDayVal = parseInt(dueDay, 10);
    if (!dueDay || isNaN(dueDayVal) || dueDayVal < 1 || dueDayVal > 31) {
      nextErrors.dueDay = "Due day must be between 1 and 31.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setError("Please correct the highlighted fields.");
      return;
    }

    setError("");
    setFieldErrors({});

    try {
      setIsSubmitting(true);
      const payload = {
        profile_id: profileId,
        name: name.trim(),
        merchant: merchant.trim() || null,
        expected_amount: amountVal,
        frequency,
        due_day: dueDayVal,
        status,
      };

      if (mode === "edit" && editingBill?.bill_id) {
        await billsAPI.update(editingBill.bill_id, {
          name: payload.name,
          merchant: payload.merchant,
          expected_amount: payload.expected_amount,
          frequency: payload.frequency,
          due_day: payload.due_day,
          status: payload.status,
        });
      } else {
        await billsAPI.create(payload);
      }

      resetForm();
      onSuccess(mode === "edit" ? "Bill updated." : "Bill added.");
    } catch (err) {
      const apiError = err?.response?.data?.detail || err?.response?.data?.error?.message;
      setError(apiError || `Failed to ${mode === "edit" ? "update" : "create"} bill.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={mode === "edit" ? "Edit Bill" : "Add Bill"}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <div className="p-3 bg-expense-bg text-expense text-sm rounded-xl">{error}</div>}

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">
            Name <span className="text-expense">*</span>
          </label>
          <div className="relative">
            <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Netflix"
              className={`w-full pl-12 pr-4 py-3 bg-white border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all ${
                fieldErrors.name ? "border-expense" : "border-border-color"
              }`}
            />
          </div>
          {fieldErrors.name && <p className="text-xs text-expense mt-1">{fieldErrors.name}</p>}
        </div>

        {/* Merchant */}
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">
            Merchant{" "}
            <span className="text-text-secondary text-xs font-normal">
              (optional — used for auto-matching)
            </span>
          </label>
          <div className="relative">
            <Store className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
            <input
              type="text"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              placeholder="e.g. Netflix Inc."
              className="w-full pl-12 pr-4 py-3 bg-white border border-border-color rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all"
            />
          </div>
        </div>

        {/* Expected Amount */}
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">
            Expected Amount <span className="text-expense">*</span>
          </label>
          <div className="relative">
            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={expectedAmount}
              onChange={(e) => setExpectedAmount(e.target.value)}
              placeholder="0.00"
              className={`w-full pl-12 pr-4 py-3 text-xl font-bold bg-white border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all ${
                fieldErrors.expectedAmount ? "border-expense" : "border-border-color"
              }`}
            />
          </div>
          {fieldErrors.expectedAmount && (
            <p className="text-xs text-expense mt-1">{fieldErrors.expectedAmount}</p>
          )}
        </div>

        {/* Frequency + Due Day */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">
              Frequency <span className="text-expense">*</span>
            </label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-border-color rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all"
            >
              {FREQUENCY_OPTIONS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">
              Due Day <span className="text-expense">*</span>
            </label>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
              <input
                type="number"
                min="1"
                max="31"
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
                placeholder="1"
                className={`w-full pl-12 pr-4 py-3 bg-white border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all ${
                  fieldErrors.dueDay ? "border-expense" : "border-border-color"
                }`}
              />
            </div>
            {fieldErrors.dueDay && (
              <p className="text-xs text-expense mt-1">{fieldErrors.dueDay}</p>
            )}
          </div>
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full px-4 py-3 bg-white border border-border-color rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-border-color">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={isSubmitting}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting} className="flex-1">
            {isSubmitting ? (
              <Spinner size="sm" className="text-white" />
            ) : mode === "edit" ? (
              "Save Bill"
            ) : (
              "Add Bill"
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
