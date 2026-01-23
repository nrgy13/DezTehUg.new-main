/** @type {import('next').NextConfig} */
const nextConfig = {
  optimizeFonts: false,
  experimental: {
    fontLoaders: [
      { loader: '@next/font/google', options: { subsets: ['latin', 'cyrillic'] } },
    ],
  },
  output: 'standalone',
  images: {
    unoptimized: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  trailingSlash: false,
};

module.exports = nextConfig;
