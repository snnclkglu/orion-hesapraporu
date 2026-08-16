// BÜYÜK FORM PENCERELERİ TELEFONDA TAM BOYDUR (kullanıcı kararı, 16.08.2026:
// "mobilde uygulama gibi davransın").
//
// Taban `DialogContent` telefonda zaten alt tabakadır (85dvh) ve KÜÇÜK onay
// pencereleri için doğru boy odur — silme/iptal onayı bir bakışta okunur ve
// arkadaki bağlam görünür kalır. Sipariş Aç gibi ÇOK ALANLI formlar ise o
// tabakada sıkışıyordu: form kendi içinde kayıyor, Kaydet klavyenin altında
// kalıyordu. Bu sabit yalnız BÜYÜK formlara verilir; taban bileşen DEĞİŞMEZ
// (bölüm kapsamı — diğer bölümlerin pencereleri bu karardan etkilenmemeli).
//
// TEK YERDE durur: sekiz pencere aynı dizgiyi kendisi yazsaydı biri er geç
// farklı bir yükseklik taşırdı.
export const TAM_BOY_PENCERE =
  "max-sm:top-0 max-sm:h-dvh max-sm:max-h-dvh max-sm:rounded-none";
