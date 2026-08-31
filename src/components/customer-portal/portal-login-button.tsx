"use client";

import { useFormStatus } from "react-dom";

/**
 * ÇİFT DOKUNUŞ İKİ DENEME HAKKI YAKMASIN.
 *
 * Giriş formu düz bir POST'tur ve JavaScript olmadan da çalışır — bu bilinçli:
 * şantiyedeki bir telefonda betik yüklenmese bile müşteri dokümanlarına
 * ulaşabilmelidir. Ama yavaş bağlantıda kullanıcı düğmeye iki kez basıyor ve
 * sunucu bunu İKİ AYRI DENEME sayıyordu; beş denemede kilit gelir.
 *
 * İlk çözüm form içine gömülü bir `<script>` etiketiydi; React bunu açıkça
 * uyarıyor ("Scripts inside React components are never executed when rendering
 * on the client") ve istemci gezinmesinde hiç çalışmıyordu. `useFormStatus`
 * aynı işi çerçevenin kendi yoluyla yapar: betik yüklenmezse düğme normal
 * davranır, yüklenirse ikinci dokunuşu yutar.
 */
export function PortalLoginButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="oc-tap mt-1 inline-flex min-h-11 items-center justify-center bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
    >
      {pending ? "Kontrol ediliyor…" : "Dokümanları Aç"}
    </button>
  );
}
