import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PDF raporu (report route'u + issueRevision server action'ı) DejaVu
  // fontlarını dosya sisteminden okur; Vercel trace'ine dahil edilmeleri gerekir.
  outputFileTracingIncludes: {
    "/projects/**": ["./src/assets/fonts/**/*"],
  },
};

export default nextConfig;
