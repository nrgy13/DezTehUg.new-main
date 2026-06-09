const withPWAInit = require('@ducanh2912/next-pwa').default;

// next-pwa в dev отключаем: сервис-воркер мешает HMR и кеширует битые чанки.
// На prod (next start или standalone) — sw.js регистрируется автоматически.
const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  workboxOptions: {
    // Подключаем кастомный push-handler. Workbox после регистрации sw.js
    // вызовет importScripts('/push-sw.js') и подключит наши слушатели.
    importScripts: ['/push-sw.js'],
    // Не кэшируем server actions/API/auth — чтобы push subscriptions, login,
    // мутации деалов не отдавались из stale SW.
    navigateFallback: '/offline',
    navigateFallbackDenylist: [/^\/api\//, /^\/_next\/data\//, /^\/_next\/image\//],
    // Что закэшировать на лету
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/fonts\.(?:gstatic|googleapis)\.com\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'google-fonts',
          expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
        },
      },
      {
        urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'static-images',
          expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
        },
      },
      {
        // App-shell для master-роутов: если оффлайн — показываем последний кэш
        urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/master'),
        handler: 'NetworkFirst',
        options: {
          cacheName: 'master-pages',
          networkTimeoutSeconds: 5,
          expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
        },
      },
    ],
  },
});

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
  experimental: {
    optimizePackageImports: ['lucide-react'],
    serverActions: {
      // Фото чеклиста мастера до 5 МБ + overhead FormData. Дефолт Next 14 = 1 МБ
      // молча резал загрузку фото с телефона ещё до входа в server action.
      bodySizeLimit: '6mb',
    },
  },
};

module.exports = withPWA(nextConfig);
