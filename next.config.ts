import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // GramJS (cliente MTProto do Telegram) usa recursos nativos do Node:
  // fica fora do bundle e e carregado via require.
  serverExternalPackages: ["telegram"],
};

export default nextConfig;
