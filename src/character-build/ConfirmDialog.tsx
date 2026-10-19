import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react';

// Native modal dialog: focus is contained while open and Escape cancels.
// On close, focus returns to the control that opened it; if the confirmed
// action removed that control, focus moves to `fallbackFocus` instead.
export default function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  destructive = false,
  confirmDisabled = false,
  fallbackFocus,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  confirmDisabled?: boolean;
  fallbackFocus?: RefObject<HTMLElement | null>;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);
  const titleId = useId();
  const bodyId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      opener.current = document.activeElement;
      dialog.showModal();
    }
    if (!open && dialog.open) {
      dialog.close();
      const target = opener.current;
      opener.current = null;
      if (target instanceof HTMLElement && target.isConnected) target.focus();
      else fallbackFocus?.current?.focus();
    }
  }, [open, fallbackFocus]);
  return (
    <dialog
      ref={ref}
      className="cb-dialog"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      {open && (
        <>
          <h2 id={titleId}>{title}</h2>
          <div className="cb-dialog-body" id={bodyId}>
            {children}
          </div>
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
