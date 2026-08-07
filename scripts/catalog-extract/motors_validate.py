# -*- coding: utf-8 -*-
"""Motor kataloğu doğrulaması — catalog_data/motors/*.json.

Motor satırları PDF kataloglardan çıkarılır; bu betik üretilen tabloyu FİZİĞE
ve IEC 60072-1 gövde ölçülerine karşı sınar. Amaç, yanlış sütundan okunmuş ya
da bantlara yanlış düşmüş bir sayının (moment, devir, mil çapı) motor seçim
kontrolünü sessizce "uygun" yapmasını önlemektir.

Çalıştırma:
    python motors_validate.py [dosya.json ...]
Varsayılan: catalog_data/motors/ altındaki tüm .json dosyaları.

Çıkış kodu 0 = HATA yok, 1 = en az bir HATA (UYARI çıkış kodunu etkilemez).
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

# Windows konsolu cp1254'tür ve Türkçe olmayan işaretlerde (ör. "→", "±")
# çöker. Rapor ortasında çökmek en tehlikeli davranıştır: kullanıcı kısmi hata
# listesini görüp gerisini "geçti" sanır. Çıktıyı UTF-8'e sabitle.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):  # yönlendirilmiş/eski akış
        pass

REPO_ROOT = Path(__file__).resolve().parents[2]
WORKSPACE_ROOT = REPO_ROOT.parent
MOTORS_DIR = WORKSPACE_ROOT / "catalog_data" / "motors"

REQUIRED = [
    "power_kw", "poles", "speed_rpm", "torque_nm", "frame_size",
    "efficiency_pct", "weight_kg", "shaft_diameter_mm",
]

# T = 9550 · P / n  (P kW, n d/dak, T Nm) — katalog yuvarlaması için %5 tolerans.
TORQUE_TOL = 0.05

# Anma devri iki kademede sınanır.
#
# SERT sınır (HATA) fizikten gelir: asenkron makine senkron devrin ALTINDA
# döner (kayma > 0) ve anma noktasında kayma %15'i aşmaz. Bu sınırın dışına
# çıkan bir sayı yanlış sütundan okunmuştur.
SYNC_RPM = {2: 3000, 4: 1500, 6: 1000, 8: 750}
MAX_SLIP = 0.15
#
# YUMUŞAK bant (UYARI) katalog beklentisidir, fizik sınırı değil: küçük
# motorlarda (≲0,75 kW) kayma çok daha büyüktür ve bandın ALTINA düşmek
# normaldir; büyük motorlarda kayma sıfıra yaklaşır ve bandın ÜSTÜNE çıkmak
# normaldir (315 gövde 2 kutup 2982 d/dak). Bu yüzden ihlal HATA sayılmaz.
SPEED_BAND = {2: (2800, 2960), 4: (1400, 1480), 6: (900, 980), 8: (690, 740)}
SMALL_MOTOR_KW = 0.75

# Verim alt sınırı güce bağlıdır: 0,75 kW altındaki motorlarda IEC 60034-30-1
# bile %50'nin altında verim öngörür (ABB 0,09 kW 8 kutup %49,4 · SIMOTICS
# 0,09 kW 8 kutup %44,1 — ikisi de BASILI değerdir). Tek bir %50 tabanı bu
# satırları yanlışlıkla hata gösterir.
EFFICIENCY_MAX = 98.0
EFFICIENCY_MIN_SMALL = 35.0      # P < 0,75 kW
EFFICIENCY_MIN = 50.0            # P ≥ 0,75 kW

# Basılı katalogun KENDİ tutarsızlıkları. Kontrol çalışmaya devam eder, ama
# gerekçesi kayıtlı olan sapma UYARI'ya düşer — sessizce kaybolmaz.
# Anahtar: (dosya adı, model, kontrol adı) → gerekçe.
BILINEN_KATALOG_SAPMALARI = {
    ("abb.json", "M3BP 80MLC", "moment"):
        "Katalog s.44'te bu satırın momenti 4 Nm basılmıştır; 9550·P/n = 3,6 Nm. "
        "Komşu satırlar (0,37 kW → 2,46 Nm · 0,75 kW → 4,9 Nm) bağıntıya uyduğundan "
        "sapma basılı sayfanın kendi yuvarlama hatasıdır. Katalog değeri "
        "DEĞİŞTİRİLMEMİŞTİR — uydurma sayı yazmaktansa üreticinin beyanı korunur.",
}

# IEC 60072-1 silindirik mil ucu çapı D (mm), yapı büyüklüğüne göre (4-8 kutup
# kademesi). Katalog üreticisi bu kademeden sapabilir (GAMAK 315'te 85 mm
# basar); sapma HATA değil UYARI olarak bildirilir — kaynak katalogtur, tablo
# değil.
#
# 56/63/71 ve 400/450 kademeleri ÜÇ KATALOĞUN DE basılı boyut tablolarıyla
# çapraz doğrulanmıştır (GAMAK s.31-32 · ABB s.86/88 · SIMOTICS s.306-308):
# 56→9 · 63→11 · 71→14 üçünde de aynıdır.
IEC_SHAFT_MM = {
    56: 9, 63: 11, 71: 14, 80: 19, 90: 24, 100: 28, 112: 28, 132: 38,
    160: 42, 180: 48, 200: 55, 225: 60, 250: 65, 280: 75, 315: 80,
    355: 100, 400: 110, 450: 120,
}
# 2 kutuplu makine 225 ve üstü gövdelerde daha ince mille çıkar; bu kademelerde
# tablo değeri ÜST sınırdır ve daha ince mil beklenen davranıştır.
SMALL_SHAFT_OK_FROM = 225


class Report:
    def __init__(self, name: str):
        self.name = name
        self.errors: list[str] = []
        self.warnings: list[str] = []
        self.checks = 0

    def error(self, msg: str) -> None:
        self.errors.append(msg)

    def warn(self, msg: str) -> None:
        self.warnings.append(msg)

    def record(self, file_name: str, model, check: str, msg: str) -> None:
        """Gerekçesi kayıtlı sapmayı UYARI, kayıtsızı HATA yapar."""
        reason = BILINEN_KATALOG_SAPMALARI.get((file_name, model, check))
        if reason:
            self.warnings.append(f"{msg}\n         SAPMA (kayıtlı): {reason}")
        else:
            self.errors.append(msg)


def label(item: dict) -> str:
    return (f"{item.get('power_kw')} kW · {item.get('poles')} kutup · "
            f"{item.get('frame_size')} ({item.get('model') or '-'})")


def frame_number(frame_size) -> int | None:
    digits = ""
    for ch in str(frame_size or ""):
        if ch.isdigit():
            digits += ch
        else:
            break
    return int(digits) if digits else None


def check_file(path: Path) -> Report:
    rep = Report(path.name)
    data = json.loads(path.read_text(encoding="utf-8"))
    items = data.get("items", [])
    meta = data.get("meta", {})

    if not items:
        rep.error("items boş")
        return rep
    if "PDF extraction pending" in str(meta.get("page_range", "")):
        rep.error("meta.page_range hâlâ yer tutucu — sayıların kaynağı belirsiz")

    seen: dict[tuple, str] = {}

    for item in items:
        name = label(item)

        # 1. Zorunlu alanlar
        eksik = [k for k in REQUIRED if item.get(k) is None]
        rep.checks += 1
        if eksik:
            rep.error(f"{name}: eksik zorunlu alan {eksik}")
            continue

        power = float(item["power_kw"])
        poles = int(item["poles"])
        speed = float(item["speed_rpm"])
        torque = float(item["torque_nm"])
        eff = float(item["efficiency_pct"])
        shaft = float(item["shaft_diameter_mm"])

        # 2. Moment ↔ güç/devir
        rep.checks += 1
        expected = 9550.0 * power / speed
        if expected > 0 and abs(torque - expected) / expected > TORQUE_TOL:
            msg = (f"{name}: moment {torque} Nm, 9550·P/n = {expected:.1f} Nm "
                   f"(sapma %{abs(torque - expected) / expected * 100:.1f})")
            rep.record(path.name, item.get("model"), "moment", msg)

        # 3a. Devir — fizik sınırı (kayma > 0 ve ≤ %15)
        rep.checks += 1
        sync = SYNC_RPM.get(poles)
        if sync is None:
            rep.warn(f"{name}: {poles} kutup için senkron devir tanımlı değil — "
                     f"devir kontrolü ATLANDI")
        elif not (sync * (1 - MAX_SLIP) <= speed < sync):
            rep.error(f"{name}: devir {speed:.0f} d/dak — senkron devir {sync}, "
                      f"kayma %{(sync - speed) / sync * 100:.1f} "
                      f"(0 < kayma ≤ %{MAX_SLIP * 100:.0f} olmalı)")

        # 3b. Devir — katalog beklenti bandı
        rep.checks += 1
        band = SPEED_BAND.get(poles)
        if band is not None and not (band[0] <= speed <= band[1]):
            if power < SMALL_MOTOR_KW and speed < band[0]:
                note = " (küçük motor — büyük kayma beklenir)"
            elif speed > band[1]:
                note = " (büyük motor — kayma sıfıra yaklaşır)"
            else:
                note = ""
            rep.warn(f"{name}: devir {speed:.0f} d/dak, beklenen bant "
                     f"{band[0]}-{band[1]}{note}")

        # 4. Verim aralığı
        rep.checks += 1
        floor = EFFICIENCY_MIN_SMALL if power < SMALL_MOTOR_KW else EFFICIENCY_MIN
        if not (floor <= eff <= EFFICIENCY_MAX):
            rep.error(f"{name}: verim %{eff} — beklenen aralık "
                      f"%{floor}-{EFFICIENCY_MAX}")

        # 5. Mil çapı ↔ gövde
        rep.checks += 1
        frame = frame_number(item["frame_size"])
        ref = IEC_SHAFT_MM.get(frame)
        if ref is None:
            rep.warn(f"{name}: gövde {frame} için IEC 60072-1 referansı yok — "
                     f"mil çapı kontrolü ATLANDI")
        elif shaft != ref:
            ince_normal = frame >= SMALL_SHAFT_OK_FROM and poles == 2 and shaft < ref
            if not ince_normal:
                rep.warn(f"{name}: mil çapı {shaft:.0f} mm, IEC 60072-1 "
                         f"gövde {frame} için {ref} mm")

        # 6. Ağırlık ve akım işareti
        rep.checks += 1
        if float(item["weight_kg"]) <= 0:
            rep.error(f"{name}: ağırlık {item['weight_kg']} kg")
        if item.get("current_a") is not None and float(item["current_a"]) <= 0:
            rep.error(f"{name}: akım {item['current_a']} A")

        # 7. (güç, kutup) tekilliği
        rep.checks += 1
        key = (power, poles)
        if key in seen:
            rep.error(f"{name}: aynı (güç, kutup) çifti ikinci kez — "
                      f"ilk satır {seen[key]}")
        else:
            seen[key] = name

    return rep


def main(argv: list[str]) -> int:
    if argv:
        paths = [Path(a) for a in argv]
    else:
        paths = sorted(MOTORS_DIR.glob("*.json"))
    if not paths:
        print("Doğrulanacak dosya bulunamadı:", MOTORS_DIR)
        return 1

    total_err = 0
    for path in paths:
        rep = check_file(path)
        total_err += len(rep.errors)
        print("=" * 70)
        print(f"{rep.name}: {rep.checks} kontrol · "
              f"{len(rep.errors)} HATA · {len(rep.warnings)} UYARI")
        for msg in rep.errors:
            print("  HATA :", msg)
        for msg in rep.warnings:
            print("  UYARI:", msg)
    print("=" * 70)
    print("TOPLAM HATA:", total_err)
    return 1 if total_err else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
