import React, { useState, useEffect } from "react";
import { Modal, Button, Spinner } from "./ui";
import { DollarSign, Tag, Percent } from "lucide-react";
import { netWorthAPI } from "../services/api";

const LIABILITY_TYPES = [
  { value: "loan", label: "Loan" },
  { value: "credit", label: "Credit Card" },
  { value: "mortgage", label: "Mortgage" },
  { value: "other", label: "Other" },
];

export default function LiabilityModal({
  isOpen,
  onClose,
  onSuccess,
  profileId,
  editingLiability = null,
}) {
  const mode = editingLiability ? "edit" : "create";

  const [name, setName] = useState("");
  const [type, setType] = useState("loan");
  const [balance, setBalance] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [monthlyPayment, setMonthlyPayment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const resetForm = () => {
    setName("");
    setType("loan");
    setBalance("");
    setInterestRate("");
    setMonthlyPayment("");
    setError("");
    setFieldErrors({});
  };

  useEffect(() => {
    if (!isOpen) return;
    if (mode === "edit" && editingLiability) {
      setName(editingLiability.name || "");
      setType(editingLiability.type || "loan");
      setBalance(editingLiability.balance != null ? String(editingLiability.balance) : "");
      setInterestRate(
        editingLiability.interest_rate != null ? String(editingLiability.interest_rate) : "",
      );
      setMonthlyPayment(
        editingLiability.monthly_payment != null ? String(editingLiability.monthly_payment) : "",
      );
      setError("");
      setFieldErrors({});
      return;
    }
    resetForm();
  }, [isOpen, mode, editingLiability]);

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
    if (!type) nextErrors.type = "Type is required.";
    if (balance === "" || isNaN(parseFloat(balance)) || parseFloat(balance) < 0) {
      nextErrors.balance = "Enter a valid balance (0 or greater).";
    }
    if (interestRate !== "" && (isNaN(parseFloat(interestRate)) || parseFloat(interestRate) < 0)) {
      nextErrors.interest_rate = "Interest rate must be 0 or greater.";
    }
    if (
      monthlyPayment !== "" &&
      (isNaN(parseFloat(monthlyPayment)) || parseFloat(monthlyPayment) < 0)
    ) {
      nextErrors.monthly_payment = "Monthly payment must be 0 or greater.";
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
        type,
        balance: parseFloat(balance),
        interest_rate: interestRate !== "" ? parseFloat(interestRate) : null,
        monthly_payment: monthlyPayment !== "" ? parseFloat(monthlyPayment) : null,
      };

      if (mode === "edit" && editingLiability?.liability_id) {
        await netWorthAPI.updateLiability(editingLiability.liability_id, {
          name: payload.name,
          type: payload.type,
          balance: payload.balance,
          interest_rate: payload.interest_rate,
          monthly_payment: payload.monthly_payment,
        });
      } else {
        await netWorthAPI.createLiability(payload);
      }

      resetForm();
      onSuccess(mode === "edit" ? "Liability updated." : "Liability added.");
    } catch (err) {
      const apiError = err?.response?.data?.detail || err?.response?.data?.error?.message;
      setError(apiError || `Failed to ${mode === "edit" ? "update" : "create"} liability.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={mode === "edit" ? "Edit Liability" : "Add Liability"}
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
              placeholder="e.g. Student Loan"
              className={`w-full pl-12 pr-4 py-3 bg-white border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all ${fieldErrors.name ? "border-expense" : "border-border-color"}`}
              data-testid="liability-name-input"
            />
          </div>
          {fieldErrors.name && <p className="text-xs text-expense mt-1">{fieldErrors.name}</p>}
        </div>

        {/* Type */}
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">
            Type <span className="text-expense">*</span>
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className={`w-full px-4 py-3 bg-white border rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all ${fieldErrors.type ? "border-expense" : "border-border-color"}`}
            data-testid="liability-type-select"
          >
            {LIABILITY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          {fieldErrors.type && <p className="text-xs text-expense mt-1">{fieldErrors.type}</p>}
        </div>

        {/* Balance */}
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">
            Current Balance <span className="text-expense">*</span>
          </label>
          <div className="relative">
            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
            <input
              type="number"
              step="0.01"
              min="0"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              placeholder="0.00"
              className={`w-full pl-12 pr-4 py-3 text-xl font-bold bg-white border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all ${fieldErrors.balance ? "border-expense" : "border-border-color"}`}
              data-testid="liability-balance-input"
            />
          </div>
          {fieldErrors.balance && (
            <p className="text-xs text-expense mt-1">{fieldErrors.balance}</p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Interest Rate */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">
              Interest Rate (Optional)
            </label>
            <div className="relative">
              <Percent className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
              <input
                type="number"
                step="0.01"
                min="0"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                placeholder="e.g. 4.5"
                className={`w-full pl-12 pr-4 py-3 bg-white border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all ${fieldErrors.interest_rate ? "border-expense" : "border-border-color"}`}
                data-testid="liability-interest-rate-input"
              />
            </div>
            {fieldErrors.interest_rate && (
              <p className="text-xs text-expense mt-1">{fieldErrors.interest_rate}</p>
            )}
          </div>

          {/* Monthly Payment */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">
              Monthly Payment (Optional)
            </label>
            <div className="relative">
              <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
              <input
                type="number"
                step="0.01"
                min="0"
                value={monthlyPayment}
                onChange={(e) => setMonthlyPayment(e.target.value)}
                placeholder="0.00"
                className={`w-full pl-12 pr-4 py-3 bg-white border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all ${fieldErrors.monthly_payment ? "border-expense" : "border-border-color"}`}
                data-testid="liability-monthly-payment-input"
              />
            </div>
            {fieldErrors.monthly_payment && (
              <p className="text-xs text-expense mt-1">{fieldErrors.monthly_payment}</p>
            )}
          </div>
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
          <Button
            type="submit"
            variant="danger"
            disabled={isSubmitting}
            className="flex-1"
            data-testid="liability-submit"
          >
            {isSubmitting ? (
              <Spinner size="sm" className="text-white" />
            ) : mode === "edit" ? (
              "Save Liability"
            ) : (
              "Add Liability"
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
