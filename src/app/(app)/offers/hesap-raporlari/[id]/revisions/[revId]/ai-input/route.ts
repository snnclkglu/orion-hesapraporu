// Teklif bağlamı yalnız rota kabuğudur; aktarım biçimi ve veri okuma
// Mühendislik hesap kodunun ortak ucunda tek yerde yaşar.
export { GET } from "@/app/(app)/projects/[id]/revisions/[revId]/ai-input/route";

// Next.js route segment yapılandırmasını build sırasında statik olarak okur;
// bu nedenle `runtime` başka bir route dosyasından yeniden export edilemez.
export const runtime = "nodejs";
