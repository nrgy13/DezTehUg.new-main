import { Metadata } from 'next';
import { PremiumHeroSection } from '@/components/services/PremiumHeroSection';
import { ProblemSection } from '@/components/services/ProblemSection';
import { SolutionSection } from '@/components/services/SolutionSection';
import { CTASection } from '@/components/services/CTASection';
import { FinalCTASection } from '@/components/services/FinalCTASection';
import { ServiceOrderSection } from '@/components/services/ServiceOrderSection';
import { deserpentationData } from '@/data/services/deserpentation';

export const metadata: Metadata = {
  title: deserpentationData.metadata.title,
  description: deserpentationData.metadata.description,
  keywords: deserpentationData.metadata.keywords,
  openGraph: {
    title: deserpentationData.metadata.title,
    description: deserpentationData.metadata.description,
    type: 'website',
    locale: 'ru_RU',
    url: '/services/deserpentation',
  },
  twitter: {
    card: 'summary_large_image',
    title: deserpentationData.metadata.title,
    description: deserpentationData.metadata.description,
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
    canonical: '/services/deserpentation',
  },
};

export default function DeserpentationPage() {
  return (
    <div className="service-deserpentation light-theme-page">
      <PremiumHeroSection
        title={deserpentationData.hero.title}
        subtitle={deserpentationData.hero.subtitle}
        description={deserpentationData.hero.description}
        features={deserpentationData.hero.features}
        ctaText={deserpentationData.hero.ctaText}
        ctaLink={deserpentationData.hero.ctaLink}
        accentColor={deserpentationData.hero.accentColor}
      />

      <ProblemSection data={deserpentationData.problem} />

      <SolutionSection data={deserpentationData.solution} />

      <CTASection data={deserpentationData.cta} />

      <FinalCTASection data={deserpentationData.finalCta} />

      <ServiceOrderSection 
        serviceName="Десерпентация" 
        accentColor={deserpentationData.hero.accentColor}
      />
    </div>
  );
}





<<<<<<< Current (Your changes)

=======
>>>>>>> Incoming (Background Agent changes)



