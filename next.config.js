/** @type {import('next').NextConfig} */
const nextConfig = {
  // Временно отключаем export для тестирования
  // output: 'export',
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true
  },
  // Обеспечиваем правильную обработку статических файлов
  trailingSlash: true,
  assetPrefix: '',
};

module.exports = nextConfig;
