import { feedbackDetailPage } from "@/lib/account/feedback-pages";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return feedbackDetailPage((await params).id, await searchParams, false);
}
