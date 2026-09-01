// FİRMA AĞIRLIK TABLOLARI — TEK DİKİŞ YERİ.
//
// Bu dosya bir tablo TANIMLAMAZ; `lib/offers/cost/params.ts`teki firma imalat
// geçmişinden gelen ağırlık tablolarını yeniden dışa verir. Sebep tek cümledir:
// **aynı kilo iki yerde durmamalı** (değişmez md. 8). Teker grubu ağırlığı bir
// yerde 850, ötekinde 900 kg olsaydı fark ancak bir vinç ağır çıktığında
// görülürdü.
//
// TABLOLAR NEDEN TAŞINMADI: `params.ts`in başındaki "Excel istisnası değil
// KAPSAM DIŞI" gerekçesi yirmi satırlık tek bir metindir ve ikiye bölünürdü;
// ayrıca `model.test.ts`in ASTOR çapasını (51.000 kg · 231.166,71 €) tutan
// kararlı bir çekirdek bu iş için oynatılmış olurdu. Değeri yok, riski var.
//
// SINIR: buradan YALNIZ DEFTER geçer, MODEL geçmez. `lib/weights` hiçbir
// dosyası `@/lib/offers/cost/model` içe aktarmaz — MALIYET-3 adıyla model.ts'i
// işaret eder ve oradan çıkan bir SAYININ hesap raporuna girmesini yasaklar.
// Paylaşılan şey firmanın kendi ağırlık defteridir, o modelin sonucu değil.
// Koruma: `__tests__/dokum.guard.test.ts`.

export {
  CLASS_WEIGHT,
  COST_PARAM_DEFAULTS,
  FRAME_TABLE,
  interpolate,
  paramOf,
  type CraneClass,
} from "@/lib/offers/cost/params";
