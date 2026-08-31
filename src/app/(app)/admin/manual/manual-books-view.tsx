"use client";

// EL KİTABI DEFTERLERİNİN ÇALIŞMA YÜZÜ.
//
// ÜÇ SEKME, TEK EKRAN: bakım kuralları, yağlama noktaları, metin parçaları.
// Üçü de aynı soruya cevap verir — "her kılavuzda tekrar eden şey nerede
// tanımlı" — ve ayrı ekranlara bölmek, aralarındaki bağı görünmez kılardı.
//
// KOD SATIRI SALT OKUNURDUR ve rozetiyle öyle görünür. "Değiştir" bir override
// satırı doğurur; "Öntanıma dön" onu siler. Kapatmak silmek değildir.

import { useState, useTransition } from "react";
import { Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import {
  deleteManualSnippet,
  resetManualLubricationPoint,
  resetManualMaintenanceRule,
  saveManualLubricationPoint,
  saveManualMaintenanceRule,
} from "./actions";

export interface BakimSatiri {
  id: string;
  kodda: boolean;
  defterde: boolean;
  kapali: boolean;
  match: string;
  part: string;
  task: string;
  person: string;
  freq: string;
  state: string;
  basis: string;
  minGroup: string;
  sort: number;
}

export interface YaglamaSatiri {
  id: string;
  kodda: boolean;
  defterde: boolean;
  kapali: boolean;
  match: string;
  place: string;
  klass: string;
  basis: string;
  sort: number;
}

export interface ParcaSatiri {
  id: string;
  title: string;
  category: string;
  sectionHint: string;
  kind: string;
}

/** Şablonun kendi açıklama çizelgesindeki kodlar — ikinci kez TANIMLANMAZ. */
const KISI: Record<string, string> = {
  F: "F — Montajcı",
  E: "E — Elektrikçi",
  MA: "MA — Bakım Teknisyeni",
  I: "I — Denetmen",
};
const SIKLIK: Record<string, string> = {
  d: "d — Günlük",
  w: "w — Haftalık",
  "2w": "2w — İki haftada bir",
  m: "m — Aylık",
  "2m": "2m — İki ayda bir",
  y: "y — Yılda bir",
  "2y": "2y — İki yılda bir",
};
const DURUM: Record<string, string> = {
  R: "R — Ana şalter kesik",
  AR: "AR — Bara dahil kesik",
  LR: "LR — Çalışır durumda",
};

function KaynakRozeti({ satir }: { satir: { kodda: boolean; defterde: boolean; kapali: boolean } }) {
  if (satir.kapali) return <Badge variant="outline">Kapalı</Badge>;
  if (satir.kodda && satir.defterde) return <Badge variant="secondary">Kod · değiştirildi</Badge>;
  if (satir.kodda) return <Badge variant="outline">Kod</Badge>;
  return <Badge>Defter</Badge>;
}

export function ManualBooksView({
  bakim,
  yaglama,
  parcalar,
  hata,
}: {
  bakim: BakimSatiri[];
  yaglama: YaglamaSatiri[];
  parcalar: ParcaSatiri[];
  hata: string;
}) {
  const [bekliyor, basla] = useTransition();
  const [bakimDuzen, setBakimDuzen] = useState<BakimSatiri | null>(null);
  const [yaglamaDuzen, setYaglamaDuzen] = useState<YaglamaSatiri | null>(null);

  const calistir = (islem: () => Promise<{ ok?: boolean; error?: string }>, basari: string) =>
    basla(async () => {
      const sonuc = await islem();
      if (sonuc.error) toast.error(sonuc.error);
      else toast.success(basari);
    });

  const bosBakim = (): BakimSatiri => ({
    id: "",
    kodda: false,
    defterde: false,
    kapali: false,
    match: "",
    part: "",
    task: "",
    person: "MA",
    freq: "m",
    state: "AR",
    basis: "",
    minGroup: "",
    sort: 0,
  });

  const bosYaglama = (): YaglamaSatiri => ({
    id: "",
    kodda: false,
    defterde: false,
    kapali: false,
    match: "",
    place: "",
    klass: "",
    basis: "",
    sort: 0,
  });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="El Kitabı Defterleri"
        hint="Bakım çizelgesi ve yağlama tablosu bu defterlerden ÜRETİLİR. Standart dayanaklı satırlar kodda yaşar ve burada salt okunur görünür; firmaya özel satırları buradan eklersiniz."
      />

      {hata ? (
        <p className="border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          Defter okunamadı: {hata}
        </p>
      ) : null}

      <Tabs defaultValue="bakim">
        <TabsList>
          <TabsTrigger value="bakim">Bakım Kuralları ({bakim.length})</TabsTrigger>
          <TabsTrigger value="yaglama">Yağlama Noktaları ({yaglama.length})</TabsTrigger>
          <TabsTrigger value="parca">Metin Parçaları ({parcalar.length})</TabsTrigger>
        </TabsList>

        {/* —————————————————————————————————————————— bakım kuralları */}
        <TabsContent value="bakim" className="flex flex-col gap-3">
          <div className="flex justify-end">
            <Button className="oc-tap" onClick={() => setBakimDuzen(bosBakim())}>
              <Plus className="size-4" /> Kural Ekle
            </Button>
          </div>
          <ul className="flex flex-col gap-2">
            {bakim.map((r) => (
              <li
                key={r.id}
                className={`border p-3 text-sm ${r.kapali ? "opacity-55" : ""}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <KaynakRozeti satir={r} />
                  <span className="font-medium">{r.part || r.id}</span>
                  <code className="text-xs text-muted-foreground">{r.id}</code>
                  <span className="ml-auto flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="oc-tap"
                      aria-label="Değiştir"
                      onClick={() => setBakimDuzen({ ...r })}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    {r.defterde ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="oc-tap"
                        aria-label={r.kodda ? "Öntanıma dön" : "Sil"}
                        disabled={bekliyor}
                        onClick={() =>
                          calistir(
                            () => resetManualMaintenanceRule(r.id),
                            r.kodda ? "Öntanıma dönüldü." : "Kural silindi."
                          )
                        }
                      >
                        {r.kodda ? <RotateCcw className="size-4" /> : <Trash2 className="size-4" />}
                      </Button>
                    ) : null}
                  </span>
                </div>
                <p className="mt-1 text-muted-foreground">{r.task || "—"}</p>
                <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{KISI[r.person] ?? r.person}</span>
                  <span>{SIKLIK[r.freq] ?? r.freq}</span>
                  <span>{DURUM[r.state] ?? r.state}</span>
                  {r.match ? <span>Desen: {r.match}</span> : <span>Ekipmandan bağımsız</span>}
                  {r.minGroup ? <span>{r.minGroup} ve üstü</span> : null}
                  {r.basis ? <span>Dayanak: {r.basis}</span> : null}
                </p>
              </li>
            ))}
          </ul>
        </TabsContent>

        {/* ————————————————————————————————————— yağlama noktaları */}
        <TabsContent value="yaglama" className="flex flex-col gap-3">
          <div className="flex justify-end">
            <Button className="oc-tap" onClick={() => setYaglamaDuzen(bosYaglama())}>
              <Plus className="size-4" /> Nokta Ekle
            </Button>
          </div>
          <ul className="flex flex-col gap-2">
            {yaglama.map((r) => (
              <li key={r.id} className={`border p-3 text-sm ${r.kapali ? "opacity-55" : ""}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <KaynakRozeti satir={r} />
                  <span className="font-medium">{r.place || r.id}</span>
                  <code className="text-xs text-muted-foreground">{r.id}</code>
                  <span className="ml-auto flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="oc-tap"
                      aria-label="Değiştir"
                      onClick={() => setYaglamaDuzen({ ...r })}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    {r.defterde ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="oc-tap"
                        aria-label={r.kodda ? "Öntanıma dön" : "Sil"}
                        disabled={bekliyor}
                        onClick={() =>
                          calistir(
                            () => resetManualLubricationPoint(r.id),
                            r.kodda ? "Öntanıma dönüldü." : "Nokta silindi."
                          )
                        }
                      >
                        {r.kodda ? <RotateCcw className="size-4" /> : <Trash2 className="size-4" />}
                      </Button>
                    ) : null}
                  </span>
                </div>
                <p className="mt-1 text-muted-foreground">{r.klass || "—"}</p>
                <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                  {r.match ? <span>Desen: {r.match}</span> : <span>Her vinçte</span>}
                  {r.basis ? <span>Dayanak: {r.basis}</span> : null}
                </p>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Yağlama tablosunun Shell / Mobil / B.P. sütunları BOŞ üretilir: uygulamada
            yağlayıcı kataloğu yoktur ve ürün adı uydurulmaz. Buradaki yağ sınıfı,
            tablonun üstüne düşen köprü notunu kurar.
          </p>
        </TabsContent>

        {/* ———————————————————————————————————————— metin parçaları */}
        <TabsContent value="parca" className="flex flex-col gap-3">
          {parcalar.length === 0 ? (
            <EmptyState
              title="Defter boş"
              description="Metin parçaları el kitabı editöründen kaydedilir: bir bloğun sağındaki «Deftere kaydet» düğmesi onu buraya ekler ve sonraki kılavuzlarda tek tıkla eklenir."
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {parcalar.map((p) => (
                <li key={p.id} className="flex items-center gap-2 border p-3 text-sm">
                  <Badge variant="outline">{p.kind}</Badge>
                  <span className="font-medium">{p.title}</span>
                  {p.category ? (
                    <span className="text-xs text-muted-foreground">{p.category}</span>
                  ) : null}
                  {p.sectionHint ? (
                    <code className="text-xs text-muted-foreground">{p.sectionHint}</code>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="oc-tap ml-auto"
                    aria-label="Sil"
                    disabled={bekliyor}
                    onClick={() => calistir(() => deleteManualSnippet(p.id), "Parça silindi.")}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      {/* ————————————————————————————————————————— bakım düzenleyici */}
      <Dialog open={bakimDuzen !== null} onOpenChange={(a) => !a && setBakimDuzen(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {bakimDuzen?.kodda ? "Kod kuralını değiştir" : "Bakım kuralı"}
            </DialogTitle>
          </DialogHeader>
          {bakimDuzen ? (
            <div className="flex flex-col gap-3">
              {bakimDuzen.kodda ? (
                <p className="bg-muted p-2 text-xs text-muted-foreground">
                  Bu kural kodda tanımlıdır ve dayanağı bir standarttır. Kaydettiğinizde
                  bir defter satırı doğar ve kod kuralının üzerine biner; «Öntanıma dön»
                  ile her zaman geri alabilirsiniz.
                </p>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="bk-id">Kimlik</Label>
                  <Input
                    id="bk-id"
                    value={bakimDuzen.id}
                    disabled={bakimDuzen.kodda}
                    onChange={(e) => setBakimDuzen({ ...bakimDuzen, id: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="bk-part">Parça</Label>
                  <Input
                    id="bk-part"
                    value={bakimDuzen.part}
                    onChange={(e) => setBakimDuzen({ ...bakimDuzen, part: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="bk-task">Görev</Label>
                <Textarea
                  id="bk-task"
                  rows={3}
                  value={bakimDuzen.task}
                  onChange={(e) => setBakimDuzen({ ...bakimDuzen, task: e.target.value })}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {(
                  [
                    ["person", "Kişi", KISI],
                    ["freq", "Sıklık", SIKLIK],
                    ["state", "Çalışma durumu", DURUM],
                  ] as const
                ).map(([alan, etiket, sozluk]) => (
                  <div key={alan} className="flex flex-col gap-1">
                    <Label>{etiket}</Label>
                    <Select
                      value={bakimDuzen[alan]}
                      onValueChange={(v) => setBakimDuzen({ ...bakimDuzen, [alan]: v })}
                    >
                      <SelectTrigger className="oc-tap">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(sozluk).map(([k, v]) => (
                          <SelectItem key={k} value={k}>
                            {v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="bk-match">Ekipman deseni</Label>
                  <Input
                    id="bk-match"
                    value={bakimDuzen.match}
                    onChange={(e) => setBakimDuzen({ ...bakimDuzen, match: e.target.value })}
                  />
                  <span className="text-xs text-muted-foreground">
                    Boşsa kural her vinçte basılır. Örnek: <code>^Redüktör$</code>
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="bk-group">En düşük grup</Label>
                  <Input
                    id="bk-group"
                    value={bakimDuzen.minGroup}
                    onChange={(e) => setBakimDuzen({ ...bakimDuzen, minGroup: e.target.value })}
                  />
                  <span className="text-xs text-muted-foreground">
                    Örnek: <code>M7</code> — boşsa her grupta geçerli.
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="bk-basis">Dayanak</Label>
                <Input
                  id="bk-basis"
                  value={bakimDuzen.basis}
                  onChange={(e) => setBakimDuzen({ ...bakimDuzen, basis: e.target.value })}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={bakimDuzen.kapali}
                  onChange={(e) => setBakimDuzen({ ...bakimDuzen, kapali: e.target.checked })}
                />
                Bu kuralı kapat (çizelgeye girmez)
              </label>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" className="oc-tap" onClick={() => setBakimDuzen(null)}>
              Vazgeç
            </Button>
            <Button
              className="oc-tap"
              disabled={bekliyor || !bakimDuzen?.id.trim()}
              onClick={() => {
                if (!bakimDuzen) return;
                calistir(async () => {
                  const sonuc = await saveManualMaintenanceRule({
                    ruleId: bakimDuzen.id,
                    matchPattern: bakimDuzen.match,
                    part: bakimDuzen.part,
                    task: bakimDuzen.task,
                    person: bakimDuzen.person as "F" | "E" | "MA" | "I",
                    freq: bakimDuzen.freq as "d",
                    state: bakimDuzen.state as "R",
                    basis: bakimDuzen.basis,
                    minGroup: bakimDuzen.minGroup,
                    disabled: bakimDuzen.kapali,
                    sort: bakimDuzen.sort,
                  });
                  if (sonuc.ok) setBakimDuzen(null);
                  return sonuc;
                }, "Kural kaydedildi.");
              }}
            >
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ———————————————————————————————————————— yağlama düzenleyici */}
      <Dialog open={yaglamaDuzen !== null} onOpenChange={(a) => !a && setYaglamaDuzen(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {yaglamaDuzen?.kodda ? "Kod noktasını değiştir" : "Yağlama noktası"}
            </DialogTitle>
          </DialogHeader>
          {yaglamaDuzen ? (
            <div className="flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="yg-id">Kimlik</Label>
                  <Input
                    id="yg-id"
                    value={yaglamaDuzen.id}
                    disabled={yaglamaDuzen.kodda}
                    onChange={(e) => setYaglamaDuzen({ ...yaglamaDuzen, id: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="yg-place">Yağlanacak yer</Label>
                  <Input
                    id="yg-place"
                    value={yaglamaDuzen.place}
                    onChange={(e) => setYaglamaDuzen({ ...yaglamaDuzen, place: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="yg-klass">Yağ sınıfı</Label>
                <Input
                  id="yg-klass"
                  value={yaglamaDuzen.klass}
                  onChange={(e) => setYaglamaDuzen({ ...yaglamaDuzen, klass: e.target.value })}
                />
                <span className="text-xs text-muted-foreground">
                  Sınıf yazılır, ÜRÜN ADI değil: «Dişli yağı ISO VG 220», «Gres NLGI 2».
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="yg-match">Ekipman deseni</Label>
                  <Input
                    id="yg-match"
                    value={yaglamaDuzen.match}
                    onChange={(e) => setYaglamaDuzen({ ...yaglamaDuzen, match: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="yg-basis">Dayanak</Label>
                  <Input
                    id="yg-basis"
                    value={yaglamaDuzen.basis}
                    onChange={(e) => setYaglamaDuzen({ ...yaglamaDuzen, basis: e.target.value })}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={yaglamaDuzen.kapali}
                  onChange={(e) => setYaglamaDuzen({ ...yaglamaDuzen, kapali: e.target.checked })}
                />
                Bu noktayı kapat (tabloya girmez)
              </label>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" className="oc-tap" onClick={() => setYaglamaDuzen(null)}>
              Vazgeç
            </Button>
            <Button
              className="oc-tap"
              disabled={bekliyor || !yaglamaDuzen?.id.trim()}
              onClick={() => {
                if (!yaglamaDuzen) return;
                calistir(async () => {
                  const sonuc = await saveManualLubricationPoint({
                    pointId: yaglamaDuzen.id,
                    matchPattern: yaglamaDuzen.match,
                    place: yaglamaDuzen.place,
                    klass: yaglamaDuzen.klass,
                    basis: yaglamaDuzen.basis,
                    disabled: yaglamaDuzen.kapali,
                    sort: yaglamaDuzen.sort,
                  });
                  if (sonuc.ok) setYaglamaDuzen(null);
                  return sonuc;
                }, "Nokta kaydedildi.");
              }}
            >
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
