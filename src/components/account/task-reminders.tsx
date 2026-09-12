"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { taskReminderPreferences } from "@/app/(app)/panel/workspace-actions";
export function TaskReminders({ preview }: { preview: boolean }) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(preview),
    [pref, setPref] = useState({
      enabled: true,
      quiet_start: 19,
      quiet_end: 8,
    });
  useEffect(() => {
    if (!open || preview) return;
    let active = true;
    taskReminderPreferences()
      .then((r) => {
        if (active && r.data) {
          setPref(r.data);
          setReady(true);
        } else if (active) toast.error(r.error);
      })
      .catch(() => toast.error("Tercihler okunamadı"));
    return () => {
      active = false;
    };
  }, [open, preview]);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Hatırlatma tercihleri
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent mobileKeyboardSafe className="tw-filter-dialog">
          <DialogTitle>Görev hatırlatmaları</DialogTitle>
          <DialogDescription>
            Uygulama açıkken termini yaklaşan görevler Gelen kutusuna eklenir.
            Saatler Türkiye saatidir.
          </DialogDescription>
          <label className="tw-check-item oc-tap">
            <input
              type="checkbox"
              checked={pref.enabled}
              disabled={!ready || busy}
              onChange={(e) =>
                setPref((p) => ({ ...p, enabled: e.target.checked }))
              }
            />
            Termin hatırlatmalarını göster
          </label>
          {(["quiet_start", "quiet_end"] as const).map((key, i) => (
            <label className="tw-flow-field" key={key}>
              {i ? "Sessiz saat bitişi" : "Sessiz saat başlangıcı"}
              <select
                value={pref[key]}
                disabled={!ready || busy}
                onChange={(e) =>
                  setPref((p) => ({ ...p, [key]: Number(e.target.value) }))
                }
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, "0")}:00
                  </option>
                ))}
              </select>
            </label>
          ))}
          <p className="tw-muted">
            İki saat aynıysa sessiz saat uygulanmaz. Aynı görev ve termin için
            tek hatırlatma oluşturulur.
          </p>
          <Button
            disabled={!ready || busy}
            onClick={async () => {
              setBusy(true);
              try {
                if (!preview) {
                  const r = await taskReminderPreferences(pref);
                  if (r.error) {
                    toast.error(r.error);
                    return;
                  }
                }
                toast.success("Hatırlatma tercihleri kaydedildi");
                setOpen(false);
              } catch {
                toast.error("Tercihler kaydedilemedi");
              } finally {
                setBusy(false);
              }
            }}
          >
            Tercihleri kaydet
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
