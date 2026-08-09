// Tanıyıcı listesi — bu modülün "kural" yerine koyduğu şey.
//
// NEDEN TEK REGEX DEĞİL. İki gerçek teslim klasörü iki ayrı dilbilgisi
// kullanıyor:
//
//     0057-00-0500 - MONORAY (1 TON)      →  "kod - AD (KAPASİTE)"
//     0043-00-0000_MTC PASLANMAZ          →  "kod_AD"
//
// Birini regex'e yazıp diğerini "standart dışı" ilan etmek yanlış olurdu:
// ikisi de gerçek, ikisi de teslim edildi, ikisi de üretime indi. Üçüncü bir
// yazım da gelecek. Tek regex her yeni yazımda YA genişletilir (ve okunmaz
// hâle gelir) YA da paketi reddeder.
//
// Onun yerine sıralı bir liste: ilk tutan kazanır, hiçbiri tutmazsa sonuç
// `null` olur — ki bu bir HATA DEĞİL, yalnızca bilgi yokluğudur. Yeni bir
// yazım geldiğinde yapılacak iş listeye bir satır eklemektir ve eski paketler
// "Yeniden Eşleştir" ile kendiliğinden iyileşir.

export interface Recognizer<TIn, TOut> {
  /** Kararlı kimlik — `recognized_by` sütununa yazılır ve testte iddia edilir. */
  id: string;
  try(input: TIn): TOut | null;
}

export interface Recognized<T> {
  value: T | null;
  /** Tutan tanıyıcının kimliği; hiçbiri tutmadıysa "" */
  by: string;
}

/** İlk tutan kazanır. Fırlatan bir tanıyıcı, tutmamış sayılır. */
export function recognize<TIn, TOut>(
  list: readonly Recognizer<TIn, TOut>[],
  input: TIn
): Recognized<TOut> {
  for (const r of list) {
    let out: TOut | null = null;
    try {
      out = r.try(input);
    } catch {
      // Bir tanıyıcının kusuru bütün listeyi düşürmemeli: sıradaki denenir.
      // Yükleme hiçbir koşulda bir ayrıştırma hatasıyla durmaz.
      out = null;
    }
    if (out != null) return { value: out, by: r.id };
  }
  return { value: null, by: "" };
}
