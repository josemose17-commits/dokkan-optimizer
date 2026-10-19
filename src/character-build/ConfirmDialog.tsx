import { useEffect, useId, useRef, type ReactNode } from 'react';

// Native modal dialog: focus is contained while open and returns to the
// triggering control on close. Escape cancels.
export default function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  destructive = false,
  confirmDisabled = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="cb-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      {open && (
        <>
          <h2 id={titleId}>{title}</h2>
          <div className="cb-dialog-body">{children}</div>
          <div className="cb-dialog-actions">
            <button type="button" className="cb-secondary" onClick={onCancel}>
              Cancel
            </button>
            <button
              type="button"
              className={destructive ? 'cb-danger' : 'cb-primary'}
              disabled={confirmDisabled}
              onClick={onConfirm}
            >
              {confirmLabel}
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}
