import { Metadata } from 'next';
import { PremiumHeroSection } from '@/components/services/PremiumHeroSection';
import { ProblemSection } from '@/components/services/ProblemSection';
import { SolutionSection } from '@/components/services/SolutionSection';
import { CTASection } from '@/components/services/CTASection';
import { FinalCTASection } from '@/components/services/FinalCTASection';
import { ServiceOrderSection } from '@/components/services/ServiceOrderSection';
import { disinfectionData } from '@/data/services/disinfection';

export const metadata: Metadata = {
  title: disinfectionData.metadata.title,
  description: disinfectionData.metadata.description,
  keywords: disinfectionData.metadata.keywords,
  openGraph: {
    title: disinfectionData.metadata.title,
    description: disinfectionData.metadata.description,
    type: 'website',
    locale: 'ru_RU',
    url: '/services/disinfection',
  },
  twitter: {
    card: 'summary_large_image',
    title: disinfectionData.metadata.title,
    description: disinfectionData.metadata.description,
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
    canonical: '/services/disinfection',
  },
};

export default function DisinfectionPage() {
  return (
    <div className="service-disinfection light-theme-page">
      {/* Structured Data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Service",
            "name": "Дезинфекция",
            "description": disinfectionData.metadata.description,
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
            "serviceType": "Дезинфекция",
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

      {/* Premium Hero Section */}
      <PremiumHeroSection
        title={disinfectionData.hero.title}
        subtitle={disinfectionData.hero.subtitle}
        description={disinfectionData.hero.description}
        features={disinfectionData.hero.features}
        ctaText={disinfectionData.hero.ctaText}
        ctaLink={disinfectionData.hero.ctaLink}
        accentColor={disinfectionData.hero.accentColor}
      />

      {/* Problem Section */}
      <ProblemSection data={disinfectionData.problem} />

      {/* Solution Section */}
      <SolutionSection data={disinfectionData.solution} />

      {/* CTA Section */}
      <CTASection data={disinfectionData.cta} />

      {/* Final CTA Section */}
      <FinalCTASection data={disinfectionData.finalCta} />

      {/* Order Section */}
      <ServiceOrderSection 
        serviceName="Дезинфекция" 
        accentColor={disinfectionData.hero.accentColor}
      />
    </div>
  );
}