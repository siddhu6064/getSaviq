import React, { useEffect, useState } from "react";
import { Modal, Button, Spinner } from "./ui";
import { expensesAPI } from "../services/api";
import { formatCurrency } from "../lib/utils";

export default function RefundModal({ isOpen, onClose, expense, onRefunded }) {
  const [refundedTotal, setRefundedTotal] = useState(0);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen || !expense) return;
    setError("");
    setNotes("");
    expensesAPI
      .getRefunds(expense.expense_id)
      .then((res) => {
        const total = (res.data || []).reduce((sum, r) => sum + r.amount, 0);
        setRefundedTotal(total);
        setAmount(Math.max(expense.amount - total, 0).toFixed(2));
      })
      .catch(() => {
        setRefundedTotal(0);
        setAmount(expense.amount.toFixed(2));
      });
  }, [isOpen, expense]);

  if (!expense) return null;

  const handleSubmit = async () => {
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) {
      setError("Enter a valid refund amount");
      return;
    }
    setIsSubmitting(true);
    setError("");
    try {
      await expensesAPI.refund(expense.expense_id, { amount: parsed, notes: notes || undefined });
      onRefunded?.();
      onClose();
    } catch {
      setError("Failed to record refund. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Record Refund" size="sm">
      <p className="text-text-secondary text-sm mb-4">
        {expense.description} · {formatCurrency(expense.amount)}
        {refundedTotal > 0 && ` · ${formatCurrency(refundedTotal)} already refunded`}
      </p>

      <label className="block text-sm font-medium text-text-primary mb-1.5">Amount</label>
      <input
        type="number"
        step="0.01"
        min="0"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-full px-4 py-3 mb-4 bg-white border border-border-color rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all"
        data-testid="refund-amount-input"
      />

      <label className="block text-sm font-medium text-text-primary mb-1.5">Notes (optional)</label>
      <input
        type="text"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="e.g. Returned item"
        className="w-full px-4 py-3 mb-4 bg-white border border-border-color rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all"
        data-testid="refund-notes-input"
      />

      {error && <p className="text-danger text-sm mb-3">{error}</p>}

      <div className="flex gap-3">
        <Button variant="secondary" onClick={onClose} disabled={isSubmitting} className="flex-1">
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="flex-1"
          data-testid="refund-submit"
        >
          {isSubmitting ? <Spinner size="sm" className="text-white" /> : "Save Refund"}
        </Button>
      </div>
    </Modal>
  );
}
