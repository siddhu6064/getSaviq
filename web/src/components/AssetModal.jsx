import React, { useState, useEffect } from "react";
import { Modal, Button, Spinner } from "./ui";
import { DollarSign, Tag } from "lucide-react";
import { netWorthAPI } from "../services/api";

const ASSET_TYPES = [
  { value: "cash", label: "Cash" },
  { value: "property", label: "Property" },
  { value: "investment", label: "Investment" },
  { value: "other", label: "Other" },
];

export default function AssetModal({ isOpen, onClose, onSuccess, profileId, editingAsset = null }) {
  const mode = editingAsset ? "edit" : "create";

  const [name, setName] = useState("");
  const [type, setType] = useState("cash");
  const [value, setValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const resetForm = () => {
    setName("");
    setType("cash");
    setValue("");
    setError("");
    setFieldErrors({});
  };

  useEffect(() => {
    if (!isOpen) return;
    if (mode === "edit" && editingAsset) {
      setName(editingAsset.name || "");
      setType(editingAsset.type || "cash");
      setValue(editingAsset.value != null ? String(editingAsset.value) : "");
      setError("");
      setFieldErrors({});
      return;
    }
    resetForm();
  }, [isOpen, mode, editingAsset]);

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
    if (value === "" || isNaN(parseFloat(value)) || parseFloat(value) < 0) {
      nextErrors.value = "Enter a valid value (0 or greater).";
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
        value: parseFloat(value),
        currency: "USD",
      };

      if (mode === "edit" && editingAsset?.asset_id) {
        await netWorthAPI.updateAsset(editingAsset.asset_id, {
          name: payload.name,
          type: payload.type,
          value: payload.value,
        });
      } else {
        await netWorthAPI.createAsset(payload);
      }

      resetForm();
      onSuccess(mode === "edit" ? "Asset updated." : "Asset added.");
    } catch (err) {
      const apiError = err?.response?.data?.detail || err?.response?.data?.error?.message;
      setError(apiError || `Failed to ${mode === "edit" ? "update" : "create"} asset.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={mode === "edit" ? "Edit Asset" : "Add Asset"}
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
              placeholder="e.g. Checking Account"
              className={`w-full pl-12 pr-4 py-3 bg-white border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all ${fieldErrors.name ? "border-expense" : "border-border-color"}`}
              data-testid="asset-name-input"
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
            data-testid="asset-type-select"
          >
            {ASSET_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          {fieldErrors.type && <p className="text-xs text-expense mt-1">{fieldErrors.type}</p>}
        </div>

        {/* Value */}
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">
            Current Value <span className="text-expense">*</span>
          </label>
          <div className="relative">
            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
            <input
              type="number"
              step="0.01"
              min="0"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="0.00"
              className={`w-full pl-12 pr-4 py-3 text-xl font-bold bg-white border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all ${fieldErrors.value ? "border-expense" : "border-border-color"}`}
              data-testid="asset-value-input"
            />
          </div>
          {fieldErrors.value && <p className="text-xs text-expense mt-1">{fieldErrors.value}</p>}
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
            disabled={isSubmitting}
            className="flex-1"
            data-testid="asset-submit"
          >
            {isSubmitting ? (
              <Spinner size="sm" className="text-white" />
            ) : mode === "edit" ? (
              "Save Asset"
            ) : (
              "Add Asset"
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
