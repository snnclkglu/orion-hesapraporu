"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { accountContext, accountError, checkDb } from "@/lib/account/server";
import {
  teamSchemas,
  type TeamOperation,
  type DirectoryPerson,
} from "@/lib/tasks/teams";
import { adBuyuk } from "@/lib/tr-text";
export async function saveTeam(
  operation: TeamOperation,
  input: unknown,
  key?: string,
) {
  try {
    const schema = teamSchemas[operation];
    if (!schema) throw new Error("Geçersiz işlem.");
    const p = schema.safeParse(input);
    if (!p.success)
      throw new Error("Ekip bilgilerini ve seçilen kişileri kontrol edin.");
    const data = p.data;
    if ("name" in data) data.name = adBuyuk(data.name);
    if (key && (key.length < 8 || key.length > 128))
      throw new Error("Geçersiz tekrar anahtarı.");
    const { db } = await accountContext();
    const { data: result, error } = await db.rpc("team_manage", {
      p_operation: operation,
      p_data: data,
      p_key: key ?? null,
    });
    checkDb(error);
    revalidatePath("/admin/teams", "layout");
    revalidatePath("/admin/users");
    revalidatePath("/profile");
    revalidatePath("/");
    return { team: result.team };
  } catch (e) {
    return { error: accountError(e) };
  }
}
export async function searchDirectory(
  query: string,
  role = "",
  page = 0,
  team?: string,
) {
  try {
    if (
      query.length > 100 ||
      !Number.isInteger(page) ||
      page < 0 ||
      page > 10000 ||
      (team && !z.uuid().safeParse(team).success)
    )
      throw new Error("Arama bilgilerini kontrol edin.");
    const { db } = await accountContext();
    const { data, error } = await db.rpc("team_directory", {
      p_q: query,
      p_role: role,
      p_page: page,
      p_team: team ?? null,
    });
    checkDb(error);
    return { people: data as DirectoryPerson[] };
  } catch (e) {
    return { error: accountError(e) };
  }
}
