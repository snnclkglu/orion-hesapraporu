import { feedbackListPage } from "@/lib/account/feedback-pages";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return feedbackListPage(await searchParams, true);
}
