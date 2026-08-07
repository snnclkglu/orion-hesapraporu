"""Tampon katalog dosyalarını fiziğe ve katalogun kendi bağıntılarına karşı sınar.

    python buffers_validate.py            # catalog_data/buffers/*.json
    python buffers_validate.py <dosya>    # tek dosya

Çıkış kodu 0 = HATA yok, 1 = en az bir HATA. UYARI çıkış kodunu değiştirmez.

Sınanan asıl büyüklük **W ≈ κ · F · s** bağıntısıdır: sönümlenen enerji,
son kuvvet × strok çarpımının bir κ oranıdır. κ tampon TÜRÜNÜN imzasıdır ve
tür başına dar bir banttadır:

| tür                       | κ beklenen | anlamı                                  |
|---------------------------|-----------|------------------------------------------|
| hidrolik (SIBRE SP)       | 0,85      | katalog s.18'de yazılı sönümleme verimi  |
| hidrolik (firma Excel)    | 0,80      | Excel'in kendi kabulü                    |
| kauçuk, silindirik        | ~0,31     | doğrusal olmayan yay: kuvvet sonda patlar|
| kauçuk, konik             | 0,24–0,46 | yükseklik/çap oranına kuvvetle bağlı     |
| hücresel poliüretan       | 0,50–0,90 | hacimce sıkışabilir, uzun strok          |

κ bandının DIŞINA çıkan satır ya çıkarım hatasıdır ya da katalogun kendi
tutarsızlığıdır; ikisi de sessiz geçmemelidir.
"""

from __future__ import annotations

import json
import os
import sys

from buffers_common import OUT_DIR

if hasattr(sys.stdout, "reconfigure"):  # Windows konsolu cp1254 açılır
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ERRORS: list[str] = []
WARNINGS: list[str] = []
SKIPPED: list[str] = []


def err(where: str, msg: str) -> None:
    ERRORS.append(f"[HATA]  {where}: {msg}")


def warn(where: str, msg: str) -> None:
    WARNINGS.append(f"[UYARI] {where}: {msg}")


def skip(where: str, msg: str) -> None:
    SKIPPED.append(f"[ATLANDI] {where}: {msg}")


# --------------------------------------------------------------------------
# ortak kontroller
# --------------------------------------------------------------------------

def check_shape(name: str, doc: dict) -> list[dict]:
    for key in ("meta", "fields", "items"):
        if key not in doc:
            err(name, f"'{key}' anahtarı yok")
            return []
    items = doc["items"]
    if not items:
        err(name, "items boş")
        return []
    for i, it in enumerate(items):
        missing = [f for f in doc["fields"] if f not in it]
        if missing:
            err(name, f"satır {i} ({it.get('model', '?')}): eksik alan {missing}")
    return items


def check_unique(name: str, items: list[dict], key: str) -> None:
    seen: dict = {}
    for it in items:
        v = it.get(key)
        if v in seen:
            err(name, f"'{v}' iki kez geçiyor ({key})")
        seen[v] = True


def check_range(name: str, items: list[dict], field: str,
                lo: float, hi: float, required: bool = True) -> None:
    for it in items:
        v = it.get(field)
        if v is None:
            if required:
                warn(name, f"{it.get('model', '?')}: {field} boş")
            continue
        if not (lo <= v <= hi):
            err(name, f"{it.get('model', '?')}: {field} = {v}, "
                      f"beklenen aralık [{lo}, {hi}]")


def check_kappa(name: str, items: list[dict], energy_field: str,
                force_field: str, stroke_m, lo: float, hi: float,
                low_is_warning: bool = False) -> None:
    """W / (F · s) oranını banda karşı sınar. stroke_m: satırdan metre strok.

    low_is_warning: bandın ALTINA düşmek üreticinin ürünü bağıntının izin
    verdiğinden DAHA DÜŞÜK derecelendirmesi demektir — muhafazakârdır, hata
    değil uyarıdır. Bandın ÜSTÜ her zaman hatadır (ürün taşıyabileceğinden
    fazlasını vaat ediyor ya da çıkarım yanlış).
    """
    for it in items:
        w = it.get(energy_field)
        f = it.get(force_field)
        s = stroke_m(it)
        if not w or not f or not s:
            skip(name, f"{it.get('model', '?')}: κ hesaplanamadı "
                       f"(W={w}, F={f}, s={s})")
            continue
        k = w / (f * s)
        if k > hi:
            err(name, f"{it.get('model', '?')}: κ = W/(F·s) = {k:.3f} > {hi} "
                      f"(W={w}, F={f}, s={s})")
        elif k < lo:
            (warn if low_is_warning else err)(
                name, f"{it.get('model', '?')}: κ = W/(F·s) = {k:.3f} < {lo} "
                      f"(W={w}, F={f}, s={s})"
                      + (" — katalog ürünü bağıntının izin verdiğinden düşük "
                         "derecelendirmiş (muhafazakâr)" if low_is_warning else ""))


def print_error_index(doc: dict, keys: tuple[str, ...]) -> dict:
    """meta.known_print_errors listesini anahtara göre indeksler."""
    return {
        tuple(e.get(k) for k in keys): e
        for e in (doc["meta"].get("known_print_errors") or [])
    }


def check_monotonic(name: str, items: list[dict], group_fields: tuple[str, ...],
                    x_field: str, y_field: str, direction: str,
                    strict: bool = False, severity=err) -> None:
    """Aynı grupta x artarken y'nin yönünü sınar ('artan' | 'azalan' | 'artmayan')."""
    groups: dict = {}
    for it in items:
        key = tuple(it.get(g) for g in group_fields)
        if it.get(x_field) is None or it.get(y_field) is None:
            continue
        groups.setdefault(key, []).append(it)
    for key, rows in groups.items():
        rows.sort(key=lambda r: r[x_field])
        for a, b in zip(rows, rows[1:]):
            if a[x_field] == b[x_field]:
                continue
            ya, yb = a[y_field], b[y_field]
            bad = (
                (direction == "artan" and yb < ya)
                or (direction == "artan" and strict and yb == ya)
                or (direction == "azalan" and yb > ya)
                or (direction == "azalan" and strict and yb == ya)
            )
            if bad:
                severity(
                    name,
                    f"{'/'.join(str(k) for k in key)}: {x_field} "
                    f"{a[x_field]}→{b[x_field]} iken {y_field} "
                    f"{ya}→{yb} ({direction} bekleniyordu) "
                    f"[{a.get('model', '?')} → {b.get('model', '?')}]",
                )


# --------------------------------------------------------------------------
# dosyaya özel kontroller
# --------------------------------------------------------------------------

def validate_sibre_hydraulic(name: str, doc: dict) -> None:
    items = check_shape(name, doc)
    if not items:
        return
    check_unique(name, items, "model")
    check_range(name, items, "stroke_mm", 50, 1000)
    check_range(name, items, "energy_capacity_kj", 1, 1000)
    check_range(name, items, "max_end_force_kn", 10, 1500)
    check_range(name, items, "weight_kg", 1, 500)
    check_range(name, items, "body_dia_d1_mm", 50, 400)
    check_range(name, items, "plunger_dia_d2_mm", 40, 350)

    eta = doc["meta"].get("damping_efficiency", 0.85)
    check_kappa(name, items, "energy_capacity_kj", "max_end_force_kn",
                lambda it: (it.get("stroke_mm") or 0) / 1000,
                eta * 0.97, eta * 1.03, low_is_warning=True)

    for it in items:
        d1, d2 = it.get("body_dia_d1_mm"), it.get("plunger_dia_d2_mm")
        if d1 and d2 and d2 >= d1:
            err(name, f"{it['model']}: piston çapı d2={d2} ≥ gövde çapı d1={d1}")
        l1, s = it.get("length_l1_mm"), it.get("stroke_mm")
        if l1 and s and l1 <= s:
            err(name, f"{it['model']}: L1={l1} ≤ strok {s}")
        if it.get("max_impact_speed_mps") is None:
            skip(name, f"{it['model']}: max_impact_speed_mps katalogda basılı değil")

    check_monotonic(name, items, ("series", "mounting"), "stroke_mm",
                    "energy_capacity_kj", "artan")
    check_monotonic(name, items, ("series", "mounting"), "stroke_mm",
                    "max_end_force_kn", "azalan")
    check_monotonic(name, items, ("series", "mounting"), "stroke_mm",
                    "weight_kg", "artan")


def validate_force_matrix(name: str, doc: dict) -> None:
    items = check_shape(name, doc)
    if not items:
        return
    eta = doc["meta"].get("damping_efficiency", 0.85)
    known = print_error_index(doc, ("type", "stroke_mm", "capacity_kj"))
    hit: set = set()
    for it in items:
        s = it["stroke_mm"] / 1000
        expected = it["capacity_kj"] / (s * eta)
        got = it["impact_force_kn"]
        key = (it["type"], it["stroke_mm"], it["capacity_kj"])
        # katalog tam sayıya yuvarlar; ±1 kN + %2 bandı
        if abs(got - expected) > max(1.0, 0.02 * expected):
            msg = (f"tip {it['type']} / {it['stroke_mm']} mm / "
                   f"{it['capacity_kj']} kJ: basılı F = {got} kN, "
                   f"F = Ea/(s·{eta}) = {expected:.1f} kN")
            e = known.get(key)
            if e and e.get("printed_kn") == got:
                hit.add(key)
                warn(name, msg + f" — BİLİNEN BASKI HATASI: {e['reason']}")
            else:
                err(name, msg)
    for key, e in known.items():
        if key not in hit:
            err(name, f"meta.known_print_errors girişi ARTIK GEÇERSİZ: {key} "
                      f"({e}) — veri değişmiş, liste güncellenmeli")
    check_monotonic(name, items, ("type", "stroke_mm"), "capacity_kj",
                    "impact_force_kn", "artan", strict=True)


def validate_metering_pins(name: str, doc: dict) -> None:
    items = check_shape(name, doc)
    if not items:
        return
    check_range(name, items, "design_mass_t_max", 1, 5000)
    check_range(name, items, "stroke_mm", 50, 1000)
    known = print_error_index(doc, ("series", "stroke_mm", "design_mass_t_max"))
    hit: set = set()

    groups: dict = {}
    for it in items:
        groups.setdefault((it["series"], it["stroke_mm"]), []).append(it)
    for key, rows in groups.items():
        rows.sort(key=lambda r: r["design_mass_t_max"])
        for a, b in zip(rows, rows[1:]):
            if int(b["metering_pin_code"]) > int(a["metering_pin_code"]):
                continue
            msg = (f"{key[0]} / {key[1]} mm: tasarım kütlesi "
                   f"{a['design_mass_t_max']}→{b['design_mass_t_max']} t iken "
                   f"iğne numarası {a['metering_pin_code']}→"
                   f"{b['metering_pin_code']} (artması beklenir)")
            # kusurlu hücre a ya da b olabilir; ikisinin de anahtarına bak
            match = None
            for row in (b, a):
                k = (row["series"], row["stroke_mm"], row["design_mass_t_max"])
                e = known.get(k)
                if e and e.get("printed_code") == row["metering_pin_code"]:
                    match = (k, e)
                    break
            if match:
                hit.add(match[0])
                warn(name, msg + f" — BİLİNEN BASKI HATASI: {match[1]['reason']}")
            else:
                err(name, msg)
    for key, e in known.items():
        if key not in hit:
            err(name, f"meta.known_print_errors girişi ARTIK GEÇERSİZ: {key} "
                      f"({e}) — veri değişmiş, liste güncellenmeli")


def validate_rubber(name: str, doc: dict) -> None:
    items = check_shape(name, doc)
    if not items:
        return
    check_unique(name, items, "model")
    check_range(name, items, "diameter_mm", 10, 400)
    check_range(name, items, "height_mm", 5, 300)
    check_range(name, items, "energy_capacity_j", 0.5, 40000)
    check_range(name, items, "max_force_kn", 0.5, 800)
    check_range(name, items, "weight_kg", 0.001, 100)

    for it in items:
        if it["max_compression_pct"] != 50:
            err(name, f"{it['model']}: kauçukta max_compression_pct "
                      f"{it['max_compression_pct']}, beklenen 50")
        if it["height_mm"] and it["height_mm"] > 1.3 * it["diameter_mm"]:
            warn(name, f"{it['model']}: h={it['height_mm']} > 1,3·d="
                       f"{1.3 * it['diameter_mm']:.0f} — burkulma riski, "
                       f"katalog dışı oran olabilir")

    sil = [it for it in items if it["form"] == "silindirik"]
    kon = [it for it in items if it["form"] == "konik"]

    # Enerji J, kuvvet kN. κ = W[J] / (F[N] · s[m]); %50 sıkışmada
    # s[m] = 0,5·h[mm]/1000 olduğundan F[N]·s[m] = F[kN]·0,5·h[mm].
    def stroke_mm_half(it: dict) -> float:
        return 0.5 * (it["height_mm"] or 0)

    check_kappa(name, sil, "energy_capacity_j", "max_force_kn",
                stroke_mm_half, 0.30, 0.34)
    check_kappa(name, kon, "energy_capacity_j", "max_force_kn",
                stroke_mm_half, 0.22, 0.48)

    # aynı çapta yükseklik artarken enerji artar, kuvvet azalır
    for form in ("silindirik", "konik"):
        rows = [it for it in items if it["form"] == form]
        check_monotonic(name, rows, ("diameter_mm", "mounting"), "height_mm",
                        "energy_capacity_j", "artan")
        check_monotonic(name, rows, ("diameter_mm", "mounting"), "height_mm",
                        "max_force_kn", "azalan")
    # çap artarken enerji artar (aynı montaj, h/d ≈ 0,8 ailesi)
    fam = [it for it in items
           if it["height_mm"] and abs(it["height_mm"] / it["diameter_mm"] - 0.8) <= 0.03]
    check_monotonic(name, fam, ("mounting", "form"), "diameter_mm",
                    "energy_capacity_j", "artan", strict=True)


def validate_cellular(name: str, doc: dict) -> None:
    items = check_shape(name, doc)
    if not items:
        return
    check_unique(name, items, "model")
    check_range(name, items, "diameter_mm", 50, 800)
    check_range(name, items, "height_mm", 20, 1000)
    check_range(name, items, "energy_capacity_kj", 0.1, 2000)
    check_range(name, items, "energy_capacity_static_kj", 0.1, 2000)
    check_range(name, items, "max_force_kn", 1, 5000)
    check_range(name, items, "weight_kg", 0.05, 500)

    for it in items:
        if it["max_compression_pct"] != 80:
            err(name, f"{it['model']}: hücreselde max_compression_pct "
                      f"{it['max_compression_pct']}, beklenen 80")
        st, dy = it.get("energy_capacity_static_kj"), it.get("energy_capacity_kj")
        if st and dy and st >= dy:
            err(name, f"{it['model']}: statik kapasite {st} ≥ 4 m/s kapasitesi "
                      f"{dy} — hızla artması beklenir")

    check_kappa(name, items, "energy_capacity_kj", "max_force_kn",
                lambda it: 0.8 * (it["height_mm"] or 0) / 1000, 0.50, 0.90)
    check_monotonic(name, items, ("diameter_mm", "mounting"), "height_mm",
                    "energy_capacity_kj", "artan", strict=True)
    check_monotonic(name, items, ("diameter_mm", "mounting"), "height_mm",
                    "weight_kg", "artan")
    check_monotonic(name, items, ("mounting",), "diameter_mm",
                    "max_force_kn", "artan")


def validate_curves(name: str, doc: dict) -> None:
    items = check_shape(name, doc)
    if not items:
        return
    check_unique(name, items, "diameter_mm")
    for it in items:
        dia = it["diameter_mm"]
        for field in ("energy_curve", "force_curve"):
            pts = it[field]
            if len(pts) < 5:
                err(name, f"Ø{dia} {field}: {len(pts)} nokta, en az 5 bekleniyor")
                continue
            if pts[0] != [0.0, 0.0]:
                err(name, f"Ø{dia} {field}: %0 noktası {pts[0]}, [0, 0] olmalı")
            if abs(pts[-1][0] - it["max_compression_pct"]) > 0.01:
                err(name, f"Ø{dia} {field}: son nokta %{pts[-1][0]}, "
                          f"%{it['max_compression_pct']} olmalı")
            for a, b in zip(pts, pts[1:]):
                if b[0] <= a[0]:
                    err(name, f"Ø{dia} {field}: sıkışma artmıyor {a} → {b}")
                if b[1] < a[1]:
                    err(name, f"Ø{dia} {field}: değer azalıyor {a} → {b} — "
                              f"kauçukta hem enerji hem kuvvet monoton artar")

        # uç nokta ↔ ürün tablosu
        for ratio_field, label in (("endpoint_energy_ratio", "enerji"),
                                   ("endpoint_force_ratio", "kuvvet")):
            r = it.get(ratio_field)
            if r is None:
                skip(name, f"Ø{dia}: {label} uç noktası karşılaştırılamadı — "
                           f"bu çapta silindirik ürün yok")
            elif abs(r - 1.0) > 0.05:
                err(name, f"Ø{dia}: {label} uç noktası ürün tablosunun "
                          f"%{r * 100:.1f}'i — kalibrasyon şüpheli")

        # enerji eğrisi ≈ kuvvet eğrisinin integrali
        h = it["height_mm"]
        f_pts = it["force_curve"]
        integral = 0.0
        for a, b in zip(f_pts, f_pts[1:]):
            ds = (b[0] - a[0]) / 100 * h / 1000     # m
            integral += 0.5 * (a[1] + b[1]) * ds    # kN·m = kJ
        integral_j = integral * 1000
        w_end = it["energy_curve"][-1][1]
        if w_end:
            k = integral_j / w_end
            if not (0.85 <= k <= 1.25):
                err(name, f"Ø{dia}: ∫F ds = {integral_j:.0f} J, enerji eğrisi "
                          f"{w_end} J (oran {k:.2f}) — iki eğri tutarsız")


def validate_firma_excel(name: str, doc: dict) -> None:
    items = check_shape(name, doc)
    if not items:
        return
    check_unique(name, items, "model")
    check_range(name, items, "stroke_mm", 20, 1000)
    check_range(name, items, "energy_capacity_kj", 1, 1000)
    check_range(name, items, "max_force_kn", 10, 2000)
    check_kappa(name, items, "energy_capacity_kj", "max_force_kn",
                lambda it: (it.get("stroke_mm") or 0) / 1000, 0.78, 0.82)
    for it in items:
        if it.get("type") != "bilinmiyor":
            warn(name, f"{it['model']}: type = {it.get('type')} — üretici "
                       f"kataloğuyla teyit edilmemiş satırda tür iddia edilemez")
    v = doc["meta"].get("sibre_sp_verification") or {}
    if v.get("mismatched"):
        err(name, f"Excel ↔ SIBRE kataloğu farkı: {v['mismatched']}")


VALIDATORS = {
    "sibre_sp_hydraulic.json": validate_sibre_hydraulic,
    "sibre_sp_force_matrix.json": validate_force_matrix,
    "sibre_sp_metering_pins.json": validate_metering_pins,
    "conductix_rubber.json": validate_rubber,
    "conductix_cellular.json": validate_cellular,
    "conductix_curves.json": validate_curves,
    "firma_excel_buffers.json": validate_firma_excel,
}


def main(argv: list[str]) -> int:
    paths = argv[1:] or [
        os.path.join(OUT_DIR, f) for f in sorted(os.listdir(OUT_DIR))
        if f.endswith(".json")
    ]
    print(f"Tampon katalog doğrulaması — {len(paths)} dosya\n")
    for path in paths:
        base = os.path.basename(path)
        with open(path, encoding="utf-8") as fh:
            doc = json.load(fh)
        fn = VALIDATORS.get(base)
        n = len(doc.get("items", []))
        if fn is None:
            warn(base, "tanınmayan dosya — yalnız biçim kontrol edildi")
            check_shape(base, doc)
        else:
            fn(base, doc)
        print(f"  {base:32s} {n:4d} satır")

    print()
    for line in ERRORS:
        print(line)
    for line in WARNINGS:
        print(line)
    for line in SKIPPED:
        print(line)

    print(f"\nTOPLAM: {len(ERRORS)} HATA, {len(WARNINGS)} UYARI, "
          f"{len(SKIPPED)} ATLANDI")
    return 1 if ERRORS else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
