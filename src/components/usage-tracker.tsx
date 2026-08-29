"use client";

// Mahremiyet odaklı kullanım sayacı.
//
// Yalnız bölüm anahtarı, aktif saniye, sayfa geçişi, oturum kimliği ve görünür
// alan temelli cihaz sınıfı gönderilir. Tam adres, kayıt kimliği, arama metni,
// form değeri veya basılan tuş hiçbir zaman istek gövdesine girmez.

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  usageDeviceClass,
  usageSectionForPath,
  type UsageDeviceClass,
  type UsageSection,
} from "@/lib/usage";

const HEARTBEAT_MS = 30_000;
const IDLE_AFTER_MS = 5 * 60_000;
const NEW_SESSION_AFTER_MS = 30 * 60_000;
const STORAGE_KEY = "orion:usage-session:v1";

interface StoredSession {
  id: string;
  touchedAt: number;
}

interface UsagePulse {
  sessionId: string;
  section: UsageSection;
  activeSeconds: number;
  pageViews: number;
  deviceClass: UsageDeviceClass;
}

function newSession(): StoredSession {
  return { id: crypto.randomUUID(), touchedAt: Date.now() };
}

function readSession(): StoredSession {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null") as Partial<StoredSession>;
    if (
      typeof parsed?.id === "string" &&
      typeof parsed.touchedAt === "number" &&
      Date.now() - parsed.touchedAt < NEW_SESSION_AFTER_MS
    ) {
      return { id: parsed.id, touchedAt: parsed.touchedAt };
    }
  } catch {
    // Bozuk/engellenmiş sessionStorage takibi durdurmaz; yeni oturum yeterlidir.
  }
  return newSession();
}

function writeSession(session: StoredSession) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Gizli gezinti veya depolama engeli ölçümü uygulamanın önüne geçirmez.
  }
}

function sendPulse(pulse: UsagePulse, beacon: boolean) {
  const body = JSON.stringify(pulse);
  if (beacon && typeof navigator.sendBeacon === "function") {
    const accepted = navigator.sendBeacon(
      "/api/usage",
      new Blob([body], { type: "application/json" })
    );
    if (accepted) return;
  }
  void fetch("/api/usage", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // Telemetri yardımcıdır; ağ kesintisi kullanıcının asıl işini kesmez.
  });
}

export function UsageTracker() {
  const pathname = usePathname();
  const sessionRef = useRef<StoredSession | null>(null);
  const viewedPathRef = useRef<string | null>(null);

  useEffect(() => {
    const currentPath = pathname ?? "/";
    const section = usageSectionForPath(currentPath);
    const deviceClass = usageDeviceClass(window.innerWidth);
    const session = sessionRef.current ?? readSession();
    sessionRef.current = session;
    writeSession(session);

    const pageChanged = viewedPathRef.current !== currentPath;
    if (pageChanged) {
      viewedPathRef.current = currentPath;
      sendPulse(
        {
          sessionId: session.id,
          section,
          activeSeconds: 0,
          pageViews: 1,
          deviceClass,
        },
        false
      );
    }

    let pendingActiveSeconds = 0;
    let lastSampleAt = performance.now();
    let lastInteractionAt = Date.now();

    const sample = () => {
      const nowPerformance = performance.now();
      const nowWall = Date.now();
      const elapsed = Math.min(Math.max((nowPerformance - lastSampleAt) / 1000, 0), 60);
      if (document.visibilityState === "visible" && nowWall - lastInteractionAt < IDLE_AFTER_MS) {
        pendingActiveSeconds += elapsed;
      }
      lastSampleAt = nowPerformance;
    };

    const touchSession = () => {
      const current = sessionRef.current;
      if (!current) return;
      current.touchedAt = Date.now();
      writeSession(current);
    };

    const flush = (beacon: boolean) => {
      sample();
      const wholeSeconds = Math.floor(pendingActiveSeconds);
      if (wholeSeconds <= 0) return;
      pendingActiveSeconds -= wholeSeconds;
      const current = sessionRef.current;
      if (!current) return;
      sendPulse(
        {
          sessionId: current.id,
          section,
          activeSeconds: Math.min(wholeSeconds, 60),
          pageViews: 0,
          deviceClass: usageDeviceClass(window.innerWidth),
        },
        beacon
      );
      touchSession();
    };

    const markInteraction = () => {
      sample();
      const now = Date.now();
      if (now - lastInteractionAt >= NEW_SESSION_AFTER_MS) {
        flush(false);
        const replacement = newSession();
        sessionRef.current = replacement;
        writeSession(replacement);
        sendPulse(
          {
            sessionId: replacement.id,
            section,
            activeSeconds: 0,
            pageViews: 1,
            deviceClass: usageDeviceClass(window.innerWidth),
          },
          false
        );
      }
      lastInteractionAt = now;
      lastSampleAt = performance.now();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flush(true);
      } else {
        markInteraction();
      }
    };
    const onPageHide = () => flush(true);
    const interval = window.setInterval(() => flush(false), HEARTBEAT_MS);

    window.addEventListener("pointerdown", markInteraction, { passive: true });
    window.addEventListener("keydown", markInteraction);
    window.addEventListener("scroll", markInteraction, { passive: true });
    window.addEventListener("focus", markInteraction);
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("pointerdown", markInteraction);
      window.removeEventListener("keydown", markInteraction);
      window.removeEventListener("scroll", markInteraction);
      window.removeEventListener("focus", markInteraction);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      flush(true);
    };
  }, [pathname]);

  return null;
}
