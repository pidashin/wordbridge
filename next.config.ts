import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  serverExternalPackages: ['@prisma/client'],
};

export default nextConfig;
