// CMAA 70 servis faktörü Ks ve ivmelenme tork faktörü Kt — TABLO DOĞRULAMA.
//
// Değerler CMAA Specification #70 PDF'inden okunmuştur:
//   · Tablo 5.2.9.1.2.1-E (Ks) — PDF s. 60, basılı s. 59
//   · Tablo 5.2.9.1.2.1-C (Kt) — PDF s. 59, basılı s. 58
// Bu dosya tablonun BASILI HÂLİNİ sabitler: bir değer kazayla değişirse test
// kırılır. Ayrıca faktörlerin motor gücüne beklenen yönde etki ettiğini ve
// otomatik seçimin tablodan okuduğunu doğrular.

import { describe, expect, it } from "vitest";
import {
  CMAA_ACCEL_TORQUE_KT,
  CMAA_APPLICATION_CLASSES,
  CMAA_DRIVE_CONTROLS,
  CMAA_MOTOR_CONTROLS,
  CMAA_SERVICE_FACTOR_KS,
  cmaaAccelTorqueKt,
  cmaaServiceFactorKs,
  deriveTravelInputs,
  travelApplicationClass,
} from "../derive";
import { V5_SPECS } from "../defaults";
import {
  V5_BRIDGE_INPUTS,
  V5_BRIDGE_SELECTIONS,
  V5_TRAVEL_DEPS,
} from "../defaults/travel";
import { computeTravelGroup, SHORT_TON_PER_TONNE } from "../modules/travelGroup";
import { resolveStandardRef } from "@/lib/standards/registry";

// -------------------------------------------------- Tablo 5.2.9.1.2.1-E (Ks)

/** Katalogda basılı satırlar — sütun sırası CMAA_DRIVE_CONTROLS ile aynıdır. */
const KS_BASILI: Record<string, (number | "N/A")[]> = {
  A: [0.75, 1.0, 1.0, 1.2],
  B: [0.75, 1.0, 1.0, 1.2],
  C: [0.75, 1.0, 1.0, 1.2],
  D: [0.85, 1.15, 1.1, 1.3],
  E: [1.0, "N/A", 1.2, 1.4],
  F: [1.4, "N/A", 1.4, 1.6],
};

describe("CMAA 70 Tablo 5.2.9.1.2.1-E — servis faktörü Ks", () => {
  it("tablo katalogda basılı hâliyle birebir aynıdır", () => {
    for (const cls of CMAA_APPLICATION_CLASSES) {
      CMAA_DRIVE_CONTROLS.forEach((col, i) => {
        const beklenen = KS_BASILI[cls][i];
        const gelen = CMAA_SERVICE_FACTOR_KS[cls][col];
        expect(gelen === null ? "N/A" : gelen, `${cls} / ${col}`).toBe(beklenen);
      });
    }
  });

  it("Ks sınıfla birlikte MONOTON artar (aynı sütunda)", () => {
    for (const col of CMAA_DRIVE_CONTROLS) {
      const seri = CMAA_APPLICATION_CLASSES.map((c) => CMAA_SERVICE_FACTOR_KS[c][col]).filter(
        (v): v is number => v !== null
      );
      for (let i = 1; i < seri.length; i++) {
        expect(seri[i], `${col} sütunu ${i}. satır`).toBeGreaterThanOrEqual(seri[i - 1]);
      }
    }
  });

  it("\"N/A\" hücrede UYDURMA değer dönmez", () => {
    // E ve F sınıfı, 30 dakikalık DC sütunu
    expect(cmaaServiceFactorKs("E", "dcSabit30")).toBeUndefined();
    expect(cmaaServiceFactorKs("F", "dcSabit30")).toBeUndefined();
    // Tanınmayan sınıf / sütun da değer üretmez
    expect(cmaaServiceFactorKs("Z", "acManyetik")).toBeUndefined();
    expect(cmaaServiceFactorKs("E", "bilinmiyor")).toBeUndefined();
  });

  it("FEM M6 → CMAA D → AC manyetik kumandada Ks = 1,1", () => {
    expect(travelApplicationClass("M6")).toBe("D");
    expect(cmaaServiceFactorKs("D", "acManyetik")).toBe(1.1);
  });
});

// -------------------------------------------------- Tablo 5.2.9.1.2.1-C (Kt)

describe("CMAA 70 Tablo 5.2.9.1.2.1-C — ivmelenme tork faktörü Kt", () => {
  it("tablo katalogda basılı hâliyle birebir aynıdır", () => {
    expect(CMAA_ACCEL_TORQUE_KT.acBilezikliKontaktor).toEqual({ min: 1.3, max: 1.5 });
    expect(CMAA_ACCEL_TORQUE_KT.acBilezikliStatik).toEqual({ min: 1.3, max: 1.5 });
    expect(CMAA_ACCEL_TORQUE_KT.acBilezikliMillKontaktor).toEqual({ min: 1.5, max: 1.7 });
    expect(CMAA_ACCEL_TORQUE_KT.acSincapKafesBalast).toEqual({ min: 1.3, max: 1.3 });
    expect(CMAA_ACCEL_TORQUE_KT.dcSontAyarliGerilim).toEqual({ min: 1.5, max: 1.5 });
    expect(CMAA_ACCEL_TORQUE_KT.dcSeriKontaktor).toEqual({ min: 1.35, max: 1.35 });
  });

  it("aralıklı satırlarda ALT uç seçilir (katalog dipnotu 2)", () => {
    for (const k of CMAA_MOTOR_CONTROLS) {
      expect(cmaaAccelTorqueKt(k)).toBe(CMAA_ACCEL_TORQUE_KT[k].min);
    }
  });

  it("Kt SERVİS SINIFINA bağlı değildir — tablo yalnız motor/kumanda ile indislenir", () => {
    // Sınıf argümanı YOKTUR; bu testin varlığı o gerçeği belgeler.
    expect(cmaaAccelTorqueKt("acBilezikliMillKontaktor")).toBe(1.5);
    expect(cmaaAccelTorqueKt("bilinmeyen")).toBeUndefined();
  });
});

// ----------------------------------------------------- otomatik seçim + etki

describe("otomatik seçim ve motor gücüne etkisi", () => {
  const CTX = { ambientTempMaxC: 40, mechanismClass: "M6" as const };

  it("Ks otomatiği mekanizma sınıfından türeyen uygulama sınıfını kullanır", () => {
    const d = deriveTravelInputs(
      {
        ...V5_BRIDGE_INPUTS,
        travelApplicationClassAuto: true,
        serviceFactorKsAuto: true,
        driveControl: "acManyetik",
      },
      CTX
    );
    expect(d.applicationClass).toBe("D");
    expect(d.serviceFactorKs).toBe(1.1);
    expect(d.warnings).toEqual([]);
  });

  it("uygulama sınıfı ELLE seçiliyse Ks o sınıftan okunur", () => {
    const d = deriveTravelInputs(
      {
        ...V5_BRIDGE_INPUTS,
        travelApplicationClassAuto: false,
        applicationClass: "C",
        serviceFactorKsAuto: true,
        driveControl: "acStatik",
      },
      CTX
    );
    expect(d.applicationClass).toBeUndefined(); // otomatik kapalı → yazılmaz
    expect(d.serviceFactorKs).toBe(1.2);        // C × AC statik
  });

  it("N/A hücrede değer yerine GEREKÇELİ uyarı üretilir", () => {
    const d = deriveTravelInputs(
      {
        ...V5_BRIDGE_INPUTS,
        travelApplicationClassAuto: true,
        serviceFactorKsAuto: true,
        driveControl: "dcSabit30",
      },
      { ...CTX, mechanismClass: "M7" }
    );
    expect(d.serviceFactorKs).toBeUndefined();
    expect(d.warnings.map((w) => w.field)).toContain("serviceFactorKs");
  });

  it("anahtarlar kapalıyken hiçbir katsayı türetilmez", () => {
    const d = deriveTravelInputs(
      { ...V5_BRIDGE_INPUTS, serviceFactorKsAuto: false, accelTorqueFactorKtAuto: false },
      CTX
    );
    expect(d.serviceFactorKs).toBeUndefined();
    expect(d.accelTorqueFactorKt).toBeUndefined();
  });

  it("Ks gerekli gücü DOĞRU ORANTILI ölçekler", () => {
    const run = (ks: number) =>
      computeTravelGroup(
        V5_SPECS, "bridge", { ...V5_BRIDGE_INPUTS, serviceFactorKs: ks },
        V5_BRIDGE_SELECTIONS, V5_TRAVEL_DEPS
      ).values.requiredPowerKw;
    expect(run(1.2) / run(1.0)).toBeCloseTo(1.2, 9);
  });

  it("CMAA ağırlığı W metrik ton DEĞİL, kısa tondur (kg → ton → US ton)", () => {
    const values = computeTravelGroup(
      V5_SPECS,
      "bridge",
      V5_BRIDGE_INPUTS,
      V5_BRIDGE_SELECTIONS,
      V5_TRAVEL_DEPS
    ).values;
    expect(values.designWeightShortTons).toBeCloseTo(
      (values.totalWeightKg / 1000) * SHORT_TON_PER_TONNE,
      12
    );
    // Yuvarlanmış firma katsayısı, tam çevrimden (1000/907,18474) %0,25'ten
    // fazla sapmaz — bağıntının imperial "ton"u gerçekten kısa tondur.
    expect(SHORT_TON_PER_TONNE).toBeCloseTo(1000 / 907.18474, 1);
  });

  it("gerekli güç, ağırlığın kısa tona çevrilmesiyle DOĞRU ORANTILI büyür", () => {
    const values = computeTravelGroup(
      V5_SPECS, "bridge", V5_BRIDGE_INPUTS, V5_BRIDGE_SELECTIONS, V5_TRAVEL_DEPS
    ).values;
    const metricTonPower =
      (values.totalWeightKg / 1000) *
      (values.actualSpeedMpm * 3.28) *
      values.accelFactorKa *
      V5_BRIDGE_INPUTS.serviceFactorKs *
      0.745;
    expect(values.requiredPowerKw / metricTonPower).toBeCloseTo(SHORT_TON_PER_TONNE, 9);
  });

  it("Kt gerekli gücü TERS orantılı ölçekler (Ka ~ 1/Kt)", () => {
    const run = (kt: number) =>
      computeTravelGroup(
        V5_SPECS, "bridge", { ...V5_BRIDGE_INPUTS, accelTorqueFactorKt: kt },
        V5_BRIDGE_SELECTIONS, V5_TRAVEL_DEPS
      ).values.requiredPowerKw;
    expect(run(1.5) / run(1.7)).toBeCloseTo(1.7 / 1.5, 9);
  });

  it("iki tablo da standart defterinde GERÇEK kayıt olarak vardır", () => {
    for (const code of ["CMAA 70 T.5.2.9.1.2.1-E", "CMAA 70 T.5.2.9.1.2.1-C"]) {
      const ref = resolveStandardRef(code);
      expect(ref, `${code} defterde yok`).toBeDefined();
      expect(ref!.tables?.length ?? 0).toBeGreaterThan(0);
      expect(ref!.tables![0].rows.length).toBeGreaterThan(0);
    }
  });

  it("tampon ve yavaşlama referansları da defterdedir (rozet ölü değil)", () => {
    for (const code of ["FEM 1.001 2.2.3.4.1", "FEM 1.001 9.4.2", "FEM 1.001 7.7.1.2"]) {
      expect(resolveStandardRef(code), `${code} defterde yok`).toBeDefined();
    }
  });
});
