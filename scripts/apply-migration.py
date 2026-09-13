"""TEK migration dosyasını canlıya uygular ve damgalar — `db push` YERİNE.

    python scripts/apply-migration.py supabase/migrations/2026…_x.sql          # prova: begin → uygula → rollback
    python scripts/apply-migration.py supabase/migrations/2026…_x.sql --apply  # begin → uygula → damgala → commit

`supabase db push` KULLANILMAZ: bekleyen bütün migration'ları gönderir ve eş
zamanlı çalışan başka bir oturumun henüz istemediği dosyaları da uygular
(değişmez md. 9; `migration-uygulamasi-bende`). Bu betik yalnız verilen
dosyayı uygular ve `supabase_migrations.schema_migrations`e elle damgalar.

Zaten uygulanmış bir sürüm için: kaynak aynıysa "zaten uygulanmış" der ve
çıkar; farklıysa DURUR — uygulanmış bir migration'ı değiştirmek yerine yeni
dosya yazılır.

Bağlantı `cad-db-check.py` ile aynı yoldan: `supabase/.temp/pooler-url` +
`.env.frankfurt` içindeki `SUPABASE_DB_PASSWORD`.
"""
import sys
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


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit("Kullanım: python scripts/apply-migration.py <migration.sql> [--apply]")
    yol = Path(sys.argv[1])
    uygula = "--apply" in sys.argv
    kaynak = yol.read_text(encoding="utf-8-sig")
    version, name = yol.stem.split("_", 1)

    env = env_oku()
    parsed = urlparse(Path("supabase/.temp/pooler-url").read_text().strip())
    db = psycopg.connect(
        user=unquote(parsed.username),
        password=env["SUPABASE_DB_PASSWORD"],
        host=parsed.hostname,
        port=parsed.port or 5432,
        dbname="postgres",
        sslmode="require",
        connect_timeout=60,
        autocommit=False,
    )
    try:
        cur = db.cursor()
        cur.execute(
            "select statements from supabase_migrations.schema_migrations where version = %s", (version,)
        )
        mevcut = cur.fetchone()
        if mevcut:
            kayitli = "".join(mevcut[0] or [])
            if kayitli.strip() == kaynak.strip():
                print(f"Zaten uygulanmış: {yol.name}")
                return
            raise SystemExit(
                f"DURDU: {version} uygulanmış ama kaynağı FARKLI. Uygulanmış migration değiştirilmez; yeni dosya yaz."
            )
        cur.execute(kaynak)
        if uygula:
            cur.execute(
                "insert into supabase_migrations.schema_migrations(version, name, statements) values (%s, %s, %s)",
                (version, name, [kaynak]),
            )
            db.commit()
            print(f"Uygulandı ve damgalandı: {yol.name}")
        else:
            db.rollback()
            print(f"Prova geçti (geri alındı): {yol.name} — uygulamak için --apply")
    finally:
        db.close()


if __name__ == "__main__":
    main()
