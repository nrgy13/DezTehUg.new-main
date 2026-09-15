import './globals.css';
import type { Metadata, Viewport } from 'next';
import { inter, display } from './fonts';
import { AppWrapper } from '@/components/layout/AppWrapper';
import { YandexMetrika } from '@/components/analytics/YandexMetrika';

export const metadata: Metadata = {
  // Боевой домен (punycode дезтехюг.рф); Netlify-зеркало мертво с 09.2026
  metadataBase: new URL('https://xn--c1abdaj0ewa6e.xn--p1ai'),
  title: 'DEZTECHYUG - Дезинфекция будущего уже сегодня | Профессиональная санитарная служба',
  description: 'Элитная команда технологичных специалистов. 5 лет безупречной работы. Полное уничтожение угроз за 24 часа. Дезинфекция, дезинсекция, дератизация, анализ воды.',
  keywords: 'дезинфекция, дезинсекция, дератизация, анализ воды, санитарная служба, уничтожение насекомых, борьба с грызунами, профессиональная обработка',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'ДТЮ CRM',
    statusBarStyle: 'default',
  },
  icons: {
    icon: [
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/favicon-16.png', sizes: '16x16', type: 'image/png' },
      // ≥120×120 — требование Яндекс Вебмастера к фавиконке
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
  openGraph: {
    title: 'DEZTECHYUG - Дезинфекция будущего уже сегодня',
    description: 'Элитная команда технологичных специалистов. 5 лет безупречной работы.',
    type: 'website',
    locale: 'ru_RU',
    url: 'https://xn--c1abdaj0ewa6e.xn--p1ai',
    siteName: 'DEZTECHYUG',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FF6B35' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className={`${inter.variable} ${display.variable}`}>
      <body className={`${inter.className} antialiased`}>
        <YandexMetrika />
        <AppWrapper>{children}</AppWrapper>
      </body>
    </html>
  );
}
