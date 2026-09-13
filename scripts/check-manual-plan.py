"""PDF çizimiyle ortak sayfa planını karşılaştırır; eksik satır ve dış taşmayı reddeder."""
import json
import re
import sys
from pathlib import Path
import pdfplumber

pdf_path, plan_path = sys.argv[1:3]
plan = json.loads(Path(plan_path).read_text(encoding="utf-8"))
missing, overflow = [], []
with pdfplumber.open(pdf_path) as pdf:
    if len(pdf.pages) != len(plan["pages"]):
        raise SystemExit("PDF sayfa sayısı planla uyuşmuyor")
    for index, page in enumerate(pdf.pages):
        if abs(page.height - 841.89) > 0.1 or abs(page.width - 595.28) > 0.1:
            raise SystemExit(f"A4 ölçüsü bozuk: {index + 1}")
        text = re.sub(r"\s+", "", page.extract_text() or "")
        for item in plan["pages"][index]["items"]:
            if item["kind"] == "text" and re.sub(r"\s+", "", item["text"]) not in text:
                missing.append({"page": index + 1, "text": item["text"]})
        for char in page.chars:
            if char["x0"] < 25 or char["x1"] > 570 or char["top"] < 18 or char["bottom"] > 836:
                overflow.append({"page": index + 1, "char": char["text"]})
result = {"pages": len(plan["pages"]), "missing": missing, "overflow": overflow}
Path(pdf_path).with_suffix(".qa.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps({"pages": result["pages"], "missing": len(missing), "overflow": len(overflow)}))
raise SystemExit(1 if missing or overflow else 0)
