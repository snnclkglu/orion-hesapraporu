// Windows/Node 24'te tsx CLI'nin geçici klasör adını üretirken yaptığı
// `os.userInfo()` çağrısı bazı kurumsal profillerde ENOMEM dönebiliyor.
// CJS kayıt yolu aynı TypeScript betiğini yükler ve süreç argümanlarını korur.
/* eslint-disable @typescript-eslint/no-require-imports */
process.geteuid ??= () => 0;
require("tsx/cjs");
require("./import-electrical-catalogs.ts");
