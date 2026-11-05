import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  env: {
    // Identifica o build no cliente (muda a cada deploy via git SHA). O
    // VersionGuard compara com /api/version e recarrega quando um deploy novo
    // entra no ar — evita rodar código antigo em cache durante o lançamento.
    NEXT_PUBLIC_BUILD_VERSION: process.env.VERCEL_GIT_COMMIT_SHA || "local",
  },
};

export default nextConfig;
