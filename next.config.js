/** @type {import('next').NextConfig} */
const nextConfig = {
  // Статический экспорт для Netlify (Next.js 13+ App Router)
  // Временно отключено для локальной разработки
  // output: 'export',
  
  // Оптимизация для Netlify деплоя
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true
  },
  // Netlify оптимизация
  trailingSlash: false,
  
  // Заголовки безопасности настроены в netlify.toml для статического экспорта
  // async headers() не совместимо с output: 'export'

  // Экспериментальные функции для оптимизации
  // Убираем экспериментальную CSS оптимизацию для статического экспорта
  // experimental: {
  //   optimizeCss: true,
  // },
};

module.exports = nextConfig;
