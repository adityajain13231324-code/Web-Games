import React, { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import { IconButton } from "./kit.jsx";

/** Popover anchored to its trigger. Closes on outside click and Escape, and returns focus. */
export function Popover({ trigger, children, align = "end", label }) {
  const [open, setOpen] = useState(false);
  const root = useRef();
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const away = (e) => !root.current?.contains(e.target) && setOpen(false);
    const key = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        root.current?.querySelector("[data-popover-trigger]")?.focus();
      }
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  return (
    <div className="popover" ref={root}>
      {trigger({
        open,
        toggle: () => setOpen((o) => !o),
        props: {
          "data-popover-trigger": true,
          "aria-expanded": open,
          "aria-haspopup": "dialog",
          "aria-controls": id,
        },
      })}
      {open && (
        <div
          id={id}
          role="dialog"
          aria-label={label}
          className={`popover-panel align-${align}`}
        >
          {typeof children === "function"
            ? children(() => setOpen(false))
            : children}
        </div>
      )}
    </div>
  );
}

/** Slide-over drawer built on <dialog> for focus trapping and Escape handling. */
export function Drawer({ title, onClose, children, side = "right" }) {
  const ref = useRef();
  useEffect(() => {
    const previous = document.activeElement;
    ref.current.showModal();
    return () => previous?.focus?.();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`drawer drawer-${side}`}
      onCancel={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <div className="drawer-head">
        <h2>{title}</h2>
        <IconButton label="Close" onClick={onClose}>
          <X size={20} />
        </IconButton>
      </div>
      <div className="drawer-body">{children}</div>
    </dialog>
  );
}

/** Shown when the server was updated while this page stayed open. */
export function UpdatePill() {
  return (
    <div className="reconnect-pill" role="status">
      A new version of the game is ready
      <button type="button" onClick={() => location.reload()}>
        Refresh
      </button>
    </div>
  );
}

/** Pill that replaces broken screens when the socket drops. */
export function ReconnectPill({ onRetry }) {
  return (
    <div className="reconnect-pill" role="status">
      <span className="reconnect-dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      Reconnecting… your place is saved
      <button type="button" onClick={onRetry}>
        Retry now
      </button>
    </div>
  );
}
