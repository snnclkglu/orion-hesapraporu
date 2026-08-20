"use client";

// Taslak revizyonu silme — revizyon listesi satırındaki çöp kutusu.
//
// Düğme YALNIZ taslakta görünür: yayınlanmış revizyon teslim edilmiş bir
// hesabın kaydıdır ve geriye dönük yok edilemez (kural veritabanındaki
// `guard_issued_revision` tetikleyicisindedir). Onay penceresi ne kaybedileceğini
// açıkça söyler — silinen revizyonun girdileri, seçimleri ve ekipman notları
// geri gelmez.

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { deleteRevision } from "../actions";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

export function DeleteRevisionButton({
  projectId,
  revisionId,
  revNo,
  /** Silindikten sonra kalan en büyük revizyon — yeni revizyonun kaynağı */
  fallbackRevNo,
}: {
  projectId: string;
  revisionId: string;
  revNo: number;
  fallbackRevNo: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteRevision(projectId, revisionId);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`V${revNo} için silme talebi Yönetici onayına gönderildi.`);
      setOpen(false);
    });
  }

  return (
    <>
      {/* `icon-sm`: masaüstünde aynı 32px, dokunmatikte 40px. Elle yazılan
          `size-8` dokunma payını tabandan almıyordu. */}
      <Button
        variant="ghost"
        size="icon-sm"
        className="text-destructive"
        onClick={() => setOpen(true)}
        aria-label={`V${revNo} revizyonunu sil`}
        title="Taslak revizyonu sil"
      >
        <Trash2 className="size-3.5" />
      </Button>
      {open && (
        <Dialog open onOpenChange={(o) => !o && setOpen(false)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Revizyonu Sil</DialogTitle>
              <DialogDescription>
                <span className="font-mono">V{revNo}</span> taslağı — girdileri,
                katalog seçimleri ve ekipman notlarıyla birlikte — kalıcı silme
                onayına gönderilecek.{" "}
                {fallbackRevNo === null ? (
                  <>
                    Bu projenin başka revizyonu yok; silindikten sonra hesap
                    raporu şablondan yeniden açılır.
                  </>
                ) : (
                  <>
                    Silindikten sonra açacağınız yeni V{revNo}, kalan{" "}
                    <span className="font-mono">V{fallbackRevNo}</span> revizyonunun
                    kopyasıyla başlar.
                  </>
                )}{" "}
                Revizyon, Yönetici onaylayana kadar değişmeden kalır.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Vazgeç
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={pending}
                onClick={handleDelete}
              >
                {pending ? "Gönderiliyor…" : "Silme Talebi Gönder"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
