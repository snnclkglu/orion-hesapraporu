# -*- coding: utf-8 -*-
"""
pafta_ayikla.py — Tek DWG icindeki TUM paftalari ayri PDF'lere basar ve
malzeme listelerini tek bir Excel/JSON dosyasinda toplar.

    python pafta_ayikla.py "C:\\Projeler\\0063" --out "C:\\Projeler\\0063\\PDF"

Gereksinimler:
    Windows + AutoCAD (tam surum, LT degil)
    pip install pywin32 openpyxl

Nasil calisir
-------------
1) AutoCAD'i COM uzerinden surer (komut istemi dizisine BAGIMLI DEGILDIR;
   -PLOT gibi surumden surume degisen prompt siralari kullanilmaz).
2) Model uzayinda antetleri bulur:  "Resim No / Drawing No" etiketini iceren,
   en/boy orani A-serisine uyan blok cerceveleri = paftalar.
3) Her paftanin OLCEGINI cercevenin GERCEK OLCUSUNDEN hesaplar.
   Antette yazan olcek yalnizca kontrol icin okunur; ressam antete yanlis
   deger yazmis olsa bile PDF dogru olcekte cikar, rapora uyari dusulur.
4) Pencereyi tam kagit dikdortgeni olacak sekilde kurar (cerceve merkezli),
   1:N gercek olcekle "full bleed" kagida basar.
5) ACAD_TABLE malzeme listelerini hucre hucre okur, tek Excel'de toplar.

Sinan Colakoglu / Orion Vinc icin hazirlandi.
"""

from __future__ import annotations

import argparse
import collections
import json
import math
import os
import re
import sys
import time
import traceback

if os.name != "nt":
    print("UYARI: bu arac Windows + AutoCAD gerektirir. "
          "AutoCAD olmadan on-kontrol icin pafta_dxf.py kullanin.")

try:
    import pythoncom
    import win32com.client
    import win32com.client.dynamic as _wdyn
    from win32com.client import VARIANT
except ImportError:  # pragma: no cover
    pythoncom = None
    win32com = None
    _wdyn = None
    VARIANT = None


def _dyn(obj):
    """Bir varligi GEC BAGLAMA sarmalayicisina cevirir.

    EnsureDispatch (erken baglama) Application/Document tiplerini kesinlestirdi
    ve "Item.ModelSpace" hatasini cozdu. Ama bunun bir yan etkisi var:
    koleksiyonlardan gelen varliklar GENEL 'IAcadEntity' arayuzuyle sariliyor.
    O arayuzde Layer ve ObjectName var, ama TextString, EffectiveName, Rows
    gibi TIPE OZEL ozellikler YOK - erisilmek istenince AttributeError verir
    ve metinler bos, blok adlari '?', tablolar 0x0 gorunur.

    Cozum: uygulama/dokuman seviyesinde erken baglama kalir (kararliligi
    oradan aliyoruz), VARLIK seviyesinde gec baglamaya doneriz - o zaman
    her ozellik ismiyle cozulur.
    """
    if _wdyn is None:
        return obj
    try:
        ole = getattr(obj, "_oleobj_", None)
        if ole is not None:
            return _wdyn.Dispatch(ole)
    except Exception:
        pass
    return obj

from pafta_core import (AttrItem, BoxItem, TableItem, TextItem, build_sheets,
                        dedupe_sheets, iptal_isaretle, kume_kutusu,
                        output_names, rev_etiketlerini_ata, safe_filename,
                        sheet_clusters)
import pafta_report
import pafta_tani
from pafta_plotter import sessiz_pdf_plotter

# AutoCAD ActiveX sabitleri
AC_SELECTION_SET_ALL = 5
AC_MODEL_SPACE = 1
AC_MILLIMETERS = 1
AC_PLOT_WINDOW = 4
AC_0_DEGREES = 0

WANTED_DXF_TYPES = "TEXT,MTEXT,INSERT,LWPOLYLINE,POLYLINE,ACAD_TABLE"


# ---------------------------------------------------------------------------
# AutoCAD baglantisi
# ---------------------------------------------------------------------------
# AutoCAD mesgulken COM cagrilarini reddeder. Bu HRESULT'lar "simdi olmaz,
# birazdan tekrar dene" demektir; hata degildir.
_BUSY_HRESULTS = (
    -2147418111,   # RPC_E_CALL_REJECTED  ("Arama aranan tarafindan kabul edilmedi")
    -2147417846,   # RPC_E_SERVERCALL_RETRYLATER
    -2147417851,   # RPC_E_SERVERFAULT / mesgul
    -2147023170,   # RPC_E_DISCONNECTED benzeri gecici durumlar
)


def _hresult(exc) -> int | None:
    for v in (getattr(exc, "hresult", None),
              (exc.args[0] if getattr(exc, "args", None) else None)):
        if isinstance(v, int):
            return v
    return None


def com_call(fn, *args, tries: int = 90, delay: float = 0.5, **kw):
    """AutoCAD mesgulse bekleyip tekrar deneyerek bir COM cagrisi yapar."""
    last = None
    for i in range(tries):
        try:
            return fn(*args, **kw)
        except Exception as e:            # pywintypes.com_error dahil
            if _hresult(e) not in _BUSY_HRESULTS:
                raise
            last = e
            if i in (6, 30, 60):
                print("   ... AutoCAD mesgul, bekleniyor "
                      "(acik bir iletisim kutusu veya suren bir komut olabilir)")
            time.sleep(delay)
    raise RuntimeError(
        "AutoCAD COM cagrilarini kabul etmiyor. Acik bir iletisim kutusu "
        "(dialog) veya devam eden bir komut olabilir; AutoCAD'de ESC'e basip "
        "tekrar deneyin."
    ) from last


def wait_ready(acad, timeout: float = 120.0) -> bool:
    """AutoCAD komut kabul edecek duruma gelene kadar bekler."""
    t0 = time.time()
    while time.time() - t0 < timeout:
        try:
            _ = acad.Documents.Count
            return True
        except Exception as e:
            if _hresult(e) not in _BUSY_HRESULTS:
                return True           # baska bir sorun; cagiran ilgilensin
            time.sleep(0.5)
    return False


def _erken_baglama():
    """AutoCAD tip kutuphanesini uretip ERKEN BAGLAMA ile baglanir.

    Neden: saf gec baglama (Dispatch) ile pywin32, metotlarin DONUS
    degerlerinin tipini bazen cozemiyor. O zaman elimize 'Open' veya 'Item'
    adinda, .FullName'i calisan ama .ModelSpace'i olmayan yarim bir nesne
    geciyor ve "AttributeError: Item.ModelSpace" hatasi aliniyor.
    EnsureDispatch tip kutuphanesini uretir, boyle bir belirsizlik kalmaz.
    """
    try:
        return win32com.client.gencache.EnsureDispatch("AutoCAD.Application")
    except Exception:
        pass
    # gen_py onbellegi bozuksa temizleyip bir kez daha dene
    try:
        import shutil
        from win32com.client import gencache
        yol = gencache.GetGeneratePath()
        gencache.__init__()
        shutil.rmtree(yol, ignore_errors=True)
        return win32com.client.gencache.EnsureDispatch("AutoCAD.Application")
    except Exception:
        return None


def connect_autocad(visible: bool = True):
    if win32com is None:
        raise RuntimeError("pywin32 kurulu degil.  ->  pip install pywin32")
    pythoncom.CoInitialize()

    acad = _erken_baglama()
    if acad is None:
        print("  ! Tip kutuphanesi uretilemedi, gec baglamaya dusuluyor.")
        try:
            acad = win32com.client.GetActiveObject("AutoCAD.Application")
        except Exception:
            print("  Calisan AutoCAD bulunamadi, yeni ornek baslatiliyor...")
            acad = win32com.client.Dispatch("AutoCAD.Application")
    for _ in range(120):
        try:
            _ = acad.Documents
            break
        except Exception:
            time.sleep(1)
    try:
        acad.Visible = bool(visible)
    except Exception:
        pass
    return acad


def _as_document(acad, obj):
    """Eline gecen nesneyi GERCEK bir AutoCAD Document'e cevirir.

    Dort kademeli: dogrudan -> tip donusumu -> yeniden dispatch ->
    dokumani aktif yapip ActiveDocument'ten al.
    """
    if obj is None:
        return None
    if _looks_like_document(obj):
        return obj
    for arayuz in ("IAcadDocument", "IAcadDocument2"):
        try:
            d = win32com.client.CastTo(obj, arayuz)
            if _looks_like_document(d):
                return d
        except Exception:
            pass
    try:
        d = win32com.client.Dispatch(obj)
        if _looks_like_document(d):
            return d
    except Exception:
        pass
    try:
        obj.Activate()
        time.sleep(0.4)
        d = acad.ActiveDocument
        if _looks_like_document(d):
            return d
    except Exception:
        pass
    return None


def already_open(acad, path: str):
    tgt = os.path.normcase(os.path.abspath(path))
    n = com_call(lambda: acad.Documents.Count)
    for i in range(n):
        try:
            d = com_call(lambda: acad.Documents.Item(i))
            if os.path.normcase(os.path.abspath(d.FullName)) == tgt:
                return d
        except Exception:
            continue
    return None


def _looks_like_document(obj) -> bool:
    try:
        _ = obj.ModelSpace
        return True
    except Exception:
        return False


def open_document(acad, path: str, read_only: bool = True):
    """Cizimi acar ve GERCEK Document nesnesini dondurur.

    Documents.Open()'in donus degerine guvenilmez: gec baglama (late binding)
    ile pywin32 bazen tipi cozemez ve 'Open.ModelSpace' gibi AttributeError
    verir. Bu yuzden acmadan sonra dokumani Documents koleksiyonundan
    (veya ActiveDocument'ten) yeniden buluyoruz.
    """
    ham = already_open(acad, path)
    if ham is not None:
        doc = _as_document(acad, ham)
        if doc is not None:
            return doc, False
        raise RuntimeError(
            "Acik cizime erisilemedi. Kaydedilmemis calismayi korumak icin "
            "cizim otomatik kapatilmadi. AutoCAD'de cizimi kaydedip "
            "kapattiktan sonra bu dosyayi yeniden deneyin.")

    ret = None
    try:
        ret = com_call(lambda: acad.Documents.Open(path, read_only))
    except RuntimeError:
        raise
    except Exception:
        try:
            ret = com_call(lambda: acad.Documents.Open(path))
        except Exception as e:
            raise RuntimeError(f"Cizim acilamadi: {e}") from e

    doc = _as_document(acad, already_open(acad, path))
    if doc is None:
        doc = _as_document(acad, ret)
    if doc is None:
        try:
            doc = _as_document(acad, acad.ActiveDocument)
        except Exception:
            doc = None
    if doc is None:
        raise RuntimeError(
            "Cizim acildi ama AutoCAD dokuman nesnesi cozulemedi.\n"
            "     Cozum: bu klasordeki 6-COM-ONBELLEGI-TEMIZLE.bat dosyasini "
            "calistirip tekrar deneyin.")
    return doc, True


def get_model_layout(doc):
    for i in range(doc.Layouts.Count):
        lay = doc.Layouts.Item(i)
        try:
            if str(lay.Name).strip().lower() == "model":
                return lay
        except Exception:
            continue
    return doc.Layouts.Item("Model")


# ---------------------------------------------------------------------------
# Varlik toplama
# ---------------------------------------------------------------------------
def _pt2(x: float, y: float):
    return VARIANT(pythoncom.VT_ARRAY | pythoncom.VT_R8, [float(x), float(y)])


def _iter_model_entities(doc):
    """Model uzayindaki ilgili varliklari dondurur.

    Once DXF kodu 0 filtreli bir secim kumesi denenir (buyuk cizimlerde
    cok daha hizli); olmazsa model uzayi bastan sona dolasilir.
    """
    name = "PAFTA_AYIKLA_SS"
    ss = None
    try:
        try:
            doc.SelectionSets.Item(name).Delete()
        except Exception:
            pass
        ss = doc.SelectionSets.Add(name)
        codes = VARIANT(pythoncom.VT_ARRAY | pythoncom.VT_I2, [0])
        values = VARIANT(pythoncom.VT_ARRAY | pythoncom.VT_VARIANT,
                         [WANTED_DXF_TYPES])
        ss.Select(AC_SELECTION_SET_ALL, None, None, codes, values)
        return [_dyn(ss.Item(i)) for i in range(ss.Count)]
    except Exception:
        pass
    finally:
        try:
            if ss is not None:
                ss.Delete()
        except Exception:
            pass
    ms = doc.ModelSpace
    return [_dyn(ms.Item(i)) for i in range(ms.Count)]


AC_SELECTION_SET_CROSSING = 1


def _pt3(x: float, y: float, z: float = 0.0):
    return VARIANT(pythoncom.VT_ARRAY | pythoncom.VT_R8,
                   [float(x), float(y), float(z)])


def iptal_capraz_var_mi(doc, xmin: float, ymin: float,
                        xmax: float, ymax: float) -> bool:
    """Bir bolgenin uzerine IPTAL caprazi cizilmis mi?

    Numara: bir dikdortgenin iki koseden kosece caprazi her zaman
    MERKEZDEN gecer. Bu yuzden butun cizgileri okumaya gerek yok -
    sadece bolgenin merkezindeki kucucuk bir pencereyi kesen cizgilere
    bakip icinde bolge kadar uzun olan var mi diye sorarız. Tek capraz
    da, X de bu testten gecer.
    """
    w, h = xmax - xmin, ymax - ymin
    if w <= 0 or h <= 0:
        return False
    kosegen = math.hypot(w, h)
    cx, cy = (xmin + xmax) / 2.0, (ymin + ymax) / 2.0
    pad = max(w, h) * 0.008

    name = "PAFTA_IPTAL_SS"
    ss = None
    try:
        try:
            doc.SelectionSets.Item(name).Delete()
        except Exception:
            pass
        ss = doc.SelectionSets.Add(name)
        codes = VARIANT(pythoncom.VT_ARRAY | pythoncom.VT_I2, [0])
        values = VARIANT(pythoncom.VT_ARRAY | pythoncom.VT_VARIANT, ["LINE"])
        ss.Select(AC_SELECTION_SET_CROSSING,
                  _pt3(cx - pad, cy - pad), _pt3(cx + pad, cy + pad),
                  codes, values)
        for i in range(ss.Count):
            try:
                e = _dyn(ss.Item(i))
                s, t = e.StartPoint, e.EndPoint
                if math.hypot(t[0] - s[0], t[1] - s[1]) >= kosegen * 0.55:
                    return True
            except Exception:
                continue
    except Exception:
        return False
    finally:
        try:
            if ss is not None:
                ss.Delete()
        except Exception:
            pass
    return False


def iptal_bolgeleri_bul(doc, sheets, boxes=()) -> list[BoxItem]:
    """Cizimdeki IPTAL EDILMIS (capraz cizilmis) bolgeleri bulur.

    ONEMLI: capraz aramasi kopya iliskisine BAGLI DEGILDIR. Revizyon
    setlerindeki paftalar birbirinden farkli olabilir (gercek revizyon);
    o zaman "ayni icerikli kopya" diye bir grup olusmaz ve capraz hic
    aranmazdi. Bu yuzden aday bolgeler iki kaynaktan gelir:

      a) paftalarin UZAYSAL kumeleri (birbirine yakin duran obekler)
      b) icinde >= 2 pafta cercevesi barindiran buyuk kutular
         (grubun etrafina cizilmis dikdortgen)
    """
    adaylar: list[BoxItem] = []
    for i, kume in enumerate(sheet_clusters(sheets), 1):
        if kume:
            adaylar.append(kume_kutusu(kume, f"KUME-{i}"))
    for b in boxes:
        icinde = sum(1 for s in sheets
                     if b.contains(s.frame.xmin, s.frame.ymin)
                     and b.contains(s.frame.xmax, s.frame.ymax))
        if icinde >= 2:
            adaylar.append(b)

    gorulen: set[tuple] = set()
    out: list[BoxItem] = []
    for r in adaylar:
        k = (round(r.xmin, 1), round(r.ymin, 1), round(r.xmax, 1), round(r.ymax, 1))
        if k in gorulen:
            continue
        gorulen.add(k)
        if iptal_capraz_var_mi(doc, r.xmin, r.ymin, r.xmax, r.ymax):
            out.append(r)
    return out


def _text_anchor(obj):
    try:
        al = int(getattr(obj, "Alignment", 0) or 0)
    except Exception:
        al = 0
    p = None
    if al != 0:
        try:
            p = obj.TextAlignmentPoint
        except Exception:
            p = None
    if p is None or (abs(p[0]) < 1e-12 and abs(p[1]) < 1e-12):
        try:
            p = obj.InsertionPoint
        except Exception:
            p = (0.0, 0.0, 0.0)
    return float(p[0]), float(p[1])


def _table_rows(obj) -> list[list[str]]:
    try:
        nr = int(obj.Rows)
        nc = int(obj.Columns)
    except Exception:
        return []
    rows: list[list[str]] = []
    for r in range(nr):
        row: list[str] = []
        for c in range(nc):
            val = ""
            for getter in ("GetText", "GetCellValue", "GetTextString"):
                try:
                    v = getattr(obj, getter)(r, c)
                    if v is not None:
                        val = str(v)
                    break
                except Exception:
                    continue
            row.append(val)
        rows.append(row)
    return rows


def _block_attributes(obj, block_name: str, layer: str) -> list[AttrItem]:
    """Oznitelikli blok referansindaki ATTRIB'leri okur."""
    out: list[AttrItem] = []
    try:
        if not bool(obj.HasAttributes):
            return out
    except Exception:
        return out
    try:
        atts = obj.GetAttributes()
    except Exception:
        return out
    for at in atts or ():
        at = _dyn(at)
        try:
            tag = str(at.TagString)
            val = str(at.TextString)
        except Exception:
            continue
        try:
            p = at.InsertionPoint
            x, y = float(p[0]), float(p[1])
        except Exception:
            x = y = 0.0
        try:
            h = float(at.Height)
        except Exception:
            h = 0.0
        out.append(AttrItem(x, y, tag, val, layer, h, block_name))
    return out


def collect(doc):
    texts: list[TextItem] = []
    boxes: list[BoxItem] = []
    tables: list[TableItem] = []
    attrs: list[AttrItem] = []

    for i, obj in enumerate(_iter_model_entities(doc)):
        if i and i % 500 == 0:
            print(f"   ... {i} cizim nesnesi okundu", flush=True)
        try:
            oname = str(obj.ObjectName)
        except Exception:
            continue
        try:
            layer = str(obj.Layer)
        except Exception:
            layer = ""

        if oname in ("AcDbText", "AcDbMText"):
            x, y = _text_anchor(obj)
            try:
                h = float(obj.Height)
            except Exception:
                h = 0.0
            try:
                s = str(obj.TextString)
            except Exception:
                s = ""
            if s:
                texts.append(TextItem(x, y, s, h, layer))

        elif oname in ("AcDbBlockReference", "AcDbPolyline", "AcDb2dPolyline"):
            try:
                mn, mx = obj.GetBoundingBox()
            except Exception:
                continue
            if oname == "AcDbBlockReference":
                nm = ""
                for attr in ("EffectiveName", "Name"):
                    try:
                        nm = str(getattr(obj, attr))
                        if nm:
                            break
                    except Exception:
                        continue
                ident = f"BLOK '{nm or '?'}' [{layer}]"
                try:
                    bscale = float(obj.XScaleFactor)
                except Exception:
                    bscale = 1.0
                got = _block_attributes(obj, nm, layer)
                attrs.extend(got)
                for a in got:
                    if a.value:
                        texts.append(TextItem(a.x, a.y, a.value, a.height, layer))
            else:
                ident = f"POLYLINE [{layer}]"
                bscale = 1.0
            boxes.append(BoxItem(ident, float(mn[0]), float(mn[1]),
                                 float(mx[0]), float(mx[1]), bscale))

        elif oname == "AcDbTable":
            try:
                mn, mx = obj.GetBoundingBox()
                xmin, ymin, xmax, ymax = (float(mn[0]), float(mn[1]),
                                          float(mx[0]), float(mx[1]))
            except Exception:
                try:
                    p = obj.InsertionPoint
                    xmin = xmax = float(p[0])
                    ymin = ymax = float(p[1])
                except Exception:
                    continue
            tables.append(TableItem(f"TBL#{i}", xmin, ymin, xmax, ymax,
                                    rows=_table_rows(obj)))

    # Saglik kontrolu: varlik var ama HIC metin okunamadiysa, bu cizimin
    # bos olmasi degil COM ozelliklerine erisilememesi demektir. Sessizce
    # "antet bulunamadi" demek yanlis teshise goturur.
    if not texts and (len(boxes) + len(tables)) > 20:
        raise RuntimeError(
            f"COM ozelliklerine erisilemiyor: {len(boxes)} kutu ve "
            f"{len(tables)} tablo bulundu ama HIC metin okunamadi.\n"
            f"     Cozum: AutoCAD'i kapatin, 6-COM-ONBELLEGI-TEMIZLE.bat "
            f"calistirin, tekrar deneyin.")
    return texts, boxes, tables, attrs


# ---------------------------------------------------------------------------
# Plot
# ---------------------------------------------------------------------------
_MEDIA_RE = re.compile(r"\(\s*([\d.]+)\s*x\s*([\d.]+)\s*(MM|INCHES|INCH)\s*\)", re.I)


def media_table(layout) -> list[tuple[str, float, float, bool]]:
    out = []
    try:
        names = layout.GetCanonicalMediaNames()
    except Exception:
        return out
    for n in names:
        n = str(n)
        pretty = n.replace("_", " ")
        m = _MEDIA_RE.search(pretty)
        if not m:
            continue
        w, h = float(m.group(1)), float(m.group(2))
        if m.group(3).upper().startswith("INCH"):
            w, h = w * 25.4, h * 25.4
        out.append((n, w, h, "FULL BLEED" in pretty.upper()))
    return out


def pick_media(layout, pw: float, ph: float, tol: float = 2.0):
    """Istenen kagit olcusune en uygun (tercihen full bleed) medyayi secer."""
    table = media_table(layout)
    best = None
    for name, w, h, fb in table:
        err = abs(w - pw) + abs(h - ph)
        if err > tol:
            continue
        score = (0 if fb else 1, err)
        if best is None or score < best[0]:
            best = (score, name, fb, w, h)
    if best:
        return best[1], best[2]
    return None, False


def configure_and_plot(doc, layout, sh, out_pdf: str, device: str,
                       ctb: str = "", target=(0.0, 0.0),
                       media_cache: dict | None = None) -> tuple[bool, str]:
    notes: list[str] = []
    if device:
        try:
            if str(layout.ConfigName) != device:
                layout.ConfigName = device
        except Exception as e:
            return False, f"Plotter ayarlanamadi ({device}): {e}"
    try:
        layout.RefreshPlotDeviceInfo()
    except Exception:
        pass

    key = (str(layout.ConfigName), round(sh.paper_w, 2), round(sh.paper_h, 2))
    if media_cache is not None and key in media_cache:
        media, full_bleed = media_cache[key]
    else:
        media, full_bleed = pick_media(layout, sh.paper_w, sh.paper_h)
        if media_cache is not None:
            media_cache[key] = (media, full_bleed)

    if media:
        try:
            layout.CanonicalMediaName = media
        except Exception as e:
            notes.append(f"kagit secilemedi ({media}): {e}")
    else:
        notes.append(
            f"{sh.paper} ({sh.paper_w:.0f}x{sh.paper_h:.0f} mm) kagidi bu "
            f"plotterda bulunamadi, mevcut kagit kullanildi")
    if media and not full_bleed:
        notes.append("full bleed kagit yok; PDF kenarlarindan birkac mm kirpilabilir")

    try:
        layout.PaperUnits = AC_MILLIMETERS
        layout.PlotRotation = AC_0_DEGREES
        layout.PlotWithPlotStyles = True
        layout.PlotWithLineweights = True
        layout.ScaleLineweights = False
        layout.PlotHidden = False
    except Exception as e:
        notes.append(f"plot ayari uyarisi: {e}")

    # Plot stili (CTB). Bos veya "-" ise cizimin kendi ayari korunur.
    # Varsayilan monochrome.ctb: aksi halde bazi cizimler renkli, bazilari
    # siyah-beyaz cikiyor - PDF'ler arasinda tutarsizlik oluyor.
    if ctb and ctb.strip() not in ("-", "."):
        try:
            mevcut = set()
            try:
                mevcut = {str(x).lower() for x in layout.GetPlotStyleTableNames()}
            except Exception:
                pass
            if mevcut and ctb.lower() not in mevcut:
                notes.append(f"plot stili '{ctb}' bu sistemde yok, "
                             f"cizimin kendi ayari kullanildi")
            else:
                layout.StyleSheet = ctb
        except Exception as e:
            notes.append(f"plot stili ayarlanamadi ({ctb}): {e}")
    try:
        notes.append(f"ctb={layout.StyleSheet or '(yok)'}")
    except Exception:
        pass

    tx, ty = float(target[0]), float(target[1])
    ll = (sh.window_ll[0] - tx, sh.window_ll[1] - ty)
    ur = (sh.window_ur[0] - tx, sh.window_ur[1] - ty)
    try:
        # SetWindowToPlot her zaman PlotType'tan ONCE cagrilmali.
        layout.SetWindowToPlot(_pt2(*ll), _pt2(*ur))
        layout.PlotType = AC_PLOT_WINDOW
        layout.UseStandardScale = False
        layout.SetCustomScale(1.0, float(sh.scale_n))
        layout.CenterPlot = True
    except Exception as e:
        return False, f"pencere/olcek ayarlanamadi: {e}"

    os.makedirs(os.path.dirname(os.path.abspath(out_pdf)) or ".", exist_ok=True)
    if os.path.exists(out_pdf):
        try:
            os.remove(out_pdf)
        except OSError:
            return False, "onceki PDF silinemedi (dosya acik olabilir)"

    plot = doc.Plot
    try:
        plot.QuietErrorMode = True
    except Exception:
        pass
    try:
        plot.NumberOfCopies = 1
    except Exception:
        pass

    try:
        ok = plot.PlotToFile(out_pdf)
    except Exception as e:
        return False, f"PlotToFile hatasi: {e}"

    for _ in range(120):
        if os.path.exists(out_pdf) and os.path.getsize(out_pdf) > 1024:
            break
        time.sleep(0.25)
    if not (os.path.exists(out_pdf) and os.path.getsize(out_pdf) > 1024):
        return False, "PDF olusmadi (BACKGROUNDPLOT=0 mi? plotter adi dogru mu?)"
    return True, "; ".join(notes)


def _wait_idle(doc, timeout: float = 20.0) -> None:
    """SendCommand asenkron calisir; komut bitene kadar bekler."""
    t0 = time.time()
    while time.time() - t0 < timeout:
        try:
            if int(doc.GetVariable("CMDACTIVE")) == 0:
                return
        except Exception:
            return
        time.sleep(0.1)


def _is_world_ucs(doc) -> bool:
    try:
        org = doc.GetVariable("UCSORG")
        xd = doc.GetVariable("UCSXDIR")
        yd = doc.GetVariable("UCSYDIR")
    except Exception:
        return True
    def close(v, ref):
        return all(abs(float(v[i]) - ref[i]) < 1e-9 for i in range(3))
    return (close(org, (0, 0, 0)) and close(xd, (1, 0, 0)) and close(yd, (0, 1, 0)))


def prepare_document(doc) -> tuple[float, float]:
    """Cizimi plot icin guvenli duruma getirir ve gorunum hedefini dondurur.

    Model uzayinda pencere plotu, gorunumun hedef noktasina (TARGET) gore
    yorumlanir. Burada UCS'i World'e alip TARGET'i okuyoruz; pencere
    koordinatlarindan bu deger cikarilir. Boylece "PDF kaymis / bos cikti"
    problemi olusmaz.
    """
    for var, val in (("BACKGROUNDPLOT", 0), ("FILEDIA", 0), ("CMDDIA", 0)):
        try:
            doc.SetVariable(var, val)
        except Exception:
            pass
    try:
        doc.Activate()
    except Exception:
        pass
    try:
        doc.ActiveLayout = get_model_layout(doc)
    except Exception:
        pass
    try:
        doc.ActiveSpace = AC_MODEL_SPACE
    except Exception:
        pass

    if not _is_world_ucs(doc):
        try:
            doc.SendCommand('(command "_.UCS" "_W") ')
            _wait_idle(doc)
        except Exception:
            pass
    try:
        if abs(float(doc.GetVariable("VIEWTWIST"))) > 1e-9:
            doc.SendCommand('(command "_.PLAN" "_W") ')
            _wait_idle(doc)
    except Exception:
        pass

    try:
        t = doc.GetVariable("TARGET")
        return float(t[0]), float(t[1])
    except Exception:
        return 0.0, 0.0


# ---------------------------------------------------------------------------
# Ana akis
# ---------------------------------------------------------------------------
_NAT_RE = re.compile(r"(\d+)")


def dogal_anahtar(s: str) -> tuple:
    """Resim numaralarini insan gibi siralar.

    '0063-00-0400' < '0063-00-0404' < '0063-00-0410'
    '0019-00-2200' < '0019-00-2200-A' < '0019-00-2200-B' < '0019-00-2201'
    Duz metin siralamasi 0410'u 044'ten once koyabilirdi; bu yontem
    sayilari sayi olarak karsilastirir.
    """
    parts = _NAT_RE.split(str(s or ""))
    return tuple(int(p) if i % 2 else p.lower() for i, p in enumerate(parts))


def birlesik_pdf(pdf_kayitlari, hedef: str) -> tuple[bool, str]:
    """Paftalari resim numarasina gore siralayip tek PDF'te birlestirir.

    Her pafta icin bir yer imi (bookmark) eklenir; 20+ paftalik birlesik
    dosyada aranan paftaya tek tiklamayla gidilir.
    """
    try:
        from pypdf import PdfReader, PdfWriter
    except ImportError:
        try:
            from PyPDF2 import PdfReader, PdfWriter    # eski surum
        except ImportError:
            return False, ("pypdf kurulu degil - birlesik PDF uretilemedi. "
                           "Kurmak icin: pip install pypdf")

    sirali = sorted(pdf_kayitlari, key=lambda z: dogal_anahtar(z[0]))
    w = PdfWriter()
    n = 0
    for etiket, yol in sirali:
        try:
            r = PdfReader(yol)
        except Exception as e:
            print(f"   ! {os.path.basename(yol)} birlestirmeye eklenemedi: {e}")
            continue
        ilk = len(w.pages)
        for sayfa in r.pages:
            w.add_page(sayfa)
        try:
            w.add_outline_item(etiket or os.path.basename(yol), ilk)
        except Exception:
            pass
        n += 1
    if n == 0:
        return False, "birlestirilecek PDF bulunamadi"
    try:
        with open(hedef, "wb") as f:
            w.write(f)
    except Exception as e:
        return False, f"yazilamadi: {e}"
    return True, f"{n} pafta"


def write_safe(fn, path: str, *args) -> str:
    """Rapor dosyasini yazar; hedef kilitliyse (Excel'de acik) yanina
    zaman damgali bir kopya birakir, programi cokertmez."""
    try:
        fn(path, *args)
        return path
    except PermissionError:
        base, ext = os.path.splitext(path)
        alt = f"{base}_{time.strftime('%Y%m%d_%H%M%S')}{ext}"
        try:
            fn(alt, *args)
            print(f"   ! {os.path.basename(path)} yazilamadi "
                  f"(Excel'de acik olabilir) -> {os.path.basename(alt)} kaydedildi.")
            return alt
        except Exception as e:
            print(f"   ! {os.path.basename(path)} yazilamadi: {e}")
    except Exception as e:
        print(f"   ! {os.path.basename(path)} yazilamadi: {e}")
    return ""


def diagnose(texts, boxes, tables, sheets=(), dwg="", path: str = "",
             attrs=(), info=None) -> None:
    """Pafta/cerceve tespitinin neden boyle sonuclandigini ayrintili doker.

    Ekrana yazar ve istenirse bir metin dosyasina da kaydeder; cikti oldugu
    gibi paylasilabilir.
    """
    from pafta_core import (ISO_PAPERS, LBL_DRAWING_NO, LBL_SHEET_NO,
                            nice_distance, norm)
    L: list[str] = []

    def w(s: str = "") -> None:
        L.append(s)
        print(s)

    w("")
    w("=" * 70)
    w(f"TANI RAPORU : {dwg}")
    w("=" * 70)
    w(f"metin: {len(texts)}   kutu(blok/polyline): {len(boxes)}   "
      f"tablo: {len(tables)}   oznitelik: {len(attrs)}")

    if attrs:
        seen: dict[str, int] = {}
        for a in attrs:
            k = f"{a.block}|{a.tag}"
            seen[k] = seen.get(k, 0) + 1
        w("")
        w(f"-- OZNITELIKLI BLOK ETIKETLERI (tag) : {len(seen)} cesit")
        for k, c in sorted(seen.items(), key=lambda kv: -kv[1])[:30]:
            blk, tag = k.split("|", 1)
            ornek = next((x.value for x in attrs
                          if x.block == blk and x.tag == tag and x.value), "")
            w(f"   {c:3d}x  blok='{blk[:22]:22.22s}' tag='{tag[:20]:20.20s}' "
              f"ornek={ornek[:30]!r}")

    def is_lbl(t):
        n = t.n
        return (any(n.startswith(k) or k in n for k in LBL_DRAWING_NO)
                and not any(n.startswith(k) or k in n for k in LBL_SHEET_NO))

    hits = [t for t in texts if is_lbl(t)]
    loose = [t for t in texts if ("RESIM" in norm(t.text) or "DRAWING" in norm(t.text))]
    w("")
    w(f"-- 'Resim No' ETIKETI: {len(hits)} adet "
      f"(gevsek arama 'RESIM/DRAWING' gecen: {len(loose)})")
    for t in hits[:20]:
        w(f"   x={t.x:12.2f} y={t.y:12.2f} h={t.height:8.2f} "
          f"katman={t.layer:16.16s} :: {t.text[:44]!r}")
    if not hits and loose:
        w("   ! Etiket eslesmedi. Gevsek aramada bulunanlar:")
        for t in loose[:20]:
            w(f"   x={t.x:12.2f} y={t.y:12.2f} h={t.height:8.2f} "
              f"katman={t.layer:16.16s} :: {t.text[:44]!r}")

    # A-serisi oranindaki kutulari kaynagina (blok adina) gore grupla:
    # gercek cerceve blogu burada hemen goze carpar.
    groups: dict[str, list] = {}
    for b in boxes:
        if b.w <= 0 or b.h <= 0:
            continue
        r = max(b.w, b.h) / min(b.w, b.h)
        if 1.30 <= r <= 1.55:
            groups.setdefault(b.ident, []).append(b)
    w("")
    w(f"-- A-SERISI ORANINDAKI KUTULAR, KAYNAGA GORE: {len(groups)} cesit")
    for ident, bs in sorted(groups.items(), key=lambda kv: -len(kv[1]))[:12]:
        w(f"   {len(bs):3d} adet  {ident}")
        sizes: dict[tuple, int] = {}
        for b in bs:
            sizes[(round(b.w, 2), round(b.h, 2), round(b.bscale, 6))] = \
                sizes.get((round(b.w, 2), round(b.h, 2), round(b.bscale, 6)), 0) + 1
        for (bw, bh, bs_), c in sorted(sizes.items(), key=lambda kv: -kv[0][0])[:14]:
            best_p, best_n, best_d = "", 0.0, 9.9
            for nm, (lo, short) in ISO_PAPERS.items():
                pw = lo if bw >= bh else short
                d = nice_distance(bw / pw)
                if d < best_d:
                    best_p, best_n, best_d = nm, bw / pw, d
            std = "evet" if best_d < 0.01 else "HAYIR"
            w(f"        {c:3d}x {bw:10.2f} x {bh:9.2f}  blok-olcek={bs_:<10.5g} "
              f"en iyi: {best_p} 1/{best_n:.4f} std={std}")

    cand = []
    for b in boxes:
        if b.w <= 0 or b.h <= 0:
            continue
        n_in = sum(1 for t in hits if b.contains(t.x, t.y))
        if n_in:
            cand.append((b, max(b.w, b.h) / min(b.w, b.h), n_in))
    w("")
    w(f"-- ETIKET ICEREN KUTULAR: {len(cand)} adet "
      f"(kucukten buyuge; oran 1.30-1.55 arasi olanlar pafta sayilir)")
    w(f"   {'genislik':>11s} {'yukseklik':>11s} {'oran':>6s} {'etiket':>6s} "
      f"{'A3 ise 1/N':>11s} {'std?':>5s}  kaynak")
    for b, r, n_in in sorted(cand, key=lambda z: z[0].area)[:25]:
        n = b.w / 420.0 if b.w >= b.h else b.w / 297.0
        ok = "EVET" if 1.30 <= r <= 1.55 else "-"
        std = "evet" if nice_distance(n) < 0.005 else "HAYIR"
        w(f"   {b.w:11.2f} {b.h:11.2f} {r:6.3f} {n_in:6d} {n:11.4f} "
          f"{std:>5s}  [{ok}] {b.ident}")

    w("")
    if info:
        w(f"-- SECILEN ETIKET STRATEJISI: {info.get('strategy', '?')}  "
          f"({info.get('anchor_count', 0)}/{info.get('label_count', 0)} etiket capa olarak kullanildi)")
    w(f"-- BULUNAN PAFTALAR: {len(sheets)}")
    for sh in sheets:
        w(f"   {sh.index:2d}. {sh.drawing_no:24.24s} cerceve "
          f"{sh.frame.w:.2f} x {sh.frame.h:.2f} -> {sh.paper} {sh.scale_label} "
          f"(antet: {sh.scale_text or '-'})  kaynak: {sh.frame.ident}")

    # Antet duzenini kesin gormek icin: sorunlu bir paftayla saglam bir
    # paftanin ANTET BOLGESINDEKI tum metinleri, etikete gore konumlariyla.
    def dump_frame(sh, baslik: str) -> None:
        fr = sh.frame
        lbl = None
        for t in texts:
            if fr.contains(t.x, t.y) and is_lbl(t):
                lbl = t
                break
        w("")
        w(f"-- {baslik}: pafta #{sh.index} ({sh.drawing_no or 'BOS'}) "
          f"cerceve {fr.w:.1f}x{fr.h:.1f}")
        if lbl is None:
            w("   (etiket bulunamadi)")
            return
        w(f"   etiket: x={lbl.x:.2f} y={lbl.y:.2f} katman={lbl.layer}")
        w(f"   {'dx':>9s} {'dy':>9s} {'h':>7s} {'katman':<16s} metin")
        near = []
        for t in texts:
            if not fr.contains(t.x, t.y):
                continue
            dx, dy = t.x - lbl.x, lbl.y - t.y
            # Ust sinir genis: 'Olcek / Scale' alani etiketin ~%7 ustunde
            # kaliyor, dar pencerede dokume girmiyordu.
            if abs(dx) <= fr.w * 0.25 and -fr.h * 0.11 <= dy <= fr.h * 0.12:
                near.append((dy, dx, t))
        near.sort(key=lambda z: (z[0], z[1]))
        for dy, dx, t in near[:40]:
            w(f"   {dx:9.2f} {dy:9.2f} {t.height:7.2f} {t.layer:<16.16s} {t.text[:46]!r}")

    bad = next((s for s in sheets if not s.drawing_no
                or not any(c.isdigit() for c in s.drawing_no)), None)
    good = next((s for s in sheets if s.drawing_no
                 and any(c.isdigit() for c in s.drawing_no)), None)
    if bad is not None:
        dump_frame(bad, "SORUNLU PAFTANIN ANTET BOLGESI")
    if good is not None and good is not bad:
        dump_frame(good, "SAGLAM PAFTANIN ANTET BOLGESI")

    w("")
    w(f"-- TABLOLAR: {len(tables)}")
    for tb in tables[:20]:
        nr = len(tb.rows)
        nc = len(tb.rows[0]) if tb.rows else 0
        w(f"   {nr:3d} satir x {nc:2d} sutun  merkez=({tb.cx:.1f},{tb.cy:.1f})  {tb.ident}")
    w("=" * 70)

    if path:
        try:
            os.makedirs(os.path.dirname(os.path.abspath(path)) or ".", exist_ok=True)
            with open(path, "w", encoding="utf-8") as f:
                f.write("\n".join(L))
            print(f"   (tani dosyasi: {path})")
        except Exception as e:
            print(f"   ! tani dosyasi yazilamadi: {e}")


def gather_dwgs(inputs: list[str], recursive: bool) -> list[str]:
    files: list[str] = []
    for p in inputs:
        if os.path.isdir(p):
            if recursive:
                for root, _dirs, names in os.walk(p):
                    files += [os.path.join(root, n) for n in names
                              if n.lower().endswith(".dwg")]
            else:
                files += [os.path.join(p, n) for n in sorted(os.listdir(p))
                          if n.lower().endswith(".dwg")]
        elif p.lower().endswith(".dwg"):
            files.append(p)
    seen, out = set(), []
    for f in files:
        k = os.path.normcase(os.path.abspath(f))
        if k not in seen and not os.path.basename(f).startswith("~"):
            seen.add(k)
            out.append(f)
    return out


def list_devices(acad) -> None:
    doc = acad.ActiveDocument
    lay = get_model_layout(doc)
    print("\n--- Plot cihazlari ---")
    try:
        for n in lay.GetPlotDeviceNames():
            print("  ", n)
    except Exception as e:
        print("   okunamadi:", e)
    print(f"\n--- '{lay.ConfigName}' icin kagitlar ---")
    for name, w, h, fb in media_table(lay):
        print(f"   {w:8.2f} x {h:8.2f} mm {'[full bleed]' if fb else '            '}  {name}")
    print("\n--- Plot stilleri (ctb/stb) ---")
    try:
        for n in lay.GetPlotStyleTableNames():
            print("  ", n)
    except Exception as e:
        print("   okunamadi:", e)


def main() -> int:
    ap = argparse.ArgumentParser(
        description="DWG icindeki paftalari tek tek PDF'e basar, "
                    "malzeme listelerini Excel/JSON'a cikarir.")
    ap.add_argument("girdi", nargs="*", help="DWG dosyalari ve/veya klasorler")
    ap.add_argument("--out", default="", help="cikti klasoru (varsayilan: DWG yaninda 'PDF')")
    ap.add_argument("--paper", default="A3", help="A0/A1/A2/A3/A4 veya AUTO (varsayilan A3)")
    ap.add_argument("--device", default="DWG To PDF.pc3", help="plotter (pc3) adi")
    ap.add_argument("--ctb", default="monochrome.ctb",
                    help="plot stili. Varsayilan monochrome.ctb (PDF'ler "
                         "siyah-beyaz ve tutarli cikar). Cizimin kendi "
                         "ayarini kullanmak icin: --ctb -")
    ap.add_argument("--alt-klasor", action="store_true", help="alt klasorleri de tara")
    ap.add_argument("--dry-run", action="store_true", help="PDF basma, sadece raporla")
    ap.add_argument("--sadece-liste", action="store_true",
                    help="PDF basma, sadece malzeme listesi + rapor uret")
    ap.add_argument("--gizli", action="store_true", help="AutoCAD penceresini gosterme")
    ap.add_argument("--liste-cihazlar", action="store_true",
                    help="plotter/kagit/ctb isimlerini listeler ve cikar")
    ap.add_argument("--kopya", default="oto",
                    choices=("oto", "alt", "ust", "hepsi", "dur"),
                    help="cizimde eski revizyon da duruyorsa hangi kopya "
                         "basilsin: oto = iptal caprazi > REV etiketi > konum "
                         "(varsayilan), alt / ust = sadece konuma bak, "
                         "hepsi = hepsini bas, dur = o cizimi hic isleme")
    ap.add_argument("--birlesik-yok", action="store_true",
                    help="paftalari tek dosyada birlestirme (varsayilan: birlestir)")
    ap.add_argument("--tani", action="store_true",
                    help="cerceve/antet tespitinin ayrintili dokumunu verir "
                         "ve cikti klasorune tani_*.txt yazar")
    ap.add_argument("--rapor-adi", default="malzeme_listesi",
                    help="Excel/JSON dosya adi govdesi")
    ap.add_argument("--sonuc", default="",
                    help="Tum calismayi tek bir makine-okunur JSON dosyasina "
                         "yazar (yardimci program / entegrasyon icin)")
    a = ap.parse_args()

    paper = None if a.paper.upper() == "AUTO" else a.paper.upper()
    do_plot = not (a.dry_run or a.sadece_liste)

    acad = connect_autocad(visible=not a.gizli)
    if a.liste_cihazlar:
        list_devices(acad)
        return 0

    dwgs = gather_dwgs(a.girdi, a.alt_klasor)
    if not dwgs:
        ap.error("Islenecek DWG bulunamadi.")

    if do_plot:
        try:
            a.device = sessiz_pdf_plotter(acad, a.device)
        except (OSError, ValueError) as e:
            ap.error(f"PDF otomatik acilmasi kapatilamadi: {e}")

    all_sheets: list[dict] = []
    all_rows: list[dict] = []
    media_cache: dict = {}
    run_used: set[str] = set()
    sonuc_tanilar: list[dict] = []
    n_pdf = n_err = 0

    for path in dwgs:
        stem = os.path.splitext(os.path.basename(path))[0]
        # Her cizim kendi klasorune:  <dwg adi>_PDF
        # Boylece toplu islemede dosyalar birbirine karismaz.
        ust_klasor = a.out or os.path.dirname(os.path.abspath(path))
        outdir = os.path.join(ust_klasor, f"{safe_filename(stem)}_PDF")
        print(f"\n=== {os.path.basename(path)}")
        doc = None
        opened_by_us = False
        try:
            wait_ready(acad)
            doc, opened_by_us = open_document(acad, path, read_only=True)
            print("   Cizim acildi; baski gorunumu hazirlaniyor...", flush=True)
            target = prepare_document(doc)
            print("   Metinler, cerceveler ve malzeme tablolari okunuyor...", flush=True)
            texts, boxes, tables, attrs = com_call(collect, doc, tries=3, delay=2.0)
            print(f"   {len(texts)} metin, {len(boxes)} cerceve adayi, "
                  f"{len(tables)} tablo okundu; paftalar bulunuyor...", flush=True)
            info: dict = {}
            sheets = build_sheets(texts, boxes, tables, forced_paper=paper,
                                  attributes=attrs, info=info)
            if not sheets:
                print("   ! Antet bulunamadi (\"Resim No\" etiketli cerceve yok).")
            # Ayni cizim icinde tekrar eden paftalar (kopyalanmis set)
            atlanan: list = []
            if a.kopya != "hepsi" and sheets:
                # Revizyon isaretlerini topla: iptal caprazi + REV etiketi
                try:
                    iptaller = iptal_bolgeleri_bul(doc, sheets, boxes)
                    if iptaller:
                        iptal_isaretle(sheets, iptaller)
                        n_ip = sum(1 for s in sheets if s.iptal)
                        print(f"   i {len(iptaller)} bolgede iptal caprazi bulundu "
                              f"-> {n_ip} pafta iptal edilmis sayildi.")
                    else:
                        print(f"   i Iptal caprazi bulunamadi "
                              f"({len(sheet_clusters(sheets))} pafta obegi tarandi).")
                except Exception as e:
                    print(f"   ! iptal caprazi aranamadi: {e}")
                rev_etiketlerini_ata(sheets, texts)
                revler = sorted({s.rev_etiketi for s in sheets if s.rev_etiketi})
                if revler:
                    print(f"   i Revizyon etiketleri: {', '.join(revler)}")

                kalan, atlanan = dedupe_sheets(sheets, keep=a.kopya)
                if atlanan:
                    gerekceler = collections.Counter(
                        s.secim_gerekcesi for s in kalan if s.secim_gerekcesi)
                    print("")
                    print("   " + "=" * 62)
                    print("   ! BU CIZIMDE ESKI REVIZYON DA DURUYOR")
                    print(f"     BASILAN : {len(kalan)} pafta")
                    print(f"     ATLANAN : {len(atlanan)} pafta")
                    for gk, n in gerekceler.most_common():
                        print(f"     Secim gerekcesi ({n} pafta): {gk}")
                    print("     Yanlissa:  --kopya ust  |  --kopya alt  |  --kopya hepsi")
                    print("   " + "=" * 62)
                    if a.kopya == "dur":
                        raise RuntimeError(
                            f"Cizimde {len(atlanan)} tekrar eden pafta var; "
                            f"--kopya dur secildigi icin islenmedi.")
                    sheets = kalan

            names = output_names(sheets, stem)
            # Ayni resim no birden fazla CIZIMDE gecebiliyor (ortak detay
            # paftalari). Ayni klasore yazilirken birbirini ezmesin.
            uniq: list[str] = []
            for nm in names:
                key = os.path.normcase(os.path.join(outdir, nm))
                if key in run_used:
                    base, ext = os.path.splitext(nm)
                    k = 2
                    while os.path.normcase(
                            os.path.join(outdir, f"{base}_{k}{ext}")) in run_used:
                        k += 1
                    nm = f"{base}_{k}{ext}"
                    print(f"   ! '{base}' baska bir cizimde de var; "
                          f"{nm} olarak kaydedildi.")
                run_used.add(os.path.normcase(os.path.join(outdir, nm)))
                uniq.append(nm)
            names = uniq
            layout = get_model_layout(doc)

            basilanlar: list[tuple[str, str]] = []
            for sh, nm in zip(sheets, names):
                out_pdf = os.path.join(outdir, nm)
                durum = "atlandi"
                note = ""
                if do_plot:
                    ok, note = configure_and_plot(doc, layout, sh, out_pdf,
                                                  a.device, a.ctb, target,
                                                  media_cache)
                    durum = "OK" if ok else "HATA"
                    n_pdf += int(ok)
                    n_err += int(not ok)
                    if ok:
                        basilanlar.append(
                            (sh.drawing_no or os.path.splitext(nm)[0], out_pdf))
                if note:
                    sh.warnings.append(note)
                print(f"   {sh.index:2d}. {sh.drawing_no or '(resim no yok)':22s} "
                      f"{sh.paper} {sh.scale_label:8s} malzeme {len(sh.bom):3d}  "
                      f"{durum:8s} {nm}")
                for w in sh.warnings:
                    print(f"        ! {w}")
                all_sheets.append(pafta_report.sheet_dict(sh, stem, nm, durum))
                for r in sh.bom:
                    row = {"dosya": stem, "pafta": sh.drawing_no}
                    row.update(r)
                    all_rows.append(row)

            # Birlesik PDF: paftalar resim numarasina gore sirali, tek dosya.
            # Ciktiyi toptan basmak icin bu dosya kullanilir.
            if basilanlar and not a.birlesik_yok:
                hedef = os.path.join(outdir, f"{safe_filename(stem)}_BIRLESIK.pdf")
                ok, mesaj = birlesik_pdf(basilanlar, hedef)
                if ok:
                    print(f"   + Birlesik PDF: {os.path.basename(hedef)} ({mesaj})")
                else:
                    print(f"   ! Birlesik PDF uretilemedi: {mesaj}")

            # Atlanan kopyalar rapora yine de girsin - hicbir sey gizlenmesin
            for sh in atlanan:
                all_sheets.append(
                    pafta_report.sheet_dict(sh, stem, "", "tekrar-atlandi"))

            # --- TANI: her zaman uretilir -------------------------------
            # Ham dokum (insan icin) + yapisal JSON (birikip AI ile
            # incelenecek olan). Konsola sadece --tani verilirse basilir.
            tani_txt = os.path.join(outdir, f"tani_{stem}.txt")
            if a.tani or not sheets:
                diagnose(texts, boxes, tables, sheets, os.path.basename(path),
                         tani_txt, attrs, info)
            else:
                import io
                import contextlib
                with contextlib.redirect_stdout(io.StringIO()):
                    diagnose(texts, boxes, tables, sheets,
                             os.path.basename(path), tani_txt, attrs, info)
            tani = pafta_tani.tani_json(path, sheets, info, texts, boxes,
                                        tables, attrs, atlanan,
                                        ek={"ham_dokum": os.path.basename(tani_txt)})
            pafta_tani.yaz(os.path.join(outdir, f"tani_{stem}.json"), tani)
            sonuc_tanilar.append(tani)
        except Exception:
            n_err += 1
            print("   ! HATA:\n" + traceback.format_exc())
        finally:
            if doc is not None and opened_by_us:
                try:
                    doc.Close(False)
                except Exception:
                    pass

    # Rapor konumu: tek cizim islendiyse onun kendi klasorune, birden
    # fazla cizim islendiyse hepsinin ustundeki ortak klasore.
    ilk_ust = a.out or os.path.dirname(os.path.abspath(dwgs[0]))
    if len(dwgs) == 1:
        outdir = os.path.join(
            ilk_ust, f"{safe_filename(os.path.splitext(os.path.basename(dwgs[0]))[0])}_PDF")
    else:
        outdir = ilk_ust
    try:
        os.makedirs(outdir, exist_ok=True)
    except Exception as e:
        print(f"   ! Cikti klasoru olusturulamadi ({outdir}): {e}")
        outdir = os.path.dirname(os.path.abspath(dwgs[0]))

    write_safe(pafta_report.write_json,
               os.path.join(outdir, a.rapor_adi + ".json"), all_sheets)
    write_safe(pafta_report.write_xlsx,
               os.path.join(outdir, a.rapor_adi + ".xlsx"), all_sheets, all_rows)
    write_safe(pafta_report.write_csv,
               os.path.join(outdir, "pafta_raporu.csv"), all_sheets)

    print(f"\nToplam {len(all_sheets)} pafta, {len(all_rows)} malzeme satiri. "
          f"PDF: {n_pdf} basarili, {n_err} hata.")

    # ---- Kontrol ozeti: CAD'de duzeltilmesi gereken paftalar -------------
    def sapma(s) -> float:
        try:
            return float(s.get("olcek_sapma") or 0.0)
        except (TypeError, ValueError):
            return 0.0

    antet_hatasi = [s for s in all_sheets
                    if sapma(s) > 1.0 and s.get("olcek_std") == "EVET"]
    cerceve_hatasi = [s for s in all_sheets
                      if sapma(s) > 1.0 and s.get("olcek_std") == "HAYIR"]
    serbest = [s for s in all_sheets
               if sapma(s) <= 1.0 and s.get("olcek_std") == "HAYIR"]
    resim_no_yok = [s for s in all_sheets if not str(s.get("resim_no", "")).strip()]
    if antet_hatasi or cerceve_hatasi or serbest or resim_no_yok:
        print("\n" + "-" * 70)
        print("KONTROL OZETI")
        print("-" * 70)
        print("Not: PDF'ler her durumda tam kagit olcusunde ve cerceve eksiksiz")
        print("basilir. Asagidakiler cizimin kendisiyle ilgili notlardir.")
        if cerceve_hatasi:
            print(f"\n  [1] CERCEVE ELLE OLCEKLENMIS - basilan olcek nominalden sapiyor "
                  f"({len(cerceve_hatasi)} pafta)")
            for s in sorted(cerceve_hatasi, key=sapma, reverse=True):
                print(f"      %{sapma(s):5.1f}  {s['resim_no'] or '(no yok)':22.22s} "
                      f"antet {s['olcek_antet'] or '-':8.8s} -> gercek {s['olcek']}")
        if antet_hatasi:
            print(f"\n  [2] ANTETTEKI OLCEK YAZISI YANLIS ({len(antet_hatasi)} pafta)")
            print("      Cerceve standart olcude; sadece yazi duzeltilecek.")
            for s in antet_hatasi:
                print(f"      {s['resim_no'] or '(no yok)':22.22s} "
                      f"antette {s['olcek_antet']} -> olmasi gereken {s['olcek']}")
        if serbest:
            print(f"\n  [3] CERCEVE STANDART OLCEGE OTURMUYOR ama antetle uyumlu "
                  f"({len(serbest)} pafta) - bilgi amacli")
        if resim_no_yok:
            print(f"\n  [4] RESIM NO OKUNAMADI ({len(resim_no_yok)} pafta)")
            for s in resim_no_yok:
                print(f"      {s['dosya']} | sira {s['sira']} | {s['pdf']}")
        print("-" * 70)

    # --- Makine-okunur tek dosya cikti (yardimci program icin) ------------
    # SOZLESME: bu JSON'un sekli sabittir; entegrasyonu yazan taraf buna
    # gore okur. Alan eklemek serbest, alan silmek/yeniden adlandirmak
    # kirici degisikliktir.
    if a.sonuc:
        sonuc = {
            "arac_surum": pafta_tani.ARAC_SURUM,
            "cikti_klasoru": outdir,
            "ozet": {
                "cizim": len(dwgs),
                "pafta": len(all_sheets),
                "malzeme_satiri": len(all_rows),
                "pdf_basarili": n_pdf,
                "hata": n_err,
            },
            "paftalar": all_sheets,
            "malzeme": all_rows,
            "tanilar": sonuc_tanilar,
        }
        try:
            os.makedirs(os.path.dirname(os.path.abspath(a.sonuc)) or ".",
                        exist_ok=True)
            with open(a.sonuc, "w", encoding="utf-8") as f:
                json.dump(sonuc, f, ensure_ascii=False, indent=1)
            print("Sonuc JSON:", a.sonuc)
        except Exception as e:
            print(f"   ! Sonuc JSON yazilamadi: {e}")

    print("Cikti:", outdir)
    return 1 if n_err else 0


if __name__ == "__main__":
    raise SystemExit(main())
