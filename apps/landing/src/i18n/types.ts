export type Locale = 'ar' | 'en';
export type Dir = 'rtl' | 'ltr';

export interface LinkItem {
  label: string;
  href: string;
}

export interface MetricItem {
  value: string;
  label: string;
  detail?: string;
}

export interface SectionHeading {
  eyebrow: string;
  title: string;
  description: string;
}

export interface NavContent {
  links: LinkItem[];
  primaryCta: string;
  whatsappCta: string;
}

export interface HeroTableItem {
  name: string;
  state: string;
  tone: 'steady' | 'busy' | 'alert';
}

export interface HeroQueueItem {
  title: string;
  station: string;
  time: string;
  tone: 'steady' | 'warm' | 'alert';
}

export interface HeroOrbitItem {
  title: string;
  value: string;
}

export interface HeroStageContent {
  eyebrow: string;
  title: string;
  description: string;
  floorLabel: string;
  queueLabel: string;
  reportLabel: string;
  tables: HeroTableItem[];
  queue: HeroQueueItem[];
  report: MetricItem[];
}

export interface HeroContent {
  badge: string;
  title: string;
  accent: string;
  description: string;
  primaryCta: string;
  secondaryCta: string;
  trustItems: string[];
  metrics: MetricItem[];
  stage: HeroStageContent;
  orbit: HeroOrbitItem[];
}

export interface PainItem {
  title: string;
  description: string;
  signal: string;
}

export interface PillarItem {
  title: string;
  description: string;
  stat: string;
}

export interface SolutionContent extends SectionHeading {
  pillars: PillarItem[];
  railTitle: string;
  railItems: string[];
  railCaption: string;
}

export interface BenefitItem {
  title: string;
  description: string;
  value: string;
}

export interface BenefitsContent extends SectionHeading {
  items: BenefitItem[];
  highlight: MetricItem;
}

export interface FeatureItem {
  eyebrow: string;
  title: string;
  description: string;
  meta: string;
}

export interface FeaturesContent extends SectionHeading {
  items: FeatureItem[];
}

export interface StepItem {
  title: string;
  description: string;
  detail: string;
}

export interface HowItWorksContent extends SectionHeading {
  steps: StepItem[];
  supportTitle: string;
  supportDescription: string;
  supportPoints: string[];
}

export interface Testimonial {
  quote: string;
  author: string;
  role: string;
  outcome: string;
}

export interface SocialProofContent extends SectionHeading {
  stats: MetricItem[];
  sectors: string[];
  testimonials: Testimonial[];
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface FaqContent extends SectionHeading {
  items: FaqItem[];
  asideTitle: string;
  asideDescription: string;
  asidePoints: string[];
}

export interface FinalCtaContent {
  eyebrow: string;
  title: string;
  description: string;
  primaryCta: string;
  secondaryCta: string;
  confidencePoints: string[];
}

export interface FooterContent {
  tagline: string;
  quickLinksLabel: string;
  contactLabel: string;
  legal: string;
  whatsappLabel: string;
  emailLabel: string;
}

export interface ContentMap {
  brand: {
    name: string;
    descriptor: string;
  };
  nav: NavContent;
  hero: HeroContent;
  pain: SectionHeading & { items: PainItem[] };
  solution: SolutionContent;
  benefits: BenefitsContent;
  features: FeaturesContent;
  howItWorks: HowItWorksContent;
  socialProof: SocialProofContent;
  faq: FaqContent;
  finalCta: FinalCtaContent;
  footer: FooterContent;
}
