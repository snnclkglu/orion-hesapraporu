"""Dağıtımdaki CTB dosyalarını üretir. Geliştirici bağımlılığı: ezdxf 1.4.4."""
from pathlib import Path
from ezdxf.addons import acadctb

def create_styles(root: Path):
    root.mkdir(parents=True, exist_ok=True)
    for weight in (0.25, 0.35, 0.50):
        table = acadctb.new_ctb()
        table.description = f"ORION Teknik: ACI 7={weight:.2f} mm; diger renkler=0.13 mm; siyah"
        for aci in range(1, 256):
            style = table[aci]
            style.color = (0, 0, 0)
            # CTB standart tablosu float32 saklar; eşitlik araması her renkte
            # yeni indeks ekleyerek AutoCAD'in desteklediği tabloyu aşabilir.
            requested = weight if aci == 7 else 0.13
            style.lineweight = min(range(len(table.lineweights)), key=lambda i: abs(table.lineweights[i] - requested))
            style.screen = 100
            style.dithering = False
        target = root / f"ORION_Teknik_{int(weight * 100):03d}.ctb"
        table.save(target)
        checked = acadctb.load(target)
        assert len(checked.lineweights) == 27
        assert abs(checked.get_lineweight(7) - weight) < 1e-6
        assert abs(checked.get_lineweight(1) - .13) < 1e-6
        print(target.name)

if __name__ == '__main__':
    create_styles(Path(__file__).parent/'plot-styles')
