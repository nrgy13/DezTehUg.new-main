import { EnhancedServiceMetadata } from '@/types/seo';

export const disinfectionSEO: EnhancedServiceMetadata = {
  title: "Дезинфекция в Новороссийске - Уничтожение вирусов и бактерий | ДЕЗТЕХЮГ",
  description: "Профессиональная дезинфекция в Новороссийске от ДЕЗТЕХЮГ. Уничтожение 99.9% патогенных микроорганизмов. Лабораторный контроль, документы. ☎️ +7 (861) 123-45-67",
  keywords: [
    "дезинфекция Новороссийск",
    "обеззараживание Новороссийск",
    "дезинфекция помещений Новороссийск",
    "санитарная обработка Новороссийск",
    "уничтожение вирусов Новороссийск",
    "дезинфекция Краснодарский край",
    "обеззараживание офисов",
    "антивирусная обработка",
    "служба дезинфекции",
    "профессиональная дезинфекция"
  ],

  openGraph: {
    title: "Дезинфекция в Новороссийске - Профессиональное обеззараживание",
    description: "Защитите свой бизнес от инфекций! Уничтожение 99.9% вирусов и бактерий, лабораторный контроль качества, официальные документы.",
    images: [
      {
        url: "/images/og/disinfection-novorossiysk.jpg",
        width: 1200,
        height: 630,
        alt: "Дезинфекция в Новороссийске - ДЕЗТЕХЮГ"
      }
    ],
    url: "https://deztehug.ru/services/disinfection",
    type: "website",
    locale: "ru_RU",
    siteName: "ДЕЗТЕХЮГ"
  },

  twitter: {
    card: "summary_large_image",
    title: "Дезинфекция в Новороссийске | ДЕЗТЕХЮГ",
    description: "Профессиональное обеззараживание с лабораторным контролем. Уничтожение 99.9% патогенов.",
    images: ["/images/twitter/disinfection-novorossiysk.jpg"],
    creator: "@deztehug"
  },

  structuredData: {
    service: {
      "@context": "https://schema.org",
      "@type": "Service",
      "name": "Дезинфекция",
      "description": "Профессиональная дезинфекция и обеззараживание в Новороссийске и Краснодарском крае",
      "serviceType": "Дезинфекция",
      "category": "Санитарные услуги",
      "provider": {
        "@type": "LocalBusiness",
        "name": "ДЕЗТЕХЮГ",
        "url": "https://deztehug.ru",
        "telephone": "+7 (861) 123-45-67",
        "email": "info@deztehug.ru",
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
        "openingHours": "Mo-Su 00:00-23:59",
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
        "priceRange": "от 2500 рублей",
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
          "name": "Дезинфекция",
          "item": "https://deztehug.ru/services/disinfection"
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

  canonical: "https://deztehug.ru/services/disinfection",
  themeColor: "#FF6B35",

  geoTags: {
    region: "RU-KDA",
    placename: "Новороссийск",
    position: "45.0355;38.9753",
    icbm: "45.0355, 38.9753"
  }
};