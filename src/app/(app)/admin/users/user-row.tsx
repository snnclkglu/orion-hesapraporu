"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateUserProfile } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface Profile {
  id: string;
  full_name: string;
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
  const [role, setRole] = useState<"admin" | "engineer">(
    profile.role === "admin" ? "admin" : "engineer"
  );
  const [title, setTitle] = useState(profile.title);
  const [pending, startTransition] = useTransition();

  const dirty = role !== profile.role || title !== profile.title;
  const lastAdmin = profile.role === "admin" && adminCount <= 1;

  function handleSave() {
    if (profile.role === "admin" && role === "engineer") {
      if (lastAdmin) {
        toast.error("Sistemdeki son admin rolü düşürülemez.");
        return;
      }
      const msg = isSelf
        ? "Kendi admin rolünüzü düşürmek üzeresiniz; yönetim paneline erişiminiz kapanır. Devam edilsin mi?"
        : `${profile.full_name || "Kullanıcı"} admin rolünden düşürülecek. Devam edilsin mi?`;
      if (!window.confirm(msg)) return;
    }
    startTransition(async () => {
      const result = await updateUserProfile(profile.id, { role, title });
      if (result?.error) toast.error(result.error);
      else toast.success("Kullanıcı güncellendi");
    });
  }

  return (
    <TableRow>
      <TableCell className="font-medium">
        {profile.full_name || "—"}
        {isSelf && <span className="ml-1.5 text-xs text-muted-foreground">(siz)</span>}
      </TableCell>
      <TableCell>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Unvan (ör. Makine Mühendisi)"
          className="h-8 max-w-64"
        />
      </TableCell>
      <TableCell>
        <Select value={role} onValueChange={(v) => setRole(v as "admin" | "engineer")}>
          <SelectTrigger size="sm" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="engineer">Mühendis</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Button size="sm" variant="outline" disabled={!dirty || pending} onClick={handleSave}>
          {pending ? "Kaydediliyor..." : "Kaydet"}
        </Button>
      </TableCell>
    </TableRow>
  );
}
