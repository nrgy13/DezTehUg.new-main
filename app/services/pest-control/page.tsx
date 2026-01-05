import { Metadata } from 'next';
import { HeroSection } from '@/components/services/HeroSection';
import { ProblemSection } from '@/components/services/ProblemSection';
import { SolutionSection } from '@/components/services/SolutionSection';
import { CTASection } from '@/components/services/CTASection';
import { FinalCTASection } from '@/components/services/FinalCTASection';
import { ServiceOrderSection } from '@/components/services/ServiceOrderSection';
import { pestControlData } from '@/data/services/pest-control';

export const metadata: Metadata = {
  title: pestControlData.metadata.title,
  description: pestControlData.metadata.description,
  keywords: pestControlData.metadata.keywords,
  openGraph: {
    title: pestControlData.metadata.title,
    description: pestControlData.metadata.description,
    type: 'website',
    locale: 'ru_RU',
    url: '/services/pest-control',
  },
  twitter: {
    card: 'summary_large_image',
    title: pestControlData.metadata.title,
    description: pestControlData.metadata.description,
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
    canonical: '/services/pest-control',
  },
};

export default function PestControlPage() {
  return (
    <div className="service-pest-control">
      {/* Structured Data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Service",
            "name": "Дезинсекция",
            "description": pestControlData.metadata.description,
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
            "serviceType": "Дезинсекция",
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
      <HeroSection data={pestControlData.hero} />

      {/* Problem Section */}
      <ProblemSection data={pestControlData.problem} />

      {/* Solution Section */}
      <SolutionSection data={pestControlData.solution} />

      {/* CTA Section */}
      <CTASection data={pestControlData.cta} />

      {/* Final CTA Section */}
      <FinalCTASection data={pestControlData.finalCta} />

      {/* Order Section */}
      <ServiceOrderSection 
        serviceName="Дезинсекция" 
        accentColor={pestControlData.hero.accentColor}
      />
    </div>
  );
}