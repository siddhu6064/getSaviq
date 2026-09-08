import React from "react";
import { Modal, Button, Spinner } from "./ui";

/**
 * Shared "are you sure?" confirmation modal for destructive delete actions.
 * Not for the account-deletion flow (SettingsPage) — that one requires
 * typing "DELETE" to confirm and stays as its own, more involved modal.
 */
export default function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Delete",
  message,
  confirmLabel = "Delete",
  isConfirming = false,
  testId = "confirm-delete",
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <p className="text-text-secondary mb-6">{message}</p>
      <div className="flex gap-3">
        <Button variant="secondary" onClick={onClose} disabled={isConfirming} className="flex-1">
          Cancel
        </Button>
        <Button
          variant="danger"
          onClick={onConfirm}
          disabled={isConfirming}
          className="flex-1"
          data-testid={testId}
        >
          {isConfirming ? <Spinner size="sm" className="text-white" /> : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
