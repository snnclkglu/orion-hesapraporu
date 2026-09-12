import { describe, expect, it } from "vitest";
import { activeRoute, highestPriority, routeMatches, shouldUseBottomLayout } from "./bottom-bar";

describe("alt bar seçimi", () => {
  it("telefon ve dokunmatik tableti kapsar, fareli masaüstünü korur", () => {
    expect(shouldUseBottomLayout("auto",390,false)).toBe(true);
    expect(shouldUseBottomLayout("auto",1024,true)).toBe(true);
    expect(shouldUseBottomLayout("auto",1366,true)).toBe(true);
    expect(shouldUseBottomLayout("auto",1024,false)).toBe(false);
    expect(shouldUseBottomLayout("auto",1440,true)).toBe(false);
    expect(shouldUseBottomLayout("bottom",1920,false)).toBe(true);
    expect(shouldUseBottomLayout("desktop",390,true)).toBe(false);
  });
  it("benzer adlı rotaları karıştırmaz; hammadde sorgusunu ayırır", () => {
    expect(routeMatches("/offers","/offers-old")).toBe(false);
    expect(routeMatches("/offers","/offers/123")).toBe(true);
    expect(routeMatches("/offers","/offers/123","",true)).toBe(false);
    expect(routeMatches("/purchasing/siparisler?tur=hammadde","/purchasing/siparisler","?tur=hammadde&durum=acik")).toBe(true);
    expect(routeMatches("/purchasing/siparisler?tur=hammadde","/purchasing/siparisler","?tur=ekipman")).toBe(false);
  });
  it("en özel rota ve en derin kayıt tek yüzeye sahip olur", () => {
    const options = [{href:"/offers"},{href:"/offers/hesap-raporlari"}];
    expect(activeRoute(options,"/offers/hesap-raporlari/123")?.href).toBe(options[1].href);
    const entries = [{id:"parent",priority:10},{id:"editor",priority:40},{id:"fallback",priority:0}];
    expect(highestPriority(entries)?.id).toBe("editor");
    expect(entries[0].id).toBe("parent");
    expect(highestPriority([])).toBeUndefined();
  });
});
