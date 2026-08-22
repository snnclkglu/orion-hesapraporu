// MÜŞTERİ İLETİŞİM KİŞİLERİ — defterin saf çekirdeği.
//
// NEDEN AYRI BİR DEFTER: `customers` satırı FİRMANIN künyesidir (unvan, vergi
// dairesi, santral telefonu); teklif kapağındaki "KİME" ise bir İNSANDIR ve bir
// firmada birden çok muhatap olur (satın alma müdürü, bakım şefi, proje
// mühendisi). Kişi firmanın kendi alanlarına sıkıştırılsaydı ikinci muhatap
// yazılacak yer bulamaz, kullanıcı da onu "Not" alanına düşerdi — orada
// aranamaz, teklif kapağına da geçirilemezdi.
//
// KİŞİ FOTOĞRAFLANIR, BAĞLANMAZ: teklif revizyonu kapak alanlarını kendi
// payload'ında METİN olarak dondurur (IS-14'ün müşteri fotoğrafı kuralı). Bu
// defter yalnız ÖNERİ kaynağıdır; kişi sonradan işten ayrılsa da teslim edilmiş
// teklifte adı olduğu gibi kalır.
//
// SAF ÇEKİRDEK (değişmez md. 7): DB/HTTP/React içe aktarılmaz.

export interface CustomerContact {
  id: string;
  customerId: string;
  /** AD SOYAD — BÜYÜK HARF saklanır (`adBuyuk`, değişmez md. 3). */
  name: string;
  /** Unvan bir CÜMLEDİR ("Satın Alma Müdürü") ve büyütülmez. */
  title: string;
  /** Teklif kapağındaki "Bölüm" satırı. */
  department: string;
  phone: string;
  email: string;
  note: string;
  /** Teklifte ÖNCE önerilen kişi. Müşteri başına en çok bir tanedir. */
  isPrimary: boolean;
  active: boolean;
  sort: number;
}

/** Teklif kapağının "KİME" bloğuna hazır hâl (`OfferCover` alan adlarıyla). */
export interface ContactCoverFields {
  toName: string;
  toDept: string;
  toPhone: string;
  toEmail: string;
}

/**
 * Kişiyi kapak alanlarına çevirir.
 *
 * BOŞ ALAN BOŞ KALIR (değişmez md. 4): kişi seçilmemişse ya da bölümü
 * bilinmiyorsa kapakta hiçbir şey yazmaz. Unvanı bölüm yerine koymak ("Satın
 * Alma Müdürü" → Bölüm satırı) müşteriye giden belgede uydurma bir bilgi
 * olurdu; ikisi ayrı sorulardır ve ayrı saklanır.
 */
export function coverFieldsFromContact(
  c: CustomerContact | null | undefined
): ContactCoverFields {
  if (!c) return { toName: "", toDept: "", toPhone: "", toEmail: "" };
  return { toName: c.name, toDept: c.department, toPhone: c.phone, toEmail: c.email };
}

/**
 * Defterin ETKİN kişileri, ekrandaki sırayla.
 *
 * SIRA `sort`TAN, EŞİTLİKTE ADDAN gelir: `sort` varsayılanı 0'dır ve elle hiç
 * sıralanmamış bir defterde bütün satırlar eşit kalır — o hâlde sıra veritabanı
 * dönüş sırası olur, yani her okumada değişebilir. Ada düşmek listeyi
 * KARARLI kılar.
 */
export function activeContacts(list: readonly CustomerContact[]): CustomerContact[] {
  return list
    .filter((c) => c.active)
    .slice()
    .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, "tr"));
}

/**
 * Teklif açılırken önerilecek kişi: birincil varsa o, yoksa sıradaki ilk etkin
 * kişi, hiç etkin kişi yoksa `null`.
 *
 * PASİF KİŞİ BİRİNCİL OLSA DA ÖNERİLMEZ: pasife çekmek "bu kişi artık muhatap
 * değil" demektir ve iki işaretin çeliştiği yerde son karar pasifliktir.
 * `null` dönmesi bir hata değildir — defteri boş bir müşteride kapak alanları
 * elle doldurulur.
 */
export function suggestedContact(
  list: readonly CustomerContact[]
): CustomerContact | null {
  const etkin = activeContacts(list);
  return etkin.find((c) => c.isPrimary) ?? etkin[0] ?? null;
}
