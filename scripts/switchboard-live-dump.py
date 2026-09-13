"""Pano yerleşiminin CANLI girdisini salt okunur döker — tek iş, tek klasör.

    python scripts/switchboard-live-dump.py 0026-01 [--out .tmp/pano]

Çıktı: `.tmp/pano/<is>/parts.json · models.json · panels.json · placements.json
· settings.json · approval.json`. Biçim ham SQL satırıdır (snake_case) — uygulama
bu satırları okurken temizler (`switchboard-parts-dump.ts`), döküm temizlemez.

NEDEN: ekranda görünen yerleşim yalnız malzeme listesinden değil, kullanıcının
KARARLARINDAN da çıkar (kilit, sabitleme, ayar). Kararsız döküm 0026'da 1600 mm
iki göz veriyordu; canlıda kullanıcı 2313 mm taşan tek göz görüyordu. Fark
kararlardı ve bu betik olmadan yerelde yeniden üretilemiyordu (Plan F0).

Şirket verisi repoya girmez: `.tmp/` gitignore'ludur. Betik hiçbir şey YAZMAZ.
Bağlantı `cad-db-check.py` ile aynı yoldan: `supabase/.temp/pooler-url` +
`.env.frankfurt` içindeki `SUPABASE_DB_PASSWORD`.
"""
import json
import sys
from decimal import Decimal
from pathlib import Path
from urllib.parse import unquote, urlparse

import psycopg


def env_oku() -> dict:
    env = {}
    for name in (".env.local", ".env.frankfurt"):
        p = Path(name)
        if not p.exists():
            continue
        for line in p.read_text(encoding="utf-8-sig").splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def baglan():
    env = env_oku()
    parsed = urlparse(Path("supabase/.temp/pooler-url").read_text().strip())
    return psycopg.connect(
        user=unquote(parsed.username),
        password=env["SUPABASE_DB_PASSWORD"],
        host=parsed.hostname,
        port=parsed.port or 5432,
        dbname="postgres",
        sslmode="require",
        connect_timeout=60,
    )


def duz(v):
    # JSON'a giden değerler: Decimal → str (uygulama `Number()` ile okur),
    # UUID/tarih → str. NULL NULL kalır (değişmez md. 4).
    if isinstance(v, Decimal):
        return str(v)
    if v is None or isinstance(v, (str, int, float, bool, list, dict)):
        return v
    return str(v)


def satirlar(cur, sql, args):
    cur.execute(sql, args)
    adlar = [d.name for d in cur.description]
    return [{a: duz(x) for a, x in zip(adlar, row)} for row in cur.fetchall()]


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit("Kullanım: python scripts/switchboard-live-dump.py <is-no> [--out .tmp/pano]")
    is_no = sys.argv[1]
    out_kok = Path(sys.argv[sys.argv.index("--out") + 1]) if "--out" in sys.argv else Path(".tmp/pano")
    hedef = out_kok / is_no
    hedef.mkdir(parents=True, exist_ok=True)

    db = baglan()
    cur = db.cursor()
    cur.execute("select id, doc_no from projects where doc_no = %s", (is_no,))
    proje = cur.fetchone()
    if not proje:
        raise SystemExit(f"Proje bulunamadı: {is_no}")
    pid = proje[0]

    # GÜNCEL elektrik projesi — `is_current`; "en son yüklenen" varsayılmaz.
    cur.execute(
        "select id from electrical_projects where project_id = %s and is_current = true order by created_at desc limit 1",
        (pid,),
    )
    belge = cur.fetchone()
    parts = []
    if belge:
        parts = satirlar(
            cur,
            "select %s as doc_no, device_tag, installation, location, device, qty, designation, type_no, supplier, part_no, page, sort "
            "from electrical_parts where electrical_project_id = %s order by sort",
            (is_no, belge[0]),
        )

    dokum = {
        "parts.json": parts,
        "models.json": satirlar(cur, "select * from electrical_device_models order by lookup_key", ()),
        "panels.json": satirlar(cur, "select * from switchboard_panels where project_id = %s order by code", (pid,)),
        "placements.json": satirlar(
            cur, "select * from switchboard_placements where project_id = %s order by device_key", (pid,)
        ),
        "settings.json": satirlar(cur, "select settings from switchboard_settings where project_id = %s", (pid,)),
        "approval.json": satirlar(
            cur, "select input_fingerprint, settings, approved_at from switchboard_approvals where project_id = %s", (pid,)
        ),
    }
    for ad, veri in dokum.items():
        (hedef / ad).write_text(json.dumps(veri, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"{ad:16} {len(veri):5} satır")
    print(f"Yazıldı: {hedef}")


if __name__ == "__main__":
    main()
