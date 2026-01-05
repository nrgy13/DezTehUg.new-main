import { Metadata } from 'next';
import { PremiumHeroSection } from '@/components/services/PremiumHeroSection';
import { ProblemSection } from '@/components/services/ProblemSection';
import { SolutionSection } from '@/components/services/SolutionSection';
import { CTASection } from '@/components/services/CTASection';
import { FinalCTASection } from '@/components/services/FinalCTASection';
import { ServiceOrderSection } from '@/components/services/ServiceOrderSection';
import { herbicideTreatmentData } from '@/data/services/herbicide-treatment';

export const metadata: Metadata = {
  title: herbicideTreatmentData.metadata.title,
  description: herbicideTreatmentData.metadata.description,
  keywords: herbicideTreatmentData.metadata.keywords,
  openGraph: {
    title: herbicideTreatmentData.metadata.title,
    description: herbicideTreatmentData.metadata.description,
    type: 'website',
    locale: 'ru_RU',
    url: '/services/herbicide-treatment',
  },
  twitter: {
    card: 'summary_large_image',
    title: herbicideTreatmentData.metadata.title,
    description: herbicideTreatmentData.metadata.description,
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
    canonical: '/services/herbicide-treatment',
  },
};

export default function HerbicideTreatmentPage() {
  return (
    <div className="service-herbicide-treatment light-theme-page">
      <PremiumHeroSection
        title={herbicideTreatmentData.hero.title}
        subtitle={herbicideTreatmentData.hero.subtitle}
        description={herbicideTreatmentData.hero.description}
        features={herbicideTreatmentData.hero.features}
        ctaText={herbicideTreatmentData.hero.ctaText}
        ctaLink={herbicideTreatmentData.hero.ctaLink}
        accentColor={herbicideTreatmentData.hero.accentColor}
      />

      <ProblemSection data={herbicideTreatmentData.problem} />

      <SolutionSection data={herbicideTreatmentData.solution} />

      <CTASection data={herbicideTreatmentData.cta} />

      <FinalCTASection data={herbicideTreatmentData.finalCta} />

      <ServiceOrderSection 
        serviceName="Гербицидная обработка" 
        accentColor={herbicideTreatmentData.hero.accentColor}
      />
    </div>
  );
}

