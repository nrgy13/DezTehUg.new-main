import './globals.css';
import type { Metadata } from 'next';
import { Inter, Orbitron } from 'next/font/google';
import { AppWrapper } from '@/components/layout/AppWrapper';

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter'
});

const orbitron = Orbitron({ 
  subsets: ['latin'],
  variable: '--font-orbitron'
});

export const metadata: Metadata = {
  metadataBase: new URL('https://deztehug.netlify.app'),
  title: 'DEZTECHYUG - Дезинфекция будущего уже сегодня | Профессиональная санитарная служба',
  description: 'Элитная команда технологичных специалистов. 5 лет безупречной работы. Полное уничтожение угроз за 24 часа. Дезинфекция, дезинсекция, дератизация, анализ воды.',
  keywords: 'дезинфекция, дезинсекция, дератизация, анализ воды, санитарная служба, уничтожение насекомых, борьба с грызунами, профессиональная обработка',
  viewport: {
    width: 'device-width',
    initialScale: 0.9,
    maximumScale: 5,
    userScalable: true,
  },
  openGraph: {
    title: 'DEZTECHYUG - Дезинфекция будущего уже сегодня',
    description: 'Элитная команда технологичных специалистов. 5 лет безупречной работы.',
    type: 'website',
    locale: 'ru_RU',
    url: 'https://deztehug.netlify.app',
    siteName: 'DEZTECHYUG',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className={`${inter.variable} ${orbitron.variable}`}>
      <body className={`${inter.className} antialiased`}>
        <AppWrapper>{children}</AppWrapper>
      </body>
    </html>
  );
}