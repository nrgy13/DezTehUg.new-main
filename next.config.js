/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  swcMinify: true,
  images: {
    unoptimized: true,
  },
  compress: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  trailingSlash: false,
};

module.exports = nextConfig;
