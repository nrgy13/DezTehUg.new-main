import { EnhancedServiceMetadata } from '@/types/seo';

export const waterAnalysisSEO: EnhancedServiceMetadata = {
  title: "Анализ воды в Новороссийске - Лабораторные исследования | ДЕЗТЕХЮГ",
  description: "Профессиональный анализ воды в аккредитованной лаборатории ДЕЗТЕХЮГ в Новороссийске. Исследование по 30+ показателям, официальные протоколы. ☎️ +7 (861) 123-45-67",
  keywords: [
    "анализ воды Новороссийск",
    "исследование воды Новороссийск",
    "лабораторный анализ воды Новороссийск",
    "качество воды Новороссийск",
    "проверка воды Новороссийск",
    "анализ питьевой воды Новороссийск",
    "анализ воды Краснодарский край",
    "лаборатория воды",
    "проверка воды из скважины",
    "анализ водопроводной воды"
  ],

  openGraph: {
    title: "Анализ воды в Новороссийске - Профессиональные лабораторные исследования",
    description: "Убедитесь в безопасности вашей воды! Комплексный анализ по 30+ показателям в аккредитованной лаборатории, официальные протоколы.",
    images: [
      {
        url: "/images/og/water-analysis-novorossiysk.jpg",
        width: 1200,
        height: 630,
        alt: "Анализ воды в Новороссийске - ДЕЗТЕХЮГ"
      }
    ],
    url: "https://deztehug.ru/services/water-analysis",
    type: "website",
    locale: "ru_RU",
    siteName: "ДЕЗТЕХЮГ"
  },

  twitter: {
    card: "summary_large_image",
    title: "Анализ воды в Новороссийске | ДЕЗТЕХЮГ",
    description: "Профессиональные лабораторные исследования воды. Аккредитованная лаборатория, официальные протоколы.",
    images: ["/images/twitter/water-analysis-novorossiysk.jpg"],
    creator: "@deztehug"
  },

  structuredData: {
    service: {
      "@context": "https://schema.org",
      "@type": "Service",
      "name": "Анализ воды",
      "description": "Профессиональный анализ воды в аккредитованной лаборатории в Новороссийске и Краснодарском крае",
      "serviceType": "Анализ воды",
      "category": "Лабораторные исследования",
      "provider": {
        "@type": "LocalBusiness",
        "name": "ДЕЗТЕХЮГ",
        "url": "https://deztehug.ru",
        "telephone": "+7 (861) 123-45-67",
        "email": "lab@deztehug.ru",
        "address": {
          "@type": "PostalAddress",
          "addressLocality": "Новороссийск",
          "addressRegion": "Краснодарский край",
          "addressCountry": "RU"
        },
        "geo": {
          "@type": "GeoCoordinates",
          "latitude": "45.0355",
          "longitude": "38.9753"
        },
        "openingHours": "Mo-Fr 08:00-20:00, Sa 09:00-15:00",
        "priceRange": "$$"
      },
      "areaServed": [
        {
          "@type": "Place",
          "name": "Новороссийск"
        },
        {
          "@type": "Place",
          "name": "Краснодарский край"
        },
        {
          "@type": "Place",
          "name": "Сочи"
        },
        {
          "@type": "Place",
          "name": "Новороссийск"
        }
      ],
      "offers": {
        "@type": "Offer",
        "availability": "https://schema.org/InStock",
        "priceRange": "от 3000 рублей",
        "validFrom": "2025-01-01",
        "url": "/calculator"
      }
    },

    breadcrumb: {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Главная",
          "item": "https://deztehug.ru"
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "Услуги",
          "item": "https://deztehug.ru/services"
        },
        {
          "@type": "ListItem",
          "position": 3,
          "name": "Анализ воды",
          "item": "https://deztehug.ru/services/water-analysis"
        }
      ]
    }
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1
    }
  },

  canonical: "https://deztehug.ru/services/water-analysis",
  themeColor: "#0EA5E9",

  geoTags: {
    region: "RU-KDA",
    placename: "Новороссийск",
    position: "45.0355;38.9753",
    icbm: "45.0355, 38.9753"
  }
};