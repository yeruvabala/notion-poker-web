import path from 'path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { serverActions: { allowedOrigins: ['*'] } },
  webpack: (config) => {
    // Ensure @/* resolves to the project root during build
    config.resolve.alias = { ...(config.resolve.alias ?? {}), '@': path.resolve('.') };
    return config;
  },
};
export default nextConfig;
