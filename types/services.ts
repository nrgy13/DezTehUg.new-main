export interface HeroSectionProps {
  title: string;
  subtitle: string;
  description: string;
  features: string[];
  ctaText: string;
  ctaLink: string;
  backgroundImage?: string;
  accentColor: string;
}

export interface ProblemItem {
  icon: string;
  title: string;
  description: string;
  impact: string;
}

export interface ProblemSectionProps {
  title: string;
  subtitle: string;
  description: string;
  problems: ProblemItem[];
  accentColor: string;
}

export interface SolutionStep {
  step: number;
  title: string;
  description: string;
  icon: string;
  details: string[];
}

export interface WhyChooseUsItem {
  icon: string;
  title: string;
}

export interface SolutionSectionProps {
  title: string;
  subtitle: string;
  description: string;
  steps: SolutionStep[];
  benefits: string[];
  whyChooseUs?: WhyChooseUsItem[];
  accentColor: string;
}

export interface CTASectionProps {
  title: string;
  subtitle: string;
  description: string;
  features: string[];
  ctaText: string;
  ctaLink: string;
  urgencyText?: string;
  accentColor: string;
}

export interface FinalCTAProps {
  title: string;
  subtitle: string;
  description: string;
  ctaText: string;
  ctaLink: string;
  contactInfo: {
    phone: string;
    email: string;
    workingHours: string;
  };
  guarantees: string[];
  accentColor: string;
}

export interface ServicePageData {
  hero: HeroSectionProps;
  problem: ProblemSectionProps;
  solution: SolutionSectionProps;
  cta: CTASectionProps;
  finalCta: FinalCTAProps;
  metadata: {
    title: string;
    description: string;
    keywords: string[];
  };
}

export type ServiceType = 'deratization' | 'pest-control' | 'disinfection' | 'water-analysis';

export interface ServiceConfig {
  name: string;
  slug: string;
  accentColor: string;
  icon: string;
  description: string;
}