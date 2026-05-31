import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['@stock-intel/contracts', '@stock-intel/utils'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
