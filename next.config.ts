import type { NextConfig } from 'next';
import { BASE_PATH } from './app/basePath';

const nextConfig: NextConfig = {
  /* config options here */
  basePath: BASE_PATH,
  typescript: {
    ignoreBuildErrors: true,
  },
  serverExternalPackages: ['@prisma/client'],
};

export default nextConfig;
