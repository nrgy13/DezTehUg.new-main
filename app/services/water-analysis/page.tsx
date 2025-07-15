import { Metadata } from 'next';
import { HeroSection } from '@/components/services/HeroSection';
import { ProblemSection } from '@/components/services/ProblemSection';
import { SolutionSection } from '@/components/services/SolutionSection';
import { CTASection } from '@/components/services/CTASection';
import { FinalCTASection } from '@/components/services/FinalCTASection';
import { waterAnalysisData } from '@/data/services/water-analysis';

export const metadata: Metadata = {
  title: waterAnalysisData.metadata.title,
  description: waterAnalysisData.metadata.description,
  keywords: waterAnalysisData.metadata.keywords,
  openGraph: {
    title: waterAnalysisData.metadata.title,
    description: waterAnalysisData.metadata.description,
    type: 'website',
    locale: 'ru_RU',
    url: '/services/water-analysis',
  },
  twitter: {
    card: 'summary_large_image',
    title: waterAnalysisData.metadata.title,
    description: waterAnalysisData.metadata.description,
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
    canonical: '/services/water-analysis',
  },
};

export default function WaterAnalysisPage() {
  return (
    <div className="service-water-analysis">
      {/* Structured Data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Service",
            "name": "Анализ воды",
            "description": waterAnalysisData.metadata.description,
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
            "serviceType": "Анализ воды",
            "category": "Лабораторные исследования",
            "offers": {
              "@type": "Offer",
              "availability": "https://schema.org/InStock",
              "priceRange": "$$",
              "validFrom": new Date().toISOString(),
              "url": "/calculator"
            }
          })
        }}
      />

      {/* Hero Section */}
      <HeroSection data={waterAnalysisData.hero} />

      {/* Problem Section */}
      <ProblemSection data={waterAnalysisData.problem} />

      {/* Solution Section */}
      <SolutionSection data={waterAnalysisData.solution} />

      {/* CTA Section */}
      <CTASection data={waterAnalysisData.cta} />

      {/* Final CTA Section */}
      <FinalCTASection data={waterAnalysisData.finalCta} />
    </div>
  );
}