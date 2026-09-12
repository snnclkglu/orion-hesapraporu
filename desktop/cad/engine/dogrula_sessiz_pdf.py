"""Elle çalıştırılan, yeni ve kaydedilmeyen çizimde tek sayfalık baskı testi."""
from pathlib import Path
from types import SimpleNamespace
import zlib
import win32com.client
from pypdf import PdfReader
from pafta_plotter import sessiz_pdf_plotter, VIEW
from pafta_ayikla import prepare_document, get_model_layout, configure_and_plot, _pt3, com_call


def main():
    acad = win32com.client.GetActiveObject("AutoCAD.Application")
    active = acad.ActiveDocument
    device = sessiz_pdf_plotter(acad, "DWG To PDF.pc3")
    pc3 = Path(acad.Preferences.Files.PrinterConfigPath) / device
    assert VIEW.search(zlib.decompress(pc3.read_bytes()[60:])).group(2) == b"FALSE"
    doc = acad.Documents.Add()
    variables = {name: doc.GetVariable(name) for name in ("BACKGROUNDPLOT", "FILEDIA", "CMDDIA")}
    try:
        doc.ModelSpace.AddLine(_pt3(10, 10), _pt3(150, 100))
        doc.ModelSpace.AddText("ORION - SESSIZ PDF TESTI", _pt3(20, 140), 5)
        target = com_call(prepare_document, doc)
        sheet = SimpleNamespace(paper_w=420, paper_h=297, paper="A3", window_ll=(0, 0), window_ur=(420, 297), scale_n=1)
        output = Path(__file__).parent / "dogrulama_ciktilari" / "sessiz_pdf_test.pdf"
        layout = com_call(get_model_layout, doc)
        ok, detail = com_call(configure_and_plot, doc, layout, sheet, str(output.resolve()), device, "monochrome.ctb", target)
        assert ok, detail
        assert len(PdfReader(output).pages) == 1
        print("DOGRULANDI:", device, "View_New_File=FALSE; PDF 1 sayfa", flush=True)
    finally:
        for name, value in variables.items():
            com_call(doc.SetVariable, name, value)
        com_call(doc.Close, False)
        com_call(active.Activate)


if __name__ == "__main__":
    main()
