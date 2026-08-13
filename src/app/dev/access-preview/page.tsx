// Sadece development: YETKİ IZGARASINI auth olmadan görsel test etmek için.
// Production'da 404 döner.
//
// Izgara dokuz sütunludur ve sütun sayısı bölüm eklendikçe artar; telefonda
// yapışkan ilk sütunun ve yatay kaydırmanın gerçekten çalıştığı ancak burada
// ölçülebilir. Kişiler sahtedir ama ROLLERİ gerçek dağılımı taklit eder —
// yalnız yöneticiden oluşan bir fikstür, kapalı hücreyi hiç göstermezdi.

import { notFound } from "next/navigation";
import { AccessGrid, type AccessPerson } from "@/app/(app)/admin/access/access-grid";

const KISILER: AccessPerson[] = [
  { id: "1", ad: "Akif Ergüven", rol: "manager" },
  { id: "2", ad: "Alkım Kelleci", rol: "engineer" },
  { id: "3", ad: "Mehmet Yıldız", rol: "draftsman" },
  { id: "4", ad: "Salih Ergüven", rol: "admin" },
  { id: "5", ad: "Sinan Çolakoğlu", rol: "admin" },
  { id: "6", ad: "Zeynep Arslan", rol: "purchasing" },
  // Rolü bozuk/eski bir kayıt: `roleOf` güvenli role düşürmeli ve satır
  // ızgarayla aynı cevabı vermeli.
  { id: "7", ad: "test.muhendis", rol: "bilinmeyen" },
];

export default function AccessPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-6">
      <AccessGrid kisiler={KISILER} />
    </main>
  );
}
