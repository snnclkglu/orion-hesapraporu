"use client";
import { useState } from "react";
import Image from "next/image";
export function UserAvatar({
  name,
  userId,
  version,
  size = 28,
  photo = false,
}: {
  name: string;
  userId?: string;
  version?: string | number;
  size?: number;
  photo?: boolean;
}) {
  const src =
    photo && userId
      ? `/api/account/avatar/${userId}?v=${encodeURIComponent(version ?? "")}&size=${size > 64 ? 256 : 64}`
      : "";
  const [failed, setFailed] = useState("");
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 font-semibold text-primary ring-1 ring-border"
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.3) }}
      aria-hidden="true"
    >
      {src && failed !== src ? (
        <Image unoptimized
          src={src}
          alt=""
          width={size}
          height={size}
          onError={() => setFailed(src)}
        />
      ) : (
        name
          .trim()
          .split(/\s+/)
          .slice(0, 2)
          .map((s) => s[0])
          .join("")
          .toLocaleUpperCase("tr-TR") || "?"
      )}
    </span>
  );
}
