import { Metadata } from 'next';
import { AppWrapper } from '@/components/layout/AppWrapper';

export const metadata: Metadata = {
  title: 'Услуги ДЕЗТЕХЮГ - Профессиональная дезинфекция, дератизация, дезинсекция',
  description: 'Полный спектр санитарных услуг от ДЕЗТЕХЮГ: дератизация, дезинсекция, дезинфекция, анализ воды. Профессиональное оборудование, гарантия качества.',
  keywords: [
    'дезинфекция',
    'дератизация',
    'дезинсекция',
    'анализ воды',
    'санитарные услуги',
    'ДЕЗТЕХЮГ',
    'Москва'
  ],
  openGraph: {
    title: 'Услуги ДЕЗТЕХЮГ - Профессиональные санитарные услуги',
    description: 'Полный спектр санитарных услуг: дератизация, дезинсекция, дезинфекция, анализ воды. Гарантия качества, современное оборудование.',
    type: 'website',
    locale: 'ru_RU',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Услуги ДЕЗТЕХЮГ - Профессиональные санитарные услуги',
    description: 'Полный спектр санитарных услуг: дератизация, дезинсекция, дезинфекция, анализ воды.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: '/services',
  },
};

interface ServicesLayoutProps {
  children: React.ReactNode;
}

export default function ServicesLayout({ children }: ServicesLayoutProps) {
  return <>{children}</>;
}