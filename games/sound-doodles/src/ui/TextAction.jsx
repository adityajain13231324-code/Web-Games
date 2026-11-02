import React, { useState } from "react";
import { ArrowRight } from "lucide-react";

export function TextAction({
  label,
  placeholder,
  button = "Submit",
  onSubmit,
  initial = "",
}) {
  const [value, setValue] = useState(initial),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="text-action"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!value.trim()) return;
        setBusy(true);
        try {
          await onSubmit(value);
          setValue("");
        } catch {
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="field">
        {label}
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={100}
          required
          placeholder={placeholder}
          autoComplete="off"
        />
      </label>
      <button className="button primary" disabled={busy}>
        {button}
        <ArrowRight size={17} />
      </button>
    </form>
  );
}
