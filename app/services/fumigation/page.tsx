import { Metadata } from 'next';
import { PremiumHeroSection } from '@/components/services/PremiumHeroSection';
import { ProblemSection } from '@/components/services/ProblemSection';
import { SolutionSection } from '@/components/services/SolutionSection';
import { CTASection } from '@/components/services/CTASection';
import { FinalCTASection } from '@/components/services/FinalCTASection';
import { fumigationData } from '@/data/services/fumigation';

export const metadata: Metadata = {
  title: fumigationData.metadata.title,
  description: fumigationData.metadata.description,
  keywords: fumigationData.metadata.keywords,
  openGraph: {
    title: fumigationData.metadata.title,
    description: fumigationData.metadata.description,
    type: 'website',
    locale: 'ru_RU',
    url: '/services/fumigation',
  },
  twitter: {
    card: 'summary_large_image',
    title: fumigationData.metadata.title,
    description: fumigationData.metadata.description,
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
    canonical: '/services/fumigation',
  },
};

export default function FumigationPage() {
  return (
    <div className="service-fumigation light-theme-page">
      <PremiumHeroSection
        title={fumigationData.hero.title}
        subtitle={fumigationData.hero.subtitle}
        description={fumigationData.hero.description}
        features={fumigationData.hero.features}
        ctaText={fumigationData.hero.ctaText}
        ctaLink={fumigationData.hero.ctaLink}
        accentColor={fumigationData.hero.accentColor}
      />

      <ProblemSection data={fumigationData.problem} />

      <SolutionSection data={fumigationData.solution} />

      <CTASection data={fumigationData.cta} />

      <FinalCTASection data={fumigationData.finalCta} />
    </div>
  );
}

