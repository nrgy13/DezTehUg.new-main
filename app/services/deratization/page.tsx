import { Metadata } from 'next';
import { HeroSection } from '@/components/services/HeroSection';
import { ProblemSection } from '@/components/services/ProblemSection';
import { SolutionSection } from '@/components/services/SolutionSection';
import { CTASection } from '@/components/services/CTASection';
import { FinalCTASection } from '@/components/services/FinalCTASection';
import { ServiceOrderSection } from '@/components/services/ServiceOrderSection';
import { deratizationData } from '@/data/services/deratization';

export const metadata: Metadata = {
  title: deratizationData.metadata.title,
  description: deratizationData.metadata.description,
  keywords: deratizationData.metadata.keywords,
  openGraph: {
    title: deratizationData.metadata.title,
    description: deratizationData.metadata.description,
    type: 'website',
    locale: 'ru_RU',
    url: '/services/deratization',
  },
  twitter: {
    card: 'summary_large_image',
    title: deratizationData.metadata.title,
    description: deratizationData.metadata.description,
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
    canonical: '/services/deratization',
  },
};

export default function DeratizationPage() {
  return (
    <div className="service-deratization">
      {/* Structured Data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Service",
            "name": "Дератизация",
            "description": deratizationData.metadata.description,
            "provider": {
              "@type": "Organization",
              "name": "ДЕЗТЕХЮГ",
              "url": "https://deztehug.ru",
              "telephone": "+7 (495) 123-45-67",
              "address": {
                "@type": "PostalAddress",
                "addressLocality": "Москва",
                "addressCountry": "RU"
              }
            },
            "areaServed": {
              "@type": "Place",
              "name": "Москва и Московская область"
            },
            "serviceType": "Дератизация",
            "category": "Санитарные услуги",
            "offers": {
              "@type": "Offer",
              "availability": "https://schema.org/InStock",
              "priceRange": "$$",
              "validFrom": new Date().toISOString(),
              "url": "/booking"
            }
          })
        }}
      />

      {/* Hero Section */}
      <HeroSection data={deratizationData.hero} />

      {/* Problem Section */}
      <ProblemSection data={deratizationData.problem} />

      {/* Solution Section */}
      <SolutionSection data={deratizationData.solution} />

      {/* CTA Section */}
      <CTASection data={deratizationData.cta} />

      {/* Final CTA Section */}
      <FinalCTASection data={deratizationData.finalCta} />

      {/* Order Section */}
      <ServiceOrderSection 
        serviceName="Дератизация" 
        accentColor={deratizationData.hero.accentColor}
      />
    </div>
  );
}