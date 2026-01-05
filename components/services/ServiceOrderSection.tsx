'use client';

import { CyberpunkButton } from '@/components/cyberpunk/CyberpunkButton';

interface ServiceOrderSectionProps {
  serviceName: string;
  accentColor?: string;
}

export function ServiceOrderSection({ serviceName, accentColor }: ServiceOrderSectionProps) {
  return (
    <section className="py-20 bg-gradient-to-r from-poison-green/10 via-bg-secondary to-neon-orange/10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl md:text-4xl font-orbitron font-bold text-content-primary mb-6">
          Готовы заказать {serviceName}?
        </h2>
        <p className="text-xl text-content-secondary mb-8 leading-relaxed">
          Оставьте заявку, и наш менеджер свяжется с вами в ближайшее время
        </p>
        <CyberpunkButton
          href="/booking"
          variant="primary"
          size="lg"
          className="pulse-cta"
        >
          Оформить заявку
        </CyberpunkButton>
      </div>
    </section>
  );
}


