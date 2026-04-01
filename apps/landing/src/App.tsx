import { Footer } from './components/Footer';
import { Navbar } from './components/Navbar';
import { LanguageProvider } from './i18n/context';
import { Benefits } from './sections/Benefits';
import { FAQ } from './sections/FAQ';
import { Features } from './sections/Features';
import { FinalCTA } from './sections/FinalCTA';
import { Hero } from './sections/Hero';
import { HowItWorks } from './sections/HowItWorks';
import { PainPoints } from './sections/PainPoints';
import { SocialProof } from './sections/SocialProof';
import { Solution } from './sections/Solution';

export function App() {
  return (
    <LanguageProvider>
      <Navbar />
      <main className="page-shell">
        <Hero />
        <PainPoints />
        <Solution />
        <Benefits />
        <Features />
        <HowItWorks />
        <SocialProof />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </LanguageProvider>
  );
}
