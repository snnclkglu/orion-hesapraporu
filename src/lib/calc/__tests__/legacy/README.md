# Tarihsel Doğrulama Fikstürü (legacy)

Bu klasör, uygulamanın ilk portunun çıkış noktası olan Excel hesap tablosuyla
karşılaştırma yapan **tarihsel bir doğrulama fikstürüdür**. Excel, bu sistemin
kaynağı değil yalnızca **başlangıç örneğiydi**; altyapı ve hesaplama yöntemi
ondan tamamen bağımsızdır.

> **Bu klasör bir ŞARTNAME DEĞİLDİR.**
> Buradaki hiçbir dosya, uygulamanın hesap yönteminin ne olması gerektiğini
> tanımlamaz. Yalnızca "ilk portta şu sayı çıkıyordu" bilgisini saklar.

## 1. Neden burada duruyor?

Uygulamanın hesap motoru artık kendi yöntemini kullanır ve bu yöntem doğrudan
standartlara dayanır:

- FEM 1.001 (kaldırma makineleri kuralları)
- DIN 15018 (çelik yapı, yorulma)
- DIN 15400 (kancalar)
- CMAA 70 (köprülü vinçler)

Motorun ürettiği değerler artık **semantik anahtarlarla** adreslenir
(`rope.load`, `drum.minDia`, `drumShaft.reactionGearbox`, `fatigue.combined` …).
Üretim kodunda hücre adresi, sayfa adı veya tablo yazılımına ait hiçbir iz
bulunmaz.

Buna rağmen ilk portta yapılan yüzlerce hücrelik sayısal karşılaştırma birikimi
değerlidir: bir hesap zincirinin farkında olmadan bozulduğunu yakalayan hızlı
bir regresyon ağıdır. Bu birikimi çöpe atmak yerine **yalnızca test katmanına**
taşıdık. Üretim kodu bu klasörü ne bilir ne de içe aktarır.

## 2. Öncelik kimde?

**Her zaman uygulamanın kendi yönteminde.**

Bir hücre uyuşmuyorsa bu, uygulamanın hatalı olduğu anlamına gelmez. İzlenecek
sıra şudur:

1. Uyuşmazlığı üreten büyüklük mühendislik açısından yeniden incelenir.
2. Uygulamanın sonucu standarda göre doğruysa **uygulama kazanır**; eski
   tablonun değeri "tarihsel sapma" olarak işaretlenir.
3. Sapma, gerekçesiyle birlikte belgelenir: hangi büyüklük, hangi standart
   maddesi, neden farklı, farkın büyüklüğü. Gerekçesiz sapma bırakılmaz.
4. Uygulamanın sonucu yanlışsa motor düzeltilir ve düzeltmeyi kalıcı kılan
   mühendislik testi yazılır.

Yani bu fikstür bir **uyarı zili**dir, bir hakem değildir.

## 3. Yeni hesap eklerken

**Eski tabloya BAKILMAZ.** Yeni bir hesap, kontrol veya modül eklenirken:

- Yöntem ilgili standart maddesinden türetilir.
- Doğrulama için **mühendislik testleri** yazılır: elle çözülmüş örnek,
  sınır durum (sıfır, negatif, çok büyük), birim tutarlılığı, monotonluk
  (yük artınca gerilme artmalı) ve standardın verdiği referans örnek.
- Bu klasöre yeni eşleme eklenmez. Fikstür yalnızca ilk portun kapsadığı
  tarihsel yüzey kadardır ve büyümez.

## 4. Dosyalar

| Dosya | İşlev |
| --- | --- |
| `excel-alias.ts` | Eski döküm hücre adresi → motorun semantik anahtarı eşlemesi ve çözücüleri. Şu an **iskelet**: haritalar anahtar göçü tamamlandıkça doldurulur. |

### `resolveLegacyCell`

Eski dökümdeki bir hücre adresini alır, o modülün eşleme tablosundan semantik
anahtarı bulur ve motorun ürettiği değeri döndürür. Eşleme yoksa `undefined`
döner — bu, "bu hücrenin motorda karşılığı tanımlanmamış" demektir ve
karşılaştırmadan sessizce düşer.

### `tickFromCheck`

Eski tabloda kontrol sonuçları, işaret yazı tipiyle basılmış tik/çarpı
hücreleriydi. Motorda böyle hücre **yoktur**: kontrol sonucu `Check.pass`
alanından türetilir. Bu yardımcı, eski dökümdeki tik hücresiyle
karşılaştırabilmek için `pass` değerini o gösterime çevirir. Bu dönüşüm
yalnızca test katmanında yaşar; üretim kodu tik karakteri üretmez.
