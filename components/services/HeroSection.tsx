'use client';

import { motion } from 'framer-motion';
import { HeroSectionProps } from '@/types/services';
import { CyberpunkButton } from '@/components/cyberpunk/CyberpunkButton';
import MoleculeAnimation from '@/components/MoleculeAnimation';

interface HeroSectionComponentProps {
  data: HeroSectionProps;
}

export function HeroSection({ data }: HeroSectionComponentProps) {
  // Яркие цветные акценты для элементов
  const accentColors = ['#00FF00', '#0066FF', '#FF0000', '#FF6B35', '#FFD700'];
  
  return (
    <section
      className="relative min-h-screen pt-20 flex items-center justify-center overflow-hidden bg-white"
      style={{ '--accent-color': data.accentColor } as React.CSSProperties}
    >
      {/* Cyber Grid Background */}
      <div className="absolute inset-0 cyber-grid opacity-10"></div>
      

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Title */}
          <motion.h1
            className="text-5xl md:text-7xl font-bold mb-6 cyber-glow-muted flame-title font-orbitron"
            style={{
              color: data.accentColor,
              textShadow: '0 1px 2px rgba(0,0,0,0.7)'
            }}
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            {data.title}
          </motion.h1>

          {/* Subtitle */}
          <motion.h2
            className="text-2xl md:text-3xl mb-8 font-medium flame-subtitle font-orbitron leading-relaxed tracking-wide"
            style={{ color: data.accentColor }}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            {data.subtitle}
          </motion.h2>

          {/* Description */}
          <motion.p
            className="text-lg md:text-xl text-gray-800 mb-12 max-w-3xl mx-auto font-medium leading-relaxed tracking-normal"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            {data.description}
          </motion.p>

          {/* Features */}
          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
          >
            {data.features.map((feature, index) => {
              const markerColor = accentColors[index % accentColors.length];
              return (
                <motion.div
                  key={index}
                  className="cyber-card p-6 text-center border-4 relative bg-white"
                  style={{ 
                    borderColor: markerColor,
                    borderTopColor: markerColor,
                    borderRightColor: markerColor,
                    borderBottomColor: markerColor,
                    borderLeftColor: markerColor,
                    boxShadow: `0 4px 20px ${markerColor}30, 0 0 0 1px ${data.accentColor}20`
                  }}
                  whileHover={{ scale: 1.05, boxShadow: `0 8px 30px ${markerColor}50` }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <div 
                    className="w-4 h-4 rounded-full mx-auto mb-3 cyber-glow"
                    style={{ backgroundColor: markerColor }}
                  />
                  <p className="text-gray-800 font-medium flame-feature leading-normal tracking-normal">{feature}</p>
                </motion.div>
              );
            })}
          </motion.div>

          {/* CTA Button */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
          >
            <CyberpunkButton
              href={data.ctaLink}
              variant="primary"
              size="lg"
              className="text-xl px-12 py-4"
              style={{ '--accent-color': data.accentColor } as React.CSSProperties}
            >
              {data.ctaText}
            </CyberpunkButton>
          </motion.div>
        </div>
      </div>

      {/* Molecule Animation */}
      <MoleculeAnimation
        accentColor={data.accentColor}
        count={8}
      />
    </section>
  );
}