// Pano özet kartı — liste ekranlarının üstündeki dört kutu.
//
// İşler, Mühendislik ve Teknik Resimler aynı kartı basıyordu; iki kopya zaten
// vardı ve üçüncüsü yazılacaktı. Aynı görsel dilin üç yerde ayrı ayrı
// tutulması, biri değişince öbürlerinin sessizce ayrışması demek.
//
// Sunum katmanıdır: veri almaz, biçimlemez, yalnız gösterir. Sayı `value`ye
// BİÇİMLENMİŞ metin olarak verilir (tr-TR ayracı çağıranın işidir).

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-card p-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 leading-tight">
        <div className="oc-kicker text-muted-foreground">{label}</div>
        <div className="mt-0.5 font-mono text-xl font-semibold tabular-nums tracking-tight">
          {value}
        </div>
        {/* `truncate` kırptığında tam metnin görünebileceği tek yer ipucudur. */}
        {hint && (
          <div className="mt-0.5 truncate text-[11px] text-foreground/70" title={hint}>
            {hint}
          </div>
        )}
      </div>
    </div>
  );
}
