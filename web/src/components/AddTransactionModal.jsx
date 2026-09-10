import React, { useState, useMemo, useEffect } from "react";
import { Modal, Button, Tabs, Spinner } from "./ui";
import {
  DollarSign,
  Calendar,
  Tag,
  CreditCard,
  FileText,
  Clock,
  Receipt,
  Camera,
  Sparkles,
  ArrowLeftRight,
  Paperclip,
  Plus,
  X,
  Mic,
} from "lucide-react";
import { expensesAPI, aiAPI, attachmentsAPI } from "../services/api";

export default function AddTransactionModal({
  isOpen,
  onClose,
  onSuccess,
  profiles,
  categories,
  paymentMethods,
  activeProfile,
  mode = "create",
  initialTransaction = null,
}) {
  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [toPaymentMethodId, setToPaymentMethodId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [time, setTime] = useState("");
  const [merchant, setMerchant] = useState("");
  const [notes, setNotes] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState("monthly");
  const [recurringStartDate, setRecurringStartDate] = useState("");
  const [recurringEndDate, setRecurringEndDate] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [isScanning, setIsScanning] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [attachmentError, setAttachmentError] = useState("");
  const [quickAddText, setQuickAddText] = useState("");
  const [isParsingQuickAdd, setIsParsingQuickAdd] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const SpeechRecognitionCtor =
    typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);

  const resetForm = () => {
    setType("expense");
    setAmount("");
    setDescription("");
    setCategoryId("");
    setPaymentMethodId(paymentMethods.find((p) => p.is_default)?.payment_id || "");
    setToPaymentMethodId("");
    setDate(new Date().toISOString().split("T")[0]);
    setTime("");
    setMerchant("");
    setNotes("");
    setShowNotes(false);
    setAttachments([]);
    setAttachmentError("");
    setIsRecurring(false);
    setRecurringFrequency("monthly");
    setRecurringStartDate("");
    setRecurringEndDate("");
    setIsPending(false);
    setError("");
    setFieldErrors({});
    setQuickAddText("");
  };

  useEffect(() => {
    if (!isOpen) return;
    if (mode === "edit" && initialTransaction) {
      setType(initialTransaction.type || "expense");
      setAmount(initialTransaction.amount ? String(initialTransaction.amount) : "");
      setDescription(initialTransaction.description || "");
      setCategoryId(initialTransaction.category_id || "");
      setPaymentMethodId(
        initialTransaction.payment_method_id ||
          paymentMethods.find((p) => p.is_default)?.payment_id ||
          "",
      );
      setToPaymentMethodId(initialTransaction.to_payment_method_id || "");
      setDate(
        initialTransaction.date
          ? new Date(initialTransaction.date).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
      );
      setTime(initialTransaction.time || "");
      setMerchant(initialTransaction.merchant || "");
      setNotes(initialTransaction.notes || "");
      setShowNotes(!!initialTransaction.notes);
      setAttachments(initialTransaction.attachments || []);
      setAttachmentError("");
      setIsRecurring(!!initialTransaction.is_recurring);
      setRecurringFrequency(initialTransaction.recurring_frequency || "monthly");
      setRecurringStartDate(
        initialTransaction.recurring_start_date
          ? new Date(initialTransaction.recurring_start_date).toISOString().split("T")[0]
          : "",
      );
      setRecurringEndDate(
        initialTransaction.recurring_end_date
          ? new Date(initialTransaction.recurring_end_date).toISOString().split("T")[0]
          : "",
      );
      setIsPending(!!initialTransaction.is_pending);
      setError("");
      setFieldErrors({});
      return;
    }
    resetForm();
  }, [isOpen, mode, initialTransaction, paymentMethods]);

  useEffect(() => {
    if (type !== "transfer") {
      setToPaymentMethodId("");
    }
    if (type === "transfer") {
      setCategoryId("");
    }
  }, [type]);

  useEffect(() => {
    if (paymentMethodId && toPaymentMethodId && paymentMethodId === toPaymentMethodId) {
      setToPaymentMethodId("");
    }
  }, [paymentMethodId, toPaymentMethodId]);

  useEffect(() => {
    if (!isRecurring) {
      setRecurringFrequency("monthly");
      setRecurringStartDate("");
      setRecurringEndDate("");
    }
  }, [isRecurring]);

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleScanReceipt = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsScanning(true);
      setError("");

      // Convert to base64
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = reader.result;
          const response = await aiAPI.scanReceipt(base64);
          const result = response.data;

          if (result.amount) setAmount(result.amount.toString());
          if (result.merchant) {
            setMerchant(result.merchant);
            setDescription(result.merchant);
          }
          if (result.date) setDate(result.date);
          if (result.time) setTime(result.time);

          // Try to match category suggestion
          if (result.category_suggestion) {
            const matchedCategory = categories.find(
              (c) => c.name.toLowerCase() === result.category_suggestion.toLowerCase(),
            );
            if (matchedCategory) setCategoryId(matchedCategory.category_id);
          }
        } catch (err) {
          setError("Failed to scan receipt. Please try again.");
        } finally {
          setIsScanning(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError("Failed to process image");
      setIsScanning(false);
    }
  };

  const handleQuickAddMic = () => {
    if (!SpeechRecognitionCtor) return;
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (e) => {
      setQuickAddText(e.results[0][0].transcript);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
    setIsListening(true);
  };

  const handleQuickAddParse = async () => {
    if (!quickAddText.trim()) return;
    setIsParsingQuickAdd(true);
    setError("");
    try {
      const response = await aiAPI.parseExpenseText(quickAddText.trim());
      const result = response.data;
      if (result.type === "income" || result.type === "expense") setType(result.type);
      if (result.amount) setAmount(String(result.amount));
      if (result.description) setDescription(result.description);
      else if (result.merchant) setDescription(result.merchant);
      if (result.merchant) setMerchant(result.merchant);
      if (result.date) setDate(result.date);
      if (result.category_suggestion) {
        const matchedCategory = categories.find(
          (c) => c.name.toLowerCase() === result.category_suggestion.toLowerCase(),
        );
        if (matchedCategory) setCategoryId(matchedCategory.category_id);
      }
      setQuickAddText("");
    } catch {
      setError("Couldn't parse that — please fill in the details manually.");
    } finally {
      setIsParsingQuickAdd(false);
    }
  };

  const uploadAttachment = async (file) => {
    const ALLOWED = ["image/jpeg", "image/png", "application/pdf", "image/heic", "image/heif"];
    if (!ALLOWED.includes(file.type)) {
      setAttachmentError("Only JPG, PNG, PDF, HEIC files allowed.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setAttachmentError("File must be under 10 MB.");
      return;
    }
    if (attachments.length >= 3) {
      setAttachmentError("Maximum 3 attachments reached.");
      return;
    }
    setAttachmentError("");
    setIsUploadingAttachment(true);
    try {
      const res = await attachmentsAPI.upload(initialTransaction.expense_id, file);
      setAttachments((prev) => [...prev, res.data.url]);
    } catch (err) {
      setAttachmentError(err.response?.data?.detail || "Upload failed.");
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  const handleDropAttachment = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await uploadAttachment(file);
  };

  const handleDeleteAttachment = async (url) => {
    try {
      await attachmentsAPI.remove(initialTransaction.expense_id, url);
      setAttachments((prev) => prev.filter((a) => a !== url));
    } catch {
      setAttachmentError("Failed to remove attachment.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setFieldErrors({});
    if (isSubmitting) return;

    const nextErrors = {};

    if (!amount || parseFloat(amount) <= 0) {
      nextErrors.amount = "Enter an amount greater than 0.";
    }

    if (!description.trim()) {
      nextErrors.description = "Description is required.";
    }

    if (!paymentMethodId) {
      nextErrors.payment_method_id = "Select a payment method.";
    }

    if (type === "transfer" && !toPaymentMethodId) {
      nextErrors.to_payment_method_id = "Destination account is required for transfers.";
    }

    if (
      type === "transfer" &&
      paymentMethodId &&
      toPaymentMethodId &&
      paymentMethodId === toPaymentMethodId
    ) {
      nextErrors.to_payment_method_id =
        "Destination account must be different from source account.";
    }

    if (isRecurring && !recurringFrequency) {
      nextErrors.recurring_frequency = "Recurring frequency is required when recurring is enabled.";
    }

    if (isRecurring && recurringEndDate && !recurringStartDate) {
      nextErrors.recurring_start_date = "Set a recurring start date when using an end date.";
    }

    if (
      isRecurring &&
      recurringStartDate &&
      recurringEndDate &&
      new Date(recurringEndDate) < new Date(recurringStartDate)
    ) {
      nextErrors.recurring_end_date = "Recurring end date cannot be before recurring start date.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setError("Please correct the highlighted fields.");
      return;
    }

    try {
      setIsSubmitting(true);

      const payload = {
        profile_id: activeProfile?.profile_id,
        type,
        amount: parseFloat(amount),
        description: description.trim(),
        category_id: type !== "transfer" ? categoryId : null,
        payment_method_id: paymentMethodId,
        to_payment_method_id: type === "transfer" ? toPaymentMethodId : null,
        date: new Date(date).toISOString(),
        time: time || null,
        merchant: merchant.trim() || null,
        notes: notes.trim() || null,
        is_recurring: isRecurring,
        recurring_frequency: isRecurring ? recurringFrequency : null,
        recurring_start_date: isRecurring
          ? recurringStartDate
            ? new Date(`${recurringStartDate}T00:00:00`).toISOString()
            : null
          : null,
        recurring_end_date: isRecurring
          ? recurringEndDate
            ? new Date(`${recurringEndDate}T23:59:59`).toISOString()
            : null
          : null,
        is_pending: isPending,
      };

      if (mode === "edit" && initialTransaction?.expense_id) {
        await expensesAPI.update(initialTransaction.expense_id, payload);
      } else {
        await expensesAPI.create(payload);
      }

      resetForm();
      onSuccess(
        mode === "edit" ? "Transaction updated successfully." : "Transaction added successfully.",
      );
    } catch (err) {
      const apiError = err?.response?.data?.error?.message || err?.response?.data?.detail;
      setError(apiError || `Failed to ${mode === "edit" ? "update" : "create"} transaction`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredCategories = useMemo(
    () => (type === "transfer" ? [] : categories),
    [categories, type],
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={mode === "edit" ? "Edit Transaction" : "Add Transaction"}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Transaction Type Tabs */}
        <Tabs
          tabs={[
            { value: "expense", label: "Expense" },
            { value: "income", label: "Income" },
            { value: "transfer", label: "Transfer" },
          ]}
          activeTab={type}
          onChange={setType}
        />

        {/* AI Receipt Scanner */}
        <div className="flex items-center gap-3 p-4 bg-surface-hover rounded-xl">
          <div className="flex-1">
            <p className="text-sm font-medium text-text-primary flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-warning" />
              Scan Receipt with AI
            </p>
            <p className="text-xs text-text-secondary mt-0.5">
              Upload a receipt image to auto-fill details
            </p>
          </div>
          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleScanReceipt}
              disabled={isScanning}
            />
            <div className="flex items-center gap-2 px-4 py-2 bg-white border border-border-color rounded-lg hover:bg-surface-hover transition-colors">
              {isScanning ? (
                <Spinner size="sm" />
              ) : (
                <>
                  <Camera className="w-4 h-4 text-text-secondary" />
                  <span className="text-sm font-medium">Upload</span>
                </>
              )}
            </div>
          </label>
        </div>

        {/* Quick Add: type or dictate a sentence, AI fills the form */}
        {mode !== "edit" && (
          <div className="p-4 bg-surface-hover rounded-xl">
            <p className="text-sm font-medium text-text-primary flex items-center gap-2 mb-2">
              <Mic className="w-4 h-4 text-brand-primary" />
              Quick Add
            </p>
            <p className="text-xs text-text-secondary mb-2">
              Type or dictate, e.g. "Spent $45 on lunch at Chipotle yesterday"
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={quickAddText}
                onChange={(e) => setQuickAddText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleQuickAddParse();
                  }
                }}
                placeholder="Spent $45 on lunch at Chipotle yesterday"
                className="flex-1 min-w-0 px-4 py-2.5 bg-white border border-border-color rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all text-sm"
              />
              {SpeechRecognitionCtor && (
                <button
                  type="button"
                  onClick={handleQuickAddMic}
                  aria-label="Dictate"
                  className={`px-3 py-2.5 border border-border-color rounded-lg transition-colors ${
                    isListening
                      ? "bg-brand-primary text-white"
                      : "bg-white text-text-secondary hover:bg-surface-hover"
                  }`}
                >
                  <Mic className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={handleQuickAddParse}
                disabled={isParsingQuickAdd || !quickAddText.trim()}
                className="px-4 py-2.5 bg-white border border-border-color rounded-lg hover:bg-surface-hover transition-colors text-sm font-medium disabled:opacity-50"
              >
                {isParsingQuickAdd ? <Spinner size="sm" /> : "Parse"}
              </button>
            </div>
          </div>
        )}

        {error && <div className="p-3 bg-expense-bg text-expense text-sm rounded-xl">{error}</div>}

        <div>
          <h3 className="text-sm font-semibold text-text-primary mb-2">Required details</h3>
        </div>

        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">
            Amount <span className="text-expense">*</span>
          </label>
          <div className="relative">
            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className={`w-full pl-12 pr-4 py-3 text-2xl font-bold bg-white border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all ${fieldErrors.amount ? "border-expense" : "border-border-color"}`}
              data-testid="amount-input"
            />
          </div>
          {fieldErrors.amount && <p className="text-xs text-expense mt-1">{fieldErrors.amount}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">
              Description <span className="text-expense">*</span>
            </label>
            <div className="relative">
              <FileText className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What was this for?"
                className={`w-full pl-12 pr-4 py-3 bg-white border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all ${fieldErrors.description ? "border-expense" : "border-border-color"}`}
                data-testid="description-input"
              />
            </div>
            {fieldErrors.description && (
              <p className="text-xs text-expense mt-1">{fieldErrors.description}</p>
            )}
          </div>

          {/* Merchant */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">
              Merchant (Optional)
            </label>
            <div className="relative">
              <Receipt className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
              <input
                type="text"
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                placeholder="Store or vendor name"
                className="w-full pl-12 pr-4 py-3 bg-white border border-border-color rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all"
                data-testid="merchant-input"
              />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-text-primary mb-2">
            Classification & accounts
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Category (not for transfers) */}
          {type !== "transfer" && (
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Category</label>
              <div className="relative">
                <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full pl-12 pr-10 py-3 bg-white border border-border-color rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all"
                  data-testid="category-select"
                >
                  <option value="">Select category</option>
                  {filteredCategories.map((cat) => (
                    <option key={cat.category_id} value={cat.category_id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">
              {type === "transfer" ? "From Account" : "Payment Method"}{" "}
              <span className="text-expense">*</span>
            </label>
            <div className="relative">
              <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
              <select
                value={paymentMethodId}
                onChange={(e) => setPaymentMethodId(e.target.value)}
                className={`w-full pl-12 pr-10 py-3 bg-white border rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all ${fieldErrors.payment_method_id ? "border-expense" : "border-border-color"}`}
                data-testid="payment-method-select"
              >
                <option value="">Select payment method</option>
                {paymentMethods.map((pm) => (
                  <option key={pm.payment_id} value={pm.payment_id}>
                    {pm.name}
                  </option>
                ))}
              </select>
            </div>
            {fieldErrors.payment_method_id && (
              <p className="text-xs text-expense mt-1">{fieldErrors.payment_method_id}</p>
            )}
          </div>

          {/* To Payment Method (for transfers) */}
          {type === "transfer" && (
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">
                To Account <span className="text-expense">*</span>
              </label>
              <div className="relative">
                <ArrowLeftRight className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
                <select
                  value={toPaymentMethodId}
                  onChange={(e) => setToPaymentMethodId(e.target.value)}
                  className={`w-full pl-12 pr-10 py-3 bg-white border rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all ${fieldErrors.to_payment_method_id ? "border-expense" : "border-border-color"}`}
                  data-testid="to-payment-method-select"
                >
                  <option value="">Select destination</option>
                  {paymentMethods
                    .filter((pm) => pm.payment_id !== paymentMethodId)
                    .map((pm) => (
                      <option key={pm.payment_id} value={pm.payment_id}>
                        {pm.name}
                      </option>
                    ))}
                </select>
              </div>
              <p className="text-xs text-text-secondary mt-1">
                Choose where the money is transferred to.
              </p>
              {fieldErrors.to_payment_method_id && (
                <p className="text-xs text-expense mt-1">{fieldErrors.to_payment_method_id}</p>
              )}
            </div>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-text-primary mb-2">When & extra details</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">Date</label>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white border border-border-color rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all"
                data-testid="date-input"
              />
            </div>
          </div>

          {/* Time */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">
              Time (Optional)
            </label>
            <div className="relative">
              <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white border border-border-color rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all"
                data-testid="time-input"
              />
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          {!showNotes ? (
            <button
              type="button"
              onClick={() => setShowNotes(true)}
              className="text-sm text-brand-primary hover:text-brand-primary/80 flex items-center gap-1 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add note
            </button>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-text-primary">
                  Notes (Optional)
                </label>
                <span className="text-xs text-text-secondary">{notes.length} / 500</span>
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value.slice(0, 500))}
                placeholder="Add any additional notes..."
                rows={3}
                maxLength={500}
                className="w-full px-4 py-3 bg-white border border-border-color rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all resize-none"
                data-testid="notes-input"
                autoFocus
              />
            </div>
          )}
        </div>

        {/* Attachments — edit mode only */}
        {mode === "edit" && initialTransaction?.expense_id && (
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-2">Attachments</h3>

            {/* Thumbnail grid */}
            {attachments.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                {attachments.map((url) => {
                  const filename = url.split("/").pop() || "";
                  const isPdf = filename.toLowerCase().endsWith(".pdf");
                  const displayName = filename.includes("_")
                    ? filename.slice(filename.indexOf("_") + 1)
                    : filename;
                  return (
                    <div
                      key={url}
                      className="relative group rounded-lg overflow-hidden border border-border-color bg-surface-hover aspect-square flex items-center justify-center"
                    >
                      {isPdf ? (
                        <div className="flex flex-col items-center gap-1 p-2 text-center w-full">
                          <FileText className="w-8 h-8 text-text-secondary" />
                          <span className="text-xs text-text-secondary truncate w-full text-center px-1">
                            {displayName}
                          </span>
                        </div>
                      ) : (
                        <img src={url} alt={displayName} className="w-full h-full object-cover" />
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteAttachment(url)}
                        className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Remove attachment"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Drop zone */}
            {attachments.length < 3 ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDropAttachment}
                onClick={() => document.getElementById("attachment-file-input").click()}
                className={`border-2 border-dashed rounded-xl p-5 text-center transition-colors cursor-pointer ${
                  isDragging
                    ? "border-brand-primary bg-brand-primary/5"
                    : "border-border-color hover:border-brand-primary/50"
                }`}
              >
                <Paperclip className="w-5 h-5 mx-auto mb-2 text-text-secondary" />
                {isUploadingAttachment ? (
                  <div className="flex items-center justify-center gap-2">
                    <Spinner size="sm" />
                    <span className="text-sm text-text-secondary">Uploading…</span>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-text-secondary">
                      Drop files here or{" "}
                      <span className="text-brand-primary font-medium">Browse</span>
                    </p>
                    <p className="text-xs text-text-secondary mt-1">
                      JPG, PNG, PDF, HEIC · max 10 MB · {3 - attachments.length} slot
                      {3 - attachments.length !== 1 ? "s" : ""} remaining
                    </p>
                  </>
                )}
                <input
                  id="attachment-file-input"
                  type="file"
                  className="hidden"
                  accept="image/jpeg,image/png,application/pdf,image/heic,image/heif"
                  onChange={(e) => {
                    if (e.target.files?.[0]) uploadAttachment(e.target.files[0]);
                    e.target.value = "";
                  }}
                />
              </div>
            ) : (
              <p className="text-sm text-text-secondary text-center py-2">
                Maximum 3 attachments reached.
              </p>
            )}

            {attachmentError && <p className="text-xs text-expense mt-1">{attachmentError}</p>}
          </div>
        )}

        {/* Options */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
              className="w-4 h-4 rounded border-border-color text-brand-primary focus:ring-brand-primary/20"
            />
            <span className="text-sm text-text-primary">Recurring</span>
          </label>

          {isRecurring && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 rounded-xl bg-surface-hover">
              <div>
                <label className="block text-xs font-medium text-text-primary mb-1.5">
                  Frequency <span className="text-expense">*</span>
                </label>
                <select
                  value={recurringFrequency}
                  onChange={(e) => setRecurringFrequency(e.target.value)}
                  className={`w-full px-3 py-2 text-sm bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/20 ${fieldErrors.recurring_frequency ? "border-expense" : "border-border-color"}`}
                  data-testid="recurring-frequency-select"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
                {fieldErrors.recurring_frequency && (
                  <p className="text-xs text-expense mt-1">{fieldErrors.recurring_frequency}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-text-primary mb-1.5">
                  Recurring Start (Optional)
                </label>
                <input
                  type="date"
                  value={recurringStartDate}
                  onChange={(e) => setRecurringStartDate(e.target.value)}
                  className={`w-full px-3 py-2 text-sm bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/20 ${fieldErrors.recurring_start_date ? "border-expense" : "border-border-color"}`}
                  data-testid="recurring-start-date-input"
                />
                {fieldErrors.recurring_start_date && (
                  <p className="text-xs text-expense mt-1">{fieldErrors.recurring_start_date}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-text-primary mb-1.5">
                  Recurring End (Optional)
                </label>
                <input
                  type="date"
                  value={recurringEndDate}
                  onChange={(e) => setRecurringEndDate(e.target.value)}
                  className={`w-full px-3 py-2 text-sm bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/20 ${fieldErrors.recurring_end_date ? "border-expense" : "border-border-color"}`}
                  data-testid="recurring-end-date-input"
                />
                {fieldErrors.recurring_end_date && (
                  <p className="text-xs text-expense mt-1">{fieldErrors.recurring_end_date}</p>
                )}
              </div>
              <p className="text-xs text-text-secondary md:col-span-3">
                Recurring dates are optional; if set, end must be on/after start.
              </p>
            </div>
          )}

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isPending}
              onChange={(e) => setIsPending(e.target.checked)}
              className="w-4 h-4 rounded border-border-color text-brand-primary focus:ring-brand-primary/20"
            />
            <span className="text-sm text-text-primary">Pending</span>
          </label>
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
            variant={type === "income" ? "income" : type === "expense" ? "expense" : "primary"}
            data-testid="submit-transaction"
          >
            {isSubmitting ? (
              <Spinner size="sm" className="text-white" />
            ) : (
              `${mode === "edit" ? "Save" : "Add"} ${type.charAt(0).toUpperCase() + type.slice(1)}`
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
