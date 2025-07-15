import { EnhancedServiceMetadata } from '@/types/seo';

export const pestControlSEO: EnhancedServiceMetadata = {
  title: "Дезинсекция в Новороссийске - Уничтожение насекомых | ДЕЗТЕХЮГ",
  description: "Профессиональная дезинсекция в Новороссийске от ДЕЗТЕХЮГ. Уничтожение тараканов, клопов, муравьев с гарантией. Безопасные методы, выезд 24/7. ☎️ +7 (861) 123-45-67",
  keywords: [
    "дезинсекция Новороссийск",
    "уничтожение тараканов Новороссийск",
    "уничтожение клопов Новороссийск",
    "борьба с насекомыми Новороссийск",
    "травля тараканов Новороссийск",
    "дезинсекция Краснодарский край",
    "обработка от насекомых Новороссийск",
    "санитарная обработка",
    "служба дезинсекции",
    "профессиональная дезинсекция"
  ],

  openGraph: {
    title: "Дезинсекция в Новороссийске - Профессиональное уничтожение насекомых",
    description: "Избавьтесь от тараканов, клопов и других насекомых навсегда! Современные препараты, гарантия результата, выезд 24/7 по Новороссийску.",
    images: [
      {
        url: "/images/og/pest-control-novorossiysk.jpg",
        width: 1200,
        height: 630,
        alt: "Дезинсекция в Новороссийске - ДЕЗТЕХЮГ"
      }
    ],
    url: "https://deztehug.ru/services/pest-control",
    type: "website",
    locale: "ru_RU",
    siteName: "ДЕЗТЕХЮГ"
  },

  twitter: {
    card: "summary_large_image",
    title: "Дезинсекция в Новороссийске | ДЕЗТЕХЮГ",
    description: "Профессиональное уничтожение насекомых с гарантией. Экологически безопасные препараты.",
    images: ["/images/twitter/pest-control-novorossiysk.jpg"],
    creator: "@deztehug"
  },

  structuredData: {
    service: {
      "@context": "https://schema.org",
      "@type": "Service",
      "name": "Дезинсекция",
      "description": "Профессиональное уничтожение насекомых в Новороссийске и Краснодарском крае",
      "serviceType": "Дезинсекция",
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
        "priceRange": "от 1500 рублей",
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
          "name": "Дезинсекция",
          "item": "https://deztehug.ru/services/pest-control"
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

  canonical: "https://deztehug.ru/services/pest-control",
  themeColor: "#39FF14",

  geoTags: {
    region: "RU-KDA",
    placename: "Новороссийск",
    position: "45.0355;38.9753",
    icbm: "45.0355, 38.9753"
  }
};