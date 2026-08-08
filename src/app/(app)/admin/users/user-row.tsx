"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateUserProfile } from "../actions";
import {
  USER_ROLES, USER_ROLE_HINTS, USER_ROLE_LABELS, roleLabel, roleOf, type UserRole,
} from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface Profile {
  id: string;
  full_name: string;
  email: string;
  title: string;
  role: string;
}

export function UserRow({
  profile,
  isSelf,
  adminCount,
}: {
  profile: Profile;
  isSelf: boolean;
  adminCount: number;
}) {
  const [role, setRole] = useState<UserRole>(roleOf(profile.role));
  const [fullName, setFullName] = useState(profile.full_name);
  const [title, setTitle] = useState(profile.title);
  const [pending, startTransition] = useTransition();

  const dirty = role !== profile.role || title !== profile.title || fullName !== profile.full_name;
  const lastAdmin = profile.role === "admin" && adminCount <= 1;

  function handleSave() {
    // Yöneticilikten ÇIKARMA onay ister: hangi role düşürüldüğü fark etmez,
    // kaybedilen yetki aynıdır.
    if (profile.role === "admin" && role !== "admin") {
      if (lastAdmin) {
        toast.error("Sistemdeki son Yönetici rolü düşürülemez.");
        return;
      }
      const msg = isSelf
        ? `Kendi rolünüzü ${USER_ROLE_LABELS[role]} yapmak üzeresiniz; yönetim paneline erişiminiz kapanır. Devam edilsin mi?`
        : `${profile.full_name || "Kullanıcı"} Yönetici rolünden ${USER_ROLE_LABELS[role]} rolüne düşürülecek. Devam edilsin mi?`;
      if (!window.confirm(msg)) return;
    }
    startTransition(async () => {
      const result = await updateUserProfile(profile.id, { role, title, full_name: fullName });
      if (result?.error) toast.error(result.error);
      else toast.success("Kullanıcı güncellendi");
    });
  }

  return (
    <TableRow>
      <TableCell className="font-medium">
        <Input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Ad Soyad"
          className="h-8 min-w-48"
        />
        {isSelf && <span className="ml-1.5 text-xs text-muted-foreground">(siz)</span>}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{profile.email || "—"}</TableCell>
      <TableCell>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Unvan (ör. Makine Mühendisi)"
          className="h-8 max-w-64"
        />
      </TableCell>
      <TableCell>
        <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
          <SelectTrigger size="sm" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {USER_ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                <span className="flex flex-col items-start gap-0.5">
                  <span>{USER_ROLE_LABELS[r]}</span>
                  <span className="text-[11px] leading-tight text-muted-foreground">
                    {USER_ROLE_HINTS[r]}
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {role !== roleOf(profile.role) && (
          <div className="mt-1 text-[11px] text-muted-foreground">
            {roleLabel(profile.role)} → {USER_ROLE_LABELS[role]}
          </div>
        )}
      </TableCell>
      <TableCell>
        <Button size="sm" variant="outline" disabled={!dirty || pending} onClick={handleSave}>
          {pending ? "Kaydediliyor..." : "Kaydet"}
        </Button>
      </TableCell>
    </TableRow>
  );
}
