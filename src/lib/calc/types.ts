// Hesap motoru çekirdek tipleri.
// Excel'den miras 4 değer rolü: input (kullanıcı) -> computed (formül)
// -> selection (katalogdan seçim) -> check (kontrol ü/û).

export type MechanismClass = "M1" | "M2" | "M3" | "M4" | "M5" | "M6" | "M7" | "M8";
export type UsageClass = "T0" | "T1" | "T2" | "T3" | "T4" | "T5" | "T6" | "T7" | "T8" | "T9";
export type StructureClass = "A1" | "A2" | "A3" | "A4" | "A5" | "A6" | "A7" | "A8";
export type LoadGroup = "B1" | "B2" | "B3" | "B4" | "B5" | "B6";
export type HoistClass = "H1" | "H2" | "H3" | "H4";
export type DrumMaterial = "S235" | "S355";
export type ShaftMaterial = "C25" | "C30" | "C35" | "4140+QT" | "4140";

/** Tek bir kontrol satırı: gereken ile sağlananın karşılaştırması. */
export interface Check {
  id: string;
  label: string;
  /** İstenen (talep) değer */
  required: number;
  /** Sağlanan (kapasite) değer */
  provided: number;
  unit: string;
  /** provided `op` required şeklinde okunur */
  op: ">=" | "<=";
  pass: boolean;
  /** İlgili standart (ör. FEM 1.001 T.2.1.3.2) */
  standard?: string;
  /** Excel'de karşılığı olmayan, uygulamanın eklediği kontrol */
  nonExcel?: boolean;
}

/** Aralık tipli kontrol (ör. redüktör oran sapması −10%..+5%) */
export interface RangeCheck extends Omit<Check, "op" | "required"> {
  op: "range";
  min: number;
  max: number;
}

export type AnyCheck = Check | RangeCheck;

/**
 * Modül sonucu: isimli değerler + kontroller + Excel hücre haritası.
 * `cells` golden testlerin Excel V5 dökümüyle birebir karşılaştırdığı katmandır.
 */
export interface ModuleResult<TValues> {
  values: TValues;
  checks: AnyCheck[];
  /** Excel hücre adresi -> hesaplanan değer (ör. "L19" -> 3750) */
  cells: Record<string, number | string>;
}

/** 01-TEKNİK ÖZELLİKLER sayfası girdileri (P4:P27) */
export interface TechnicalSpecs {
  mainCapacityT: number;        // P4 [ton]
  mainLiftHeightM: number;      // P5 [m]
  mainLiftSpeedMpm: number;     // P6 [m/dak]
  auxCapacityT: number;         // P7 [ton]
  auxLiftHeightM: number;       // P8 [m]
  auxLiftSpeedMpm: number;      // P9 [m/dak]
  structureClass: StructureClass;   // P10
  hoistLoadClass: string;       // P11 (ör. "H3/B4")
  hoistMechanismClass: MechanismClass; // P12 (= AnakaldırmaM)
  hoistUsageClass: UsageClass;  // P13
  bridgeSpeedMpm: number;       // P14
  bridgeMechanismClass: MechanismClass; // P15
  bridgeUsageClass: UsageClass; // P16
  trolleySpeedMpm: number;      // P17
  trolleyMechanismClass: MechanismClass; // P18
  trolleyUsageClass: UsageClass; // P19
  hookType: string;             // P20 (ör. "Kepçe")
  controlType: string;          // P21
  ambientTempMinC: number;      // R22
  ambientTempMaxC: number;      // T22
  supplyVoltage: string;        // P23
  controlVoltage: string;       // P24
  spanM: number;                // P27
}
