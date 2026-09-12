"use server";
import { revalidatePath } from "next/cache";
import {
  accountContext,
  accountError,
  checkDb,
  normalizeImage,
  uploadPrivate,
} from "@/lib/account/server";
import { profileSchema, profileUpdateSchema } from "@/lib/account/model";
import { adBuyuk } from "@/lib/tr-text";
import sharp from "sharp";
export async function prepareAvatar(form: FormData) {
  try {
    const { db } = await accountContext();
    const { data, error } = await db.rpc("account_media_rate_limit");
    checkDb(error);
    if (!data)
      throw new Error(
        "Çok sık fotoğraf seçildi. Bir dakika sonra yeniden deneyin.",
      );
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("Fotoğraf seçin.");
    const bytes = await normalizeImage(file, 1600);
    return { image: bytes.toString("base64") };
  } catch (e) {
    return { error: accountError(e) };
  }
}
export async function saveAccount(input: unknown) {
  try {
    const parsed = profileSchema.safeParse(input);
    if (!parsed.success)
      throw new Error("Ad soyad ve alan uzunluklarını kontrol edin.");
    const { db, user } = await accountContext();
    const { data: previous, error: previousError } = await db
      .from("profile_private_details")
      .select("phone")
      .eq("user_id", user.id)
      .maybeSingle();
    checkDb(previousError);
    const checked = profileUpdateSchema(previous?.phone ?? "").safeParse(input);
    if (!checked.success)
      throw new Error(
        checked.error.issues[0]?.message ?? "Telefonu kontrol edin.",
      );
    const p = checked.data;
    const { error, data } = await db.rpc("account_save", {
      p_name: adBuyuk(p.name),
      p_phone: p.phone,
      p_note: p.note,
      p_version: p.version,
    });
    checkDb(error);
    revalidatePath("/", "layout");
    return { version: data as number, name: adBuyuk(p.name), phone: p.phone };
  } catch (e) {
    return { error: accountError(e) };
  }
}
export async function saveAvatar(form: FormData) {
  let newPath: string | null = null;
  try {
    const { db, user } = await accountContext();
    const { data: profile, error } = await db
      .from("profiles")
      .select("avatar_path,account_version")
      .eq("id", user.id)
      .single();
    checkDb(error);
    if (!profile || profile.account_version !== Number(form.get("version")))
      throw new Error("Profil değişti. Sayfayı yenileyin.");
    if (form.get("remove") !== "true") {
      const file = form.get("file");
      if (!(file instanceof File)) throw new Error("Fotoğraf seçin.");
      const values = ["zoom", "x", "y"].map((k) => Number(form.get(k)));
      if (values.some((n) => !Number.isFinite(n)))
        throw new Error("Kırpma alanını kontrol edin.");
      const main = await normalizeImage(file, 256, {
        zoom: values[0],
        x: values[1],
        y: values[2],
      });
      newPath = `${user.id}/${crypto.randomUUID()}`;
      await uploadPrivate("account-avatars", `${newPath}/256.webp`, main);
      await uploadPrivate(
        "account-avatars",
        `${newPath}/64.webp`,
        await sharp(main).resize(64).webp({ quality: 80 }).toBuffer(),
      );
    }
    const { data: changed, error: updateError } = await db
      .from("profiles")
      .update({ avatar_path: newPath })
      .eq("id", user.id)
      .eq("account_version", profile.account_version)
      .select("account_version")
      .single();
    checkDb(updateError);
    if (!changed) throw new Error("Profil değişti. Yeniden deneyin.");
    const saved = newPath;
    newPath = null;
    // Eski nesneler 25 saatlik bakımda temizlenir; eşzamanlı referans değişimiyle yarışılmaz.
    revalidatePath("/", "layout");
    return { version: changed.account_version as number, avatar: saved };
  } catch (e) {
    // Yarım yükleme okuma politikasında görünmez; bakım referans dışı nesneyi temizler.
    return { error: accountError(e) };
  }
}
export async function changeAccountPassword(form: FormData) {
  try {
    const { db, user } = await accountContext();
    const current = String(form.get("current") ?? ""),
      password = String(form.get("password") ?? "");
    if (
      !user.email ||
      password.length < 12 ||
      password.length > 128 ||
      password !== form.get("confirm")
    )
      throw new Error(
        "Yeni parola en az 12 karakter olmalı ve tekrarıyla eşleşmeli.",
      );
    const { error: verify } = await db.auth.signInWithPassword({
      email: user.email,
      password: current,
    });
    if (verify) throw new Error("Mevcut parola doğrulanamadı.");
    const { error } = await db.auth.updateUser({ password });
    if (error)
      throw new Error(
        "Parola değiştirilemedi. Güvenlik koşullarını kontrol edin ve yeniden deneyin.",
      );
    return { ok: true };
  } catch (e) {
    return { error: accountError(e) };
  }
}
