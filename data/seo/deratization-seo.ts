import { EnhancedServiceMetadata } from '@/types/seo';

export const deratizationSEO: EnhancedServiceMetadata = {
  title: "Дератизация в Новороссийске - Уничтожение крыс и мышей | ДЕЗТЕХЮГ",
  description: "Профессиональная дератизация в Новороссийске от ДЕЗТЕХЮГ. Уничтожение грызунов с гарантией до 12 месяцев. Безопасные методы, выезд в день обращения. ☎️ +7 (861) 123-45-67",
  keywords: [
    "дератизация Новороссийск",
    "уничтожение крыс Новороссийск",
    "уничтожение мышей Новороссийск",
    "борьба с грызунами Новороссийск",
    "травля крыс Новороссийск",
    "дератизация Краснодарский край",
    "санэпидемстанция Новороссийск",
    "дезинфекция от грызунов",
    "служба дератизации",
    "профессиональная дератизация"
  ],

  openGraph: {
    title: "Дератизация в Новороссийске - Профессиональное уничтожение грызунов",
    description: "Избавьтесь от крыс и мышей навсегда! Гарантия до 12 месяцев, безопасные препараты, выезд в день обращения по Новороссийску.",
    images: [
      {
        url: "/images/og/deratization-novorossiysk.jpg",
        width: 1200,
        height: 630,
        alt: "Дератизация в Новороссийске - ДЕЗТЕХЮГ"
      }
    ],
    url: "https://deztehug.ru/services/deratization",
    type: "website",
    locale: "ru_RU",
    siteName: "ДЕЗТЕХЮГ"
  },

  twitter: {
    card: "summary_large_image",
    title: "Дератизация в Новороссийске | ДЕЗТЕХЮГ",
    description: "Профессиональное уничтожение грызунов с гарантией. Безопасно для людей и животных.",
    images: ["/images/twitter/deratization-novorossiysk.jpg"],
    creator: "@deztehug"
  },

  structuredData: {
    service: {
      "@context": "https://schema.org",
      "@type": "Service",
      "name": "Дератизация",
      "description": "Профессиональное уничтожение грызунов в Новороссийске",
      "serviceType": "Дератизация",
      "category": "Санитарные услуги",
      "provider": {
        "@type": "LocalBusiness",
        "name": "ДЕЗТЕХЮГ",
        "url": "https://deztehug.ru",
        "telephone": "8-988-331-33-32",
        "email": "deztexug@yandex.ru",
        "address": {
          "@type": "PostalAddress",
          "addressLocality": "Новороссийск",
          "addressRegion": "Краснодарский край",
          "addressCountry": "RU"
        },
        "geo": {
          "@type": "GeoCoordinates",
          "latitude": "44.7230",
          "longitude": "37.7686"
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
          "name": "Новороссийск"
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
        "priceRange": "от 2000 рублей",
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
          "name": "Дератизация",
          "item": "https://deztehug.ru/services/deratization"
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

  canonical: "https://deztehug.ru/services/deratization",
  themeColor: "#1E40AF",

  geoTags: {
    region: "RU-KDA",
    placename: "Новороссийск",
    position: "44.7230;37.7686",
    icbm: "44.7230, 37.7686"
  }
};