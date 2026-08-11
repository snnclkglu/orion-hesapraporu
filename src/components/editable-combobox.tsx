"use client";

// Hem YAZILAN hem SEÇİLEN alan — serbest metin kutusu + öneri listesi.
//
// NEDEN `Combobox` DEĞİL: o bileşenin tetikleyicisi bir DÜĞMEDİR ve değeri
// yalnız listeden seçilir; listede olmayan bir ad ancak arama kutusuna yazıp
// "+ Ekle" satırına basarak girilebiliyordu. İki adım, ve kullanıcı ilk
// bakışta kutunun yazılabilir olduğunu göremiyor. Teknik Resim Takibi'nde grup
// adları her projede biraz farklı yazılıyor (kullanıcı bildirimi, 11.08.2026);
// oradaki asıl hareket YAZMAKTIR, seçmek yalnız hızlandırıcıdır.
//
// Bu yüzden alanın kendisi normal bir `input`tur: değer her tuş vuruşunda
// yazılır, öneriler yazdıkça süzülür ve liste bir öneridir — dayatma değil.
// Kutu boşken de aşağı okla bütün liste açılır.
//
// SÜZME KENDİMİZDE ve Türkçedir (`Combobox` ile aynı gerekçe):
// `toLocaleLowerCase("tr")` olmadan "İŞ" yazan biri "iş"i bulamaz.

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function norm(text: string): string {
  return (text ?? "").toLocaleLowerCase("tr").trim();
}

export function EditableCombobox({
  options,
  value,
  onChange,
  placeholder,
  emptyText = "Öneri yok — yazdığınız ad kullanılır",
  disabled,
  className,
  inputClassName,
  "aria-label": ariaLabel,
  /** Yazılanı büyük harfe çevir (grup adları antedde BÜYÜKTÜR) */
  uppercase = false,
}: {
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  "aria-label"?: string;
  uppercase?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const kap = useRef<HTMLDivElement>(null);
  const listId = useId();

  // Süzgeç YALNIZ kutuda yazan metne bakar. Kutu bir öneriyle birebir aynıysa
  // liste daraltılmaz: kullanıcı seçtiği adı görüp komşusuna geçebilmelidir.
  const filtered = useMemo(() => {
    const q = norm(value);
    if (!q) return options;
    if (options.some((o) => norm(o) === q)) return options;
    const terms = q.split(/\s+/).filter(Boolean);
    return options.filter((o) => {
      const hay = norm(o);
      return terms.every((t) => hay.includes(t));
    });
  }, [options, value]);

  // Dışarı tıklama kutuyu kapatır. `pointerdown` kullanılır ki liste satırına
  // basıldığında `blur` yarışına girmesin (satırın kendi `onMouseDown`u zaten
  // varsayılanı engelliyor).
  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      if (!kap.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  function commit(next: string) {
    onChange(next);
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setActive(0);
        return;
      }
      setActive((i) => Math.min(i + 1, filtered.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter" && open && active >= 0 && filtered[active]) {
      e.preventDefault();
      commit(filtered[active]);
      return;
    }
    if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
      setActive(-1);
    }
  }

  return (
    <div ref={kap} className={cn("relative", className)}>
      <Input
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={ariaLabel}
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-autocomplete="list"
        autoComplete="off"
        onChange={(e) => {
          const v = uppercase ? e.target.value.toLocaleUpperCase("tr") : e.target.value;
          onChange(v);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        // Ok düğmesinin altında kalmasın diye sağ iç boşluk açılır.
        className={cn("pr-8", inputClassName)}
      />
      {!disabled && (
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          onClick={() => setOpen((o) => !o)}
          className="absolute inset-y-0 right-0 flex w-8 items-center justify-center font-mono text-xs leading-none text-muted-foreground hover:text-foreground"
        >
          ▾
        </button>
      )}
      {open && !disabled && (
        // `min-w` GÖRÜNÜR ALANLA KELEPÇELİ DEĞİLDİR çünkü genişlik kabın
        // kendisinden gelir (`inset-x-0`); dar telefonda kutu taşamaz.
        <div
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-[calc(100%+2px)] z-50 max-h-64 overflow-y-auto rounded-md border bg-popover p-1 shadow-md"
        >
          {filtered.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">{emptyText}</p>
          ) : (
            filtered.map((o, i) => (
              <button
                key={o}
                type="button"
                role="option"
                aria-selected={norm(o) === norm(value)}
                // `mousedown` varsayılanı engellenir: aksi hâlde input odağı
                // kaybeder ve tıklama kutuyu kapatan yolla yarışırdı.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commit(o)}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm pointer-coarse:py-2.5",
                  i === active ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
                  norm(o) === norm(value) && "font-medium"
                )}
              >
                <span className="truncate">{o}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
