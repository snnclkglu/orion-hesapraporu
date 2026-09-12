import { FeedbackForm } from "@/components/account/feedback-form";
import { accountContext } from "@/lib/account/server";
export default async function Page() {
  const { user } = await accountContext();
  return <FeedbackForm userId={user.id} />;
}
