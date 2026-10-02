import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@huggingface/transformers', 'better-sqlite3'],
};

export default nextConfig;
