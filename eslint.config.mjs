import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    // Yerel PDF/katalog doğrulama araçlarının ürettiği sanal ortam ve
    // render çıktıları kaynak kod değildir; Windows bazı salt-okunur `bin`
    // klasörlerinde scandir'i EPERM ile kesiyor.
    ".tmp/**",
    ".tmpcheck/**",
    "tmp/**",
    "output/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
