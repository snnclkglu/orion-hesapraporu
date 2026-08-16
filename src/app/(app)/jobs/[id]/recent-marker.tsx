"use client";

// İş detayına girişi "son bakılanlar" defterine işler; hiçbir şey çizmez.
// Efekt yalnız DIŞ DÜNYAYA yazar (localStorage) — setState senkronizasyonu
// değildir, yasak kapsamına girmez.

import { useEffect } from "react";
import { markRecentJob } from "@/lib/jobs/recent";

export function RecentMarker({
  id,
  jobNo,
  title,
}: {
  id: string;
  jobNo: string;
  title: string;
}) {
  useEffect(() => {
    markRecentJob({ id, jobNo, title });
  }, [id, jobNo, title]);
  return null;
}
