// OTURUM PROFİLİ — İSTEK BAŞINA TEK OKUMA.
//
// Kabuk (`(app)/layout.tsx`) ve açılış sayfası aynı profil satırını ayrı ayrı
// okuyordu — her gezinmede bir fazladan gidiş-dönüş. React'in `cache`'i aynı
// istek içindeki çağrıları tekilleştirir: ikinci çağrı sorgu koşturmaz, ilkinin
// sonucunu alır. Oturum yoksa null döner; yönlendirme kararı ÇAĞIRANINDIR
// (kabuk /login'e atar, sayfa tipi daraltmak için yeniden sorar).

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export interface SessionProfile {
  userId: string;
  email: string;
  fullName: string;
  role: string;
}

export const getSessionProfile = cache(
  async (): Promise<SessionProfile | null> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    // Menünün ve panonun tek girdisi ROLdür; `tags` sütunu role dönüşüp
    // düşürüldüğünden (12.08.2026) zengin sorguya gerek yok.
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, role")
      .eq("id", user.id)
      .maybeSingle();

    return {
      userId: user.id,
      email: user.email ?? "",
      fullName: profile?.full_name ?? "",
      role: profile?.role ?? "engineer",
    };
  }
);
