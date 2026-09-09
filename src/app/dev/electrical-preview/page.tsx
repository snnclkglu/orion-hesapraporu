import { notFound } from "next/navigation";
import { ElectricalPreviewClient } from "./preview-client";

export default function ElectricalPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <ElectricalPreviewClient />;
}
