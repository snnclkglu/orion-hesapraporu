export interface SafetyReference { group: string; label: string; value: string; source: string; note?: string; }

export const ACCESS_REFERENCES: readonly SafetyReference[] = [
  { group:"Merdiven", label:"Basamak yüksekliği h", value:"130–225 mm", source:"EN ISO 14122-3:2016" },
  { group:"Merdiven", label:"Basamak genişliği g", value:"en az 210 mm", source:"EN ISO 14122-3:2016" },
  { group:"Merdiven", label:"Adım bağıntısı", value:"600 ≤ g + 2h ≤ 660 mm", source:"EN ISO 14122-3:2016" },
  { group:"Merdiven", label:"Net genişlik", value:"en az 600 mm; tercih 800 mm", source:"EN ISO 14122-3:2016" },
  { group:"Korkuluk", label:"Üst korkuluk yüksekliği", value:"en az 1100 mm", source:"EN ISO 14122-3:2016" },
  { group:"Korkuluk", label:"Topuk levhası", value:"en az 100 mm", source:"EN ISO 14122-3:2016" },
  { group:"Korkuluk", label:"Yatay açıklık", value:"en fazla 500 mm", source:"EN ISO 14122-3:2016", note:"Üst korkuluk, ara korkuluk ve topuk levhası arasındaki açıklıklar." },
  { group:"Sabit dik merdiven", label:"Basamak aralığı", value:"225–300 mm", source:"EN ISO 14122-4:2016" },
  { group:"Sabit dik merdiven", label:"Kollar arası net genişlik", value:"400–600 mm", source:"EN ISO 14122-4:2016" },
  { group:"Platform ve yürüme yolu", label:"Uygulama kapsamı", value:"Sabit makine erişimi", source:"EN ISO 14122-1/-2", note:"Geçiş genişliği ve yükler, güncel lisanslı standarda göre proje bazında doğrulanır." },
  { group:"Merdiven ve korkuluk", label:"Uygulama kapsamı", value:"Merdiven, basamaklı merdiven ve korkuluk", source:"EN ISO 14122-3" },
  { group:"Sabit dik merdiven", label:"Uygulama kapsamı", value:"Sabit dik merdiven ve düşmeye karşı koruma", source:"EN ISO 14122-4" },
  { group:"Vinç erişimi", label:"Uygulama kapsamı", value:"Kumanda, bakım, kurulum ve söküm erişimi", source:"EN 13586:2026", note:"Hareketli parçalara, sıcak yüzeylere ve elektriğe karşı emniyet mesafelerini kapsamaz." },
  { group:"Tehlikeli bölge", label:"Üst ve alt uzuv erişimi", value:"Koruyucu yapı ile erişimin engellenmesi", source:"EN ISO 13857:2019", note:"Yalnız mesafe ile yeterli risk azaltımı sağlanabiliyorsa kullanılır; tırmanarak erişimi kapsamaz." },
];
