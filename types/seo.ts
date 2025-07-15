export interface SEOImage {
  url: string;
  width: number;
  height: number;
  alt: string;
}

export interface OpenGraphMetadata {
  title: string;
  description: string;
  images: SEOImage[];
  url: string;
  type: string;
  locale: string;
  siteName: string;
}

export interface TwitterMetadata {
  card: string;
  title: string;
  description: string;
  images: string[];
  creator?: string;
}

export interface ServiceSchema {
  "@context": string;
  "@type": string;
  name: string;
  description: string;
  serviceType: string;
  category: string;
  provider: {
    "@type": string;
    name: string;
    url: string;
    telephone: string;
    email: string;
    address: {
      "@type": string;
      addressLocality: string;
      addressRegion: string;
      addressCountry: string;
    };
    geo: {
      "@type": string;
      latitude: string;
      longitude: string;
    };
    openingHours: string;
    priceRange: string;
  };
  areaServed: Array<{
    "@type": string;
    name: string;
  }>;
  offers: {
    "@type": string;
    availability: string;
    priceRange: string;
    validFrom: string;
    url: string;
  };
}

export interface BreadcrumbSchema {
  "@context": string;
  "@type": string;
  itemListElement: Array<{
    "@type": string;
    position: number;
    name: string;
    item: string;
  }>;
}

export interface StructuredData {
  service: ServiceSchema;
  breadcrumb: BreadcrumbSchema;
}

export interface RobotsMetadata {
  index: boolean;
  follow: boolean;
  googleBot: {
    index: boolean;
    follow: boolean;
    "max-video-preview": number;
    "max-image-preview": string;
    "max-snippet": number;
  };
}

export interface EnhancedServiceMetadata {
  title: string;
  description: string;
  keywords: string[];
  openGraph: OpenGraphMetadata;
  twitter: TwitterMetadata;
  structuredData: StructuredData;
  robots: RobotsMetadata;
  canonical: string;
  themeColor: string;
  geoTags: {
    region: string;
    placename: string;
    position: string;
    icbm: string;
  };
}