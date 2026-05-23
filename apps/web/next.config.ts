import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['@stock-intel/contracts', '@stock-intel/utils'],
};

export default nextConfig;
