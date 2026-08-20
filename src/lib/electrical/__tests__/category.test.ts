import { describe, expect, it } from "vitest";
import {
  ELECTRICAL_CATEGORIES,
  electricalCategory,
  type ElectricalCategory,
} from "../category";

function urun(designation: string, typeNo = "", partNo = "", supplier = ""): ElectricalCategory {
  return electricalCategory({ designation, typeNo, partNo, supplier });
}

describe("electricalCategory", () => {
  it.each<[string, string, ElectricalCategory]>([
    ["ACS880 inverter module", "ACS880-104", "Sürücüler ve Güç Elektroniği"],
    ["Asynchronous motor", "K21R", "Motorlar"],
    ["Electromagnetic brake", "ED 201/6", "Fren Sistemleri"],
    ["SIMATIC ET 200SP digital output", "6ES7132", "PLC ve Uzak I/O"],
    ["SIMATIC HMI KTP900 Basic", "6AV2123", "HMI ve Operatör Panelleri"],
    ["PROFINET fieldbus adapter module", "FPNO-21", "Endüstriyel Haberleşme"],
    ["4MP Varifocal Bullet Network Camera", "DS-2CD1643G0", "Kamera ve Görüntüleme"],
    ["SITOP power supply 24VDC", "6EP1334", "Güç Kaynakları ve Trafolar"],
    ["Molded case circuit breaker", "3VA1463", "Şalterler ve Devre Kesiciler"],
    ["HRC fuse link 25A", "OFAA000GG25", "Sigortalar ve Sigorta Yuvaları"],
    ["Contactor AC-3 3kW", "3RT2015", "Kontaktörler"],
    ["Motor protection circuit breaker", "3RV2021", "Motor Koruma ve Termik Röleler"],
    ["Safety relay", "3SK1111", "Kumanda ve Güvenlik Röleleri"],
    ["E690 Advanced Temperature Scanner", "E690-1", "Ölçüm ve Enstrümantasyon"],
    ["Inductive sensor", "XS1M18", "Sensörler"],
    ["Encoder interface module", "FEN-31", "Enkoder ve Geri Besleme"],
    ["Limit switch", "XCKMR54", "Limit Şalterleri"],
    ["Emergency stop pushbutton", "XB5AS", "Kumanda Elemanları"],
    ["Stack light with horn", "XVU", "Sinyal ve İkaz Elemanları"],
    ["Panel light with sensor", "51041", "Aydınlatma"],
    ["Filter fan", "QFF 2000", "Pano İklimlendirme"],
    ["Plastic enclosure", "BB1-0731", "Pano, Muhafaza ve Etiketleme"],
    ["Industrial socket", "BK1-3404", "Fiş, Priz, Klemens ve Bağlantı"],
    ["Montaj aksesuarı", "ABC-1", "Diğer"],
  ])("%s ürününü %s ile sınıflandırır", (designation, typeNo, beklenen) => {
    expect(urun(designation, typeNo)).toBe(beklenen);
  });

  it("her tanımlı kategoriyi en az bir temsilciyle kapsar", () => {
    const temsilciler = [
      urun("ACS880 inverter module"),
      urun("Asynchronous motor"),
      urun("Electromagnetic brake"),
      urun("SIMATIC ET 200SP digital output"),
      urun("SIMATIC HMI KTP900 Basic"),
      urun("PROFINET fieldbus adapter module"),
      urun("4MP Varifocal Bullet Network Camera"),
      urun("SITOP power supply 24VDC"),
      urun("Molded case circuit breaker"),
      urun("HRC fuse link 25A"),
      urun("Contactor AC-3 3kW"),
      urun("Motor protection circuit breaker"),
      urun("Safety relay"),
      urun("E690 Advanced Temperature Scanner"),
      urun("Inductive sensor"),
      urun("Encoder interface module"),
      urun("Limit switch"),
      urun("Emergency stop pushbutton"),
      urun("Stack light with horn"),
      urun("Panel light with sensor"),
      urun("Filter fan"),
      urun("Plastic enclosure"),
      urun("Industrial socket"),
      urun("Montaj aksesuarı"),
    ];
    expect(new Set(temsilciler)).toEqual(new Set(ELECTRICAL_CATEGORIES));
  });

  it("özgül işlevi genel sözcükten önce değerlendirir", () => {
    expect(urun("EG KL 220V AC panel light with sensor")).toBe("Aydınlatma");
    expect(urun("Motor PTC temperature sensor")).toBe("Motorlar");
    expect(urun("Motor protection circuit breaker", "3RV2011")).toBe(
      "Motor Koruma ve Termik Röleler"
    );
  });

  it("üretici ailesi ve İngilizce yazım varyantlarını tanır", () => {
    expect(urun("SINAMICS S120 CONTROL UNIT CU320-2 PN", "6SL3040-1MA01-0AA0")).toBe(
      "Sürücüler ve Güç Elektroniği"
    );
    expect(urun("Inductive proximity switch, flush, PNP NO", "1635100")).toBe("Sensörler");
    expect(urun("Humidifiers-switch 1 pole ON/OFF-complete product")).toBe(
      "Pano İklimlendirme"
    );
  });

  it.each<[string, string, ElectricalCategory]>([
    ["SIRCO Extended rotary handle", "14443111", "Şalterler ve Devre Kesiciler"],
    ["AUX. SWITCH BLOCK 1NO+1NC", "3RH2911-1LA11", "Kontaktörler"],
    ["INNOMOTICS SD Motor 315kW", "1LE5504-3AB79", "Motorlar"],
    ["SINAMICS BEDIENFELD AOP30", "6SL3055", "HMI ve Operatör Panelleri"],
    ["SINAMICS S120 SENSOR MODULE CABINET SMC30", "6SL3055", "Enkoder ve Geri Besleme"],
    ["PT100 Prob", "E-RT21", "Ölçüm ve Enstrümantasyon"],
    ["LPW1 Crane overload indicator", "LPW1-65MM", "Ölçüm ve Enstrümantasyon"],
    ["Emergency Brake", "HKA-A-180/11W", "Fren Sistemleri"],
    ["Harmony Stil 4 - Metal series XB4 - Green", "XB4BA31", "Kumanda Elemanları"],
    ["60W LED Safety Spot--Line light- RED", "SNT-BL186-1", "Aydınlatma"],
    ["Single foot switch", "XPEA110", "Kumanda Elemanları"],
    ["Intercommunication system", "BST01", "Endüstriyel Haberleşme"],
    ["4-ch Mini 1U 4 PoE NVR", "DS-7104NI", "Kamera ve Görüntüleme"],
    ["Covering hood HC-RBO 16", "HC-RBO 16", "Fiş, Priz, Klemens ve Bağlantı"],
  ])("0019 ailesini sınıflandırır: %s", (designation, typeNo, beklenen) => {
    expect(urun(designation, typeNo)).toBe(beklenen);
  });
});
