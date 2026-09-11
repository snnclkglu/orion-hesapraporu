from __future__ import annotations

import json
import re
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "tmp" / "legacy-offers.json"
OUTPUT = ROOT / "supabase" / "migrations" / "20260911000001_historical_erdemir_isdemir_offers.sql"
NS = uuid.UUID("5f2e8dd4-604b-4e64-9f07-93e990e48815")


def uid(key: str) -> str:
    return str(uuid.uuid5(NS, key))


def load():
    return json.loads(SOURCE.read_text(encoding="utf-8"))


def by_name(data, name):
    return next(f for f in data if Path(f["path"]).name == name)


def sheet(file, title):
    return next(s for s in file["sheets"] if s["title"] == title)


def cells_by_row(sh):
    out = {}
    for row in sh["rows"]:
        vals = {}
        for cell in row:
            coord = cell["cell"]
            col = re.match(r"[A-Z]+", coord).group(0)
            val = cell["value"] if cell["value"] is not None else cell["raw"]
            vals[col] = val
        row_no = int(re.search(r"\d+", row[0]["cell"]).group(0))
        out[row_no] = vals
    return out


def line(key, description, qty, unit, unit_price, *, in_total=True, optional=False, item_id=None):
    return {
        "id": uid(key), "itemId": item_id, "parentLineId": None,
        "description": str(description).strip(), "qty": qty, "unit": str(unit or "").strip(),
        "unitPrice": unit_price, "discountPercent": None, "inTotal": in_total,
        "optional": optional, "hidden": False, "manualCost": None, "leadTime": "",
    }


def offer_lines(data, cfg, item_id):
    file = by_name(data, cfg["price_file"])
    if cfg["price_file"].lower().endswith(".pdf"):
        amounts = [392000, 151000, 75000, 14000, 54000]
        labels = [
            "ELEKTRİK ODASI ve RIO - TÜM GÜÇ/KONTROL PANELLERİ TEMİNİ",
            "ELEKTRİK ODASI KLİMA ÜNİTELERİ TEMİNİ",
            "SABİT VE HAREKETLİ TÜM KABLO TESİSATLARI TEMİNİ",
            "PROJE ÇİZİMLERİ ve YAZILIM", "DEMONTAJ, MONTAJ ve DEVREYE ALMA",
        ]
        return [line(f"{cfg['key']}-price-{i}", label, 1, "Komple", amount, item_id=item_id)
                for i, (label, amount) in enumerate(zip(labels, amounts), 1)]
    rows = cells_by_row(sheet(file, cfg["price_sheet"]))
    result = []
    if cfg["key"] == "cc16-17":
        for r in range(4, 19):
            result.append(line(f"cc-price-{r}", rows[r]["B"], rows[r].get("G"), "Set", rows[r].get("J"), item_id=item_id))
    elif cfg["key"] == "sd14":
        for r in range(5, 10):
            result.append(line(f"sd14-price-{r}", rows[r]["B"], rows[r].get("C"), rows[r].get("D"), rows[r].get("E"), item_id=item_id))
    elif cfg["key"] == "curuf-130-40":
        for r in range(3, 12):
            result.append(line(f"curuf-price-{r}", rows[r]["B"], rows[r].get("C"), rows[r].get("D"), rows[r].get("E"), item_id=item_id))
    elif cfg["key"] == "sd11":
        for r in range(3, 7):
            result.append(line(f"sd11-a1-{r}", f"ALTERNATİF-1 - {rows[r]['B']}", 1, "Set", rows[r].get("D"), item_id=item_id))
        for r in range(9, 13):
            result.append(line(f"sd11-a2-{r}", f"ALTERNATİF-2 - {rows[r]['B']}", 1, "Set", rows[r].get("D"), in_total=False, optional=True, item_id=item_id))
    return result


def cover_rows(cost_file, cfg):
    sh = sheet(cost_file, cfg.get("cover_sheet", "KAPAK & ÖZET"))
    rows = cells_by_row(sh)
    selected = []
    if cfg["key"] == "curuf-130-40":
        mapping = [(9, "Görev / Tip"), (10, "Sınıflandırma"), (11, "Köprü Açıklığı"),
                   (12, "Hızlar"), (13, "Kurulu Güç"), (14, "Toplam Ölü Ağırlık"), (15, "Besleme / Kontrol")]
        for r, label in mapping:
            values = [str(rows[r].get(c, "")).strip() for c in ("C", "G") if rows[r].get(c) not in (None, "")]
            selected.append((label, " · ".join(values)))
    else:
        for r in range(8, 20):
            label, value = rows.get(r, {}).get("B"), rows.get(r, {}).get("C")
            if label and value not in (None, ""):
                selected.append((label, str(value)))
    return [{"key": f"source-{i}", "label": label, "value": value, "parts": {},
             "manual": True, "hidden": False, "scope": "orion", "source": "manual"}
            for i, (label, value) in enumerate(selected, 1)]


def cost_payload(data, cfg, item_id):
    file = by_name(data, cfg["cost_file"])
    sh = sheet(file, cfg["detail_sheet"])
    rows = cells_by_row(sh)
    grouped = {}
    for r, vals in rows.items():
        sıra = vals.get("A")
        if not isinstance(sıra, (int, float)):
            continue
        label = vals.get("D")
        if not label:
            continue
        category = str(vals.get("C") or "DİĞER")
        is_option = cfg["key"] == "sd11" and r >= 18
        grouped.setdefault(category if not is_option else "OPSİYON-2 (TOPLAMA DAHİL DEĞİL)", []).append({
            "id": uid(f"{cfg['key']}-cost-line-{r}"), "key": f"aktarim-{cfg['key']}-{r}",
            "label": str(label), "qty": vals.get("G"), "qtyManual": True,
            "unit": str(vals.get("H") or ""), "unitPrice": vals.get("I"), "priceManual": True,
            "note": " · ".join(str(x) for x in (vals.get("E"), vals.get("F"), vals.get("M") or vals.get("N")) if x not in (None, "")),
            "hidden": is_option,
        })
    groups = []
    for i, (title, lines) in enumerate(grouped.items(), 1):
        groups.append({"id": uid(f"{cfg['key']}-cost-group-{i}"), "key": f"aktarim-{cfg['key']}-{i}",
                       "title": title, "lump": False, "lines": lines})
    return {
        "version": 6, "sourceRevNo": 0, "currency": "EUR", "params": {}, "materialPrices": {},
        "items": [{"id": uid(f"{cfg['key']}-cost-item"), "offerItemId": item_id,
                   "title": cfg["subject"], "craneType": cfg["crane_type"], "qty": 1,
                   "inputs": {}, "overrides": {}, "groups": groups}],
        "removedOfferItemIds": [], "manualLineWeights": {}, "manualLineCosts": {}, "overviewMargins": {},
        "general": {"id": uid(f"{cfg['key']}-general-cost"), "key": "general", "title": "PROJE GENELİ", "lump": False, "lines": []},
        "rates": [
            {"key": "fixed", "title": "GENEL GİDERLER", "mode": "oran", "percent": cfg["rates"][0], "lines": []},
            {"key": "consumable", "title": "RİSK / KONTENJANS", "mode": "oran", "percent": cfg["rates"][1], "lines": []},
            {"key": "finance", "title": "FİNANSMAN MALİYETLERİ", "mode": "oran", "percent": cfg["rates"][2], "lines": []},
        ],
        "notes": cfg["cost_note"], "direct": cfg["direct"], "total": cfg["cost_total"],
    }


def offer_payload(data, cfg, item_id):
    cost_file = by_name(data, cfg["cost_file"])
    item = {"id": item_id, "title": cfg["subject"], "craneType": cfg["crane_type"],
            "capacityT": cfg.get("capacity"), "spanM": cfg.get("span"), "hidden": False,
            "titleManual": True, "groups": [{"id": uid(f"{cfg['key']}-general"), "key": "general",
            "title": "PROJE VE KAPSAM BİLGİLERİ", "hidden": False, "rows": cover_rows(cost_file, cfg)}]}
    return {
        "version": 2,
        "issuer": {"customerId": None, "company": "ORION CRANES", "address": "Başkent OSB 1. Cadde No:20, 06909 Malıköy-Temelli-Sincan / Ankara", "taxOffice": "", "taxNo": "", "phone": "+90 544 774 01 01 · +90 312 511 48 06", "fax": "", "email": "info@orioncranes.com", "web": "www.orioncranes.com"},
        "cover": {"fromName": "ORION CRANES", "fromTitle": "Vinç Sistemleri", "fromEmail": "info@orioncranes.com", "toName": "", "toDept": "", "toPhone": "", "toEmail": "", "customerRef": cfg["customer_ref"], "greeting": "", "intro": "", "signatories": [], "hidden": False},
        "items": [item], "testLoad": {"enabled": False, "title": "TEST YÜKLERİ", "position": "ticari", "rows": []},
        "terms": {"title": "TESLİM VE ÖDEME ŞEKLİ", "rows": [], "paymentLines": []},
        "pricing": {"currency": "EUR", "vatIncluded": False, "leadTimeUnit": None,
                    "lines": offer_lines(data, cfg, item_id), "discountTotal": None, "total": cfg["offer_total"]},
        "notes": [{"id": uid(f"{cfg['key']}-note"), "text": cfg["offer_note"], "hidden": False}],
        "exclusions": [], "generalTerms": [], "hiddenSections": [],
    }


CONFIGS = [
    dict(key="sd14", customer="ERDEMİR", date="2026-05-15", subject="SD-14 VİNCİ (50 MT KAPASİTELİ) MODERNİZASYON İŞİ", crane_type="Vinç Modernizasyonu", qty=1, capacity=50, span=None, customer_ref="ERD-0005-CSC1-02-TSP-H-00001 Rev.0", price_file="A.3_Götürü_Bedel_Teklif_Formu - İndirimli.xlsx", price_sheet="GÖTÜRÜ BEDEL DETAY TABLOSU", cost_file="Maliyet Tablosu - SD-14 Vinci Modernizasyonu.xlsx", detail_sheet="Maliyet Detay", offer_total=260000, direct=154000, cost_total=169400, rates=(5,3,2), offer_note="Kaynak: A.3 Götürü Bedel Teklif Formu - İndirimli.", cost_note="Kaynak maliyet tablosundaki 26 ayrıntı satırı ve özet oranları aktarılmıştır."),
    dict(key="sd11", customer="İSDEMİR", date="2026-06-03", subject="SD-11 NOLU VİNCİN SÜRÜCÜ VE OTOMASYON SİSTEMLERİNİN YENİLENMESİ", crane_type="Vinç Modernizasyonu", qty=1, capacity=60, span=None, customer_ref="ISD-0005-HSM1-90-TSP-H-00001 Rev.0", price_file="Detaylı Fiyatlandırma Formu - Orion Vinç -r2.xlsx", price_sheet="Sayfa1", cost_file="Maliyet Tablosu - SD-11 Vinci Sürücü ve Otomasyon Yenileme.xlsx", detail_sheet="Maliyet Detay", offer_total=258000, direct=118250, cost_total=137170, rates=(5,3,8), offer_note="Alternatif-1 toplamı esas tekliftir. Alternatif-2 satırları seçenek olarak ve ana toplam dışında saklanmıştır.", cost_note="Ana kapsam maliyeti aktarılmıştır. Opsiyon-2 maliyet satırları veri kaybı olmaması için gizli/toplam dışı saklanmıştır."),
    dict(key="ct1", customer="İSDEMİR", date="2026-06-02", subject="CT-1 150/35 MT VİNCİ MODERNİZASYONU", crane_type="Vinç Modernizasyonu", qty=1, capacity=150, span=None, customer_ref="ISD-0005-SMN1-90-TSP-H-00004 Rev.0", price_file="A.3_Detaylı fiyatlandırma formu İNDİRİMLİ.pdf", price_sheet="", cost_file="Maliyet Tablosu - CT-1 Vinci Modernizasyonu - SON.xlsx", detail_sheet="Maliyet Detay", offer_total=686000, direct=440500, cost_total=484550, rates=(5,1,4), offer_note="Kaynak: A.3 Detaylı fiyatlandırma formu İNDİRİMLİ.pdf.", cost_note="Kaynak maliyet tablosundaki ayrıntı satırları ve özet oranları aktarılmıştır."),
    dict(key="curuf-130-40", customer="ERDEMİR", date="2026-07-31", subject="130/40 MT CÜRUF POTASI TUMBA VİNCİ TEMİNİ", crane_type="Cüruf Potası Tumba Vinci", qty=1, capacity=130, span=18.288, customer_ref="ERD-0005-TRN1-90-TSP-H-00001", price_file="Ek-6 Fiyatlandırma Formu.XLSX", price_sheet="Teklif Formu", cost_file="ERDEMİR 130-40 MT Cüruf Potası Tumba Vinci - Teklif Maliyet Çalışması V6.xlsx", detail_sheet="MALİYET DETAYI", offer_total=2320000, direct=1554345, cost_total=1849670.55, rates=(15,1,3), offer_note="Kaynak: Ek-6 Fiyatlandırma Formu. Toplam götürü bedel 2.320.000 EUR.", cost_note="Kaynak: Teklif Maliyet Çalışması V6. 85 ayrıntı satırı, 1.554.345 EUR direkt maliyet ve ticari oranlar aktarılmıştır."),
    dict(key="cc16-17", customer="ERDEMİR", date="2026-08-29", subject="CC16 VE CC17 50/10 MT VİNÇLERİ MODERNİZASYONU", crane_type="Vinç Modernizasyonu", qty=2, capacity=50, span=None, customer_ref="ERD-0005-CSC1-03-TSP-H-00001 Rev.0", price_file="Ek-7 Detaylı Fiyatlandırma Tablosu.xlsx", price_sheet="Sayfa1", cost_file="Maliyet Tablosu - ERDEMİR CC16-CC17 Vinçleri Modernizasyonu - Rev1.xlsx", detail_sheet="Maliyet Detay", offer_total=770000, direct=560900, cost_total=611381, rates=(5,2,2), offer_note="Kaynak: Ek-7 Detaylı Fiyatlandırma Tablosu. Bedeller iki vinç toplamıdır.", cost_note="Kaynak: Maliyet Tablosu Rev1. Ayrıntılar iki vinç toplamıdır; ayrıca adet çarpanı uygulanmamıştır."),
]


def sql_json(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def main():
    data = load()
    blocks = ["-- Kullanıcının sağladığı 2026 tarihli ERDEMİR/İSDEMİR geçmiş teklif ve maliyet kayıtları.\n-- Kaynak belgeler ayrıntılı okunmuş; teklif ile iç maliyet ayrı snapshot zincirlerine aktarılmıştır.\n"]
    for cfg in CONFIGS:
        item_id = uid(f"{cfg['key']}-offer-item")
        offer_obj = offer_payload(data, cfg, item_id)
        cost_obj = cost_payload(data, cfg, item_id)
        offer_sum = sum((x["qty"] or 0) * (x["unitPrice"] or 0) for x in offer_obj["pricing"]["lines"] if x["inTotal"] and not x["hidden"])
        direct_sum = sum((x["qty"] or 0) * (x["unitPrice"] or 0) for g in cost_obj["items"][0]["groups"] for x in g["lines"] if not x["hidden"])
        assert abs(offer_sum - cfg["offer_total"]) < 0.01, (cfg["key"], "offer", offer_sum, cfg["offer_total"])
        assert abs(direct_sum - cfg["direct"]) < 0.01, (cfg["key"], "cost", direct_sum, cfg["direct"])
        assert abs(cfg["direct"] * (1 + sum(cfg["rates"]) / 100) - cfg["cost_total"]) < 0.01
        offer = sql_json(offer_obj)
        cost = sql_json(cost_obj)
        block = f"""
do $$
declare
  v_creator uuid;
  v_customer uuid;
  v_offer uuid;
  v_seq int;
  v_offer_no text;
begin
  select id into v_creator from public.profiles where email = 'scolakoglu@orioncranes.com' limit 1;
  if v_creator is null then
    select id into v_creator from public.profiles where role::text = 'admin' order by created_at limit 1;
  end if;
  if v_creator is null then raise exception 'Geçmiş teklif aktarımı için yönetici profili bulunamadı'; end if;

  select id into v_customer from public.customers
  where short_name ilike '%{cfg['customer']}%' or name ilike '%{cfg['customer']}%'
  order by (short_name ilike '%{cfg['customer']}%') desc, created_at limit 1;
  if v_customer is null then raise exception '{cfg['customer']} müşteri kaydı bulunamadı'; end if;

  select id into v_offer from public.offers
  where customer_id = v_customer and issue_date = date '{cfg['date']}' and subject = '{cfg['subject'].replace("'", "''")}'
  order by created_at limit 1;

  if v_offer is null then
    select coalesce(max(seq), 0) + 1 into v_seq from public.offers where lang = 'tr' and issue_date = date '{cfg['date']}';
    v_offer_no := 'TETR-' || to_char(date '{cfg['date']}', 'YYYYMMDD') || '-' || v_seq::text;
    insert into public.offers (offer_no, lang, issue_date, seq, issued_on, customer_id, customer_name, subject, status, currency, created_by, created_at, updated_at)
    values (v_offer_no, 'tr', date '{cfg['date']}', v_seq, date '{cfg['date']}', v_customer, '{cfg['customer']}', '{cfg['subject'].replace("'", "''")}', 'sent', 'EUR', v_creator, timestamptz '{cfg['date']} 12:00:00+03', timestamptz '{cfg['date']} 12:00:00+03')
    returning id into v_offer;
  end if;

  insert into public.offer_revisions (offer_id, rev_no, label, status, payload, notes, created_by, created_at, updated_at, issued_at, issued_by)
  values (v_offer, 0, '', 'issued', $offer${offer}$offer$::jsonb, 'Kaynak belgeden geçmiş teklif aktarımı', v_creator, timestamptz '{cfg['date']} 12:00:00+03', timestamptz '{cfg['date']} 12:00:00+03', timestamptz '{cfg['date']} 12:00:00+03', v_creator)
  on conflict (offer_id, rev_no) do nothing;

  insert into public.offer_cost_revisions (offer_id, rev_no, label, status, payload, notes, created_by, created_at, updated_at, issued_at, issued_by)
  values (v_offer, 0, '', 'issued', $cost${cost}$cost$::jsonb, 'Kaynak belgeden geçmiş maliyet aktarımı', v_creator, timestamptz '{cfg['date']} 12:00:00+03', timestamptz '{cfg['date']} 12:00:00+03', timestamptz '{cfg['date']} 12:00:00+03', v_creator)
  on conflict (offer_id, rev_no) do nothing;
end
$$;
"""
        blocks.append(block)
    OUTPUT.write_text("\n".join(blocks), encoding="utf-8")
    print(OUTPUT)


if __name__ == "__main__":
    main()
