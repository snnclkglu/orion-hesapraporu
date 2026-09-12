"use client";
import { useId, useState } from "react";
import { normalizePhone, phoneDisplay, phoneError } from "@/lib/account/phone";

export function PhoneInput({
  value,
  original,
  onChange,
}: {
  value: string;
  original: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const legacy = value === original && normalizePhone(original) === null;
  const invalid = !legacy && normalizePhone(value) === null;
  return (
    <label htmlFor={id}>
      Telefon · isteğe bağlı
      <span className="ac-phone">
        {!legacy && (
          <span className="ac-phone-prefix" aria-hidden="true">
            +90
          </span>
        )}
        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          aria-label="Telefon (+90)"
          value={editing ? draft : phoneDisplay(value)}
          placeholder="(xxx) xxx xx xx"
          aria-invalid={invalid}
          aria-describedby={`${id}-help`}
          onFocus={() => {
            setDraft(phoneDisplay(value));
            setEditing(true);
          }}
          onChange={(e) => {
            setDraft(e.target.value);
            onChange(e.target.value);
          }}
          onBlur={(e) => {
            setEditing(false);
            const normalized = normalizePhone(e.target.value);
            if (normalized !== null) onChange(normalized);
          }}
        />
      </span>
      <span id={`${id}-help`} className={invalid ? "ac-error" : "ac-muted"}>
        {invalid
          ? phoneError
          : legacy
            ? "Kayıtlı numaranız korunuyor. Değiştirirken +90 ve 10 rakam kullanın."
            : "Türkiye · 10 rakam. Boş bırakabilirsiniz."}
      </span>
    </label>
  );
}
