import { MarketingNav } from '@/components/shared/MarketingNav';
import { MarketingFooter } from '@/components/shared/MarketingFooter';
import { Hero } from '@/components/landing/Hero';
import { PainPoint } from '@/components/landing/PainPoint';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { BeforeAfter } from '@/components/landing/BeforeAfter';
import { Comparison } from '@/components/landing/Comparison';
import { SocialProof } from '@/components/landing/SocialProof';
import { CTAFooter } from '@/components/landing/CTAFooter';

export default function HomePage() {
  return (
    <>
      <MarketingNav />
      <main>
        <Hero />
        <PainPoint />
        <HowItWorks />
        <BeforeAfter />
        <Comparison />
        <SocialProof />
        <CTAFooter />
      </main>
      <MarketingFooter />
    </>
  );
}
