export default function JobProjectDocumentsLoading() {
  return (
    <div className="grid animate-pulse gap-4" aria-label="İş dokümanları yükleniyor">
      <div className="h-10 rounded-lg border bg-muted/40" />
      <div className="h-12 rounded-lg border bg-muted/40" />
      <div className="h-72 rounded-lg border bg-muted/30" />
    </div>
  );
}
