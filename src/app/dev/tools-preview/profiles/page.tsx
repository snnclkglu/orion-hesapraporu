import { notFound } from "next/navigation";
import { ProfilesLibrary } from "@/app/(app)/tools/profiller/profiles-library";

export default function ProfilesPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <main className="mx-auto min-h-dvh max-w-[96rem] overflow-x-clip bg-background p-3 text-foreground sm:p-6"><ProfilesLibrary /></main>;
}
