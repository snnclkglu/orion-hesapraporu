import { hoistEquipmentArrangement } from "@/lib/calc/types";
import { isHoistKey } from "@/lib/calc/presentation/module-family";
import { DOUBLE_GIRDER_CRANE_TYPE, SINGLE_GIRDER_CRANE_TYPE, GROUND_CRANE_TYPE, gantryLegCount } from "@/lib/crane-types";
import type { SelectionIssue, SelectionRequest } from "./types";
import { requestedHookStandard } from "./technical-contract";
import { requestedBrakeFamily } from "./brands";

/** Kapsam seçilebilir UI seçeneklerinden türetilmez; her eksik mühendislik modeli görünürdür. */
export function selectionScopeIssues(request: SelectionRequest): SelectionIssue[] {
  const issues: SelectionIssue[] = [];
  if (gantryLegCount(request.craneType)) issues.push({ code: "scope.gantry", state: "unsupported", message: "Portal ayakları, ayak-köprü birleşimi, temel/ankraj ve genel stabilite için FEM 1.001 Kitapçık 2/6 yük durumlarını kapsayan bağımsız yapı hesabı gerekli. Köprü ekipmanı ön seçimi bu hesabı tamamlamaz." });
  else if (request.craneType && ![DOUBLE_GIRDER_CRANE_TYPE, SINGLE_GIRDER_CRANE_TYPE, GROUND_CRANE_TYPE, "Vinç Arabası"].includes(request.craneType)) issues.push({ code: "scope.craneType", state: "unsupported", message: `${request.craneType}: özel yapı, yük durumları ve hizmet koşulları için bu tipin bağımsız mühendislik doğrulaması gerekli.` });
  if (request.specs.hookType && !requestedHookStandard(request.specs.hookType)) issues.push({ code: "scope.attachment", state: "unsupported", message: `${request.specs.hookType}: aparatın gerçek ölü ağırlığı, yük dağılımı ve özel çalışma çevrimi ayrı doğrulanmalı. Yerine standart dövme kanca seçilmez.` });
  if (request.specs.installationEnvironment === "outdoor") issues.push({ code: "scope.wind", state: "unsupported", message: "Açık saha için işletme içi/dışı rüzgâr, yükün rüzgâr alanı, park ankrajları, kayma ve devrilme doğrulaması gerekli (FEM 1.001 §2.2.4.1 / Kitapçık 6). Saha rüzgâr verisi yerine şablon basınç atanmaz." });
  if (request.active.includes("girder2")) issues.push({ code: "scope.girder2", module: "girder2", state: "unsupported", message: "İkinci kiriş takımının burkulması mevcut raporda bağımsız hesaplanmıyor; dört kirişli tam yapı doğrulaması gerekli." });
  for (const key of request.active.filter(isHoistKey)) {
    const arrangement = hoistEquipmentArrangement(request.specs, key);
    if (arrangement !== "standard") issues.push({ code: `scope.topology.${key}`, module: key, state: "missing", message: `${arrangement === "twin" ? "İkiz" : "Çift tamburlu"} donanımın fiziksel adetleri korundu. Eşit olmayan yük paylaşımı, senkron çalışma ve tek tahrik/fren kaybı senaryoları ayrı hesapla doğrulanmalı.` });
  }
  if (request.active.filter(isHoistKey).length > 1) issues.push({ code: "scope.combinedHoists", state: "missing", message: "Birden çok kaldırmada birlikte/bağımsız çalışma izinleri, yük konumları ve en elverişsiz toplam teker yükü işletme senaryosuyla doğrulanmalı. Yalnız ayrı mekanizma seçimi bu koşulu kapatmaz." });
  if (request.active.some(isHoistKey) && requestedBrakeFamily(String(request.specs.hoistBrakeType)) === "disc") issues.push({ code: "scope.discServiceBrake", state: "unsupported", message: "Disk servis freni için diske uygun montaj, etkin yarıçap, balata basıncı ve ısıl enerji koşulları ayrı doğrulanmalı. Kasnaklı fren bu talebin yerine otomatik seçilmez." });
  if (request.active.includes("girder") && !request.active.includes("buckling")) issues.push({ code: "scope.buckling", module: "girder", state: "missing", message: "Ana kiriş etkin, burkulma bölümü kapalı. Yapısal hesabı tamamlamak için burkulma kontrolü gerekli." });
  return issues;
}
