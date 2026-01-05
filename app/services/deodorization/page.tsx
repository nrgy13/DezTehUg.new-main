import { Metadata } from 'next';
import { PremiumHeroSection } from '@/components/services/PremiumHeroSection';
import { ProblemSection } from '@/components/services/ProblemSection';
import { SolutionSection } from '@/components/services/SolutionSection';
import { CTASection } from '@/components/services/CTASection';
import { FinalCTASection } from '@/components/services/FinalCTASection';
import { ServiceOrderSection } from '@/components/services/ServiceOrderSection';
import { deodorizationData } from '@/data/services/deodorization';

export const metadata: Metadata = {
  title: deodorizationData.metadata.title,
  description: deodorizationData.metadata.description,
  keywords: deodorizationData.metadata.keywords,
  openGraph: {
    title: deodorizationData.metadata.title,
    description: deodorizationData.metadata.description,
    type: 'website',
    locale: 'ru_RU',
    url: '/services/deodorization',
  },
  twitter: {
    card: 'summary_large_image',
    title: deodorizationData.metadata.title,
    description: deodorizationData.metadata.description,
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
    canonical: '/services/deodorization',
  },
};

export default function DeodorizationPage() {
  return (
    <div className="service-deodorization light-theme-page">
      <PremiumHeroSection
        title={deodorizationData.hero.title}
        subtitle={deodorizationData.hero.subtitle}
        description={deodorizationData.hero.description}
        features={deodorizationData.hero.features}
        ctaText={deodorizationData.hero.ctaText}
        ctaLink={deodorizationData.hero.ctaLink}
        accentColor={deodorizationData.hero.accentColor}
      />

      <ProblemSection data={deodorizationData.problem} />

      <SolutionSection data={deodorizationData.solution} />

      <CTASection data={deodorizationData.cta} />

      <FinalCTASection data={deodorizationData.finalCta} />

      <ServiceOrderSection 
        serviceName="Дезодорация" 
        accentColor={deodorizationData.hero.accentColor}
      />
    </div>
  );
}





<<<<<<< Current (Your changes)

=======
>>>>>>> Incoming (Background Agent changes)



