import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` normal Node girişinde bilerek hata atar. Vitest sunucu
      // eylemlerini doğrudan içe aktardığı için paketin React Server girişini
      // kullanır; uygulama derlemesindeki istemci sınırı bundan etkilenmez.
      "server-only": fileURLToPath(
        new URL("./node_modules/server-only/empty.js", import.meta.url)
      ),
    },
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
