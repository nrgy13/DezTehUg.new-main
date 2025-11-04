'use client';

import { motion } from 'framer-motion';
import { CyberpunkButton } from '@/components/cyberpunk/CyberpunkButton';
import AnimatedIcon from '@/components/AnimatedIcon';
import { useState } from 'react';

interface PremiumHeroSectionProps {
  title: string;
  subtitle: string;
  description: string;
  features: string[];
  ctaText: string;
  ctaLink: string;
  accentColor: string;
}

export function PremiumHeroSection({
  title,
  subtitle,
  description,
  features,
  ctaText,
  ctaLink,
  accentColor
}: PremiumHeroSectionProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-gray-50 via-white to-gray-50">
      {/* Animated Background Gradient */}
      <motion.div
        className="absolute inset-0 opacity-30"
        animate={{
          background: [
            `radial-gradient(circle at 20% 50%, ${accentColor}15 0%, transparent 50%)`,
            `radial-gradient(circle at 80% 50%, ${accentColor}15 0%, transparent 50%)`,
            `radial-gradient(circle at 50% 20%, ${accentColor}15 0%, transparent 50%)`,
            `radial-gradient(circle at 20% 50%, ${accentColor}15 0%, transparent 50%)`,
          ],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />

      {/* Floating Particles */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: Math.random() * 4 + 2,
              height: Math.random() * 4 + 2,
              backgroundColor: accentColor,
              opacity: 0.3,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -30, 0],
              x: [0, Math.random() * 20 - 10, 0],
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: Math.random() * 3 + 2,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left Column - Text Content */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
            >
              {/* Badge */}
              <motion.div
                className="inline-flex items-center px-4 py-2 rounded-full mb-6 backdrop-blur-sm bg-white/80 border-2"
                style={{ borderColor: accentColor }}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
              >
                <motion.div
                  className="w-2 h-2 rounded-full mr-2"
                  style={{ backgroundColor: accentColor }}
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [1, 0.7, 1],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                  }}
                />
                <span className="text-sm font-semibold" style={{ color: accentColor }}>
                  Профессиональная дезинфекция
                </span>
              </motion.div>

              {/* Title */}
              <motion.h1
                className="text-5xl md:text-7xl font-bold mb-6 font-orbitron leading-tight"
                style={{
                  background: `linear-gradient(135deg, ${accentColor} 0%, ${accentColor}dd 100%)`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                {title}
              </motion.h1>

              {/* Subtitle */}
              <motion.h2
                className="text-2xl md:text-3xl mb-6 font-medium text-gray-800 font-orbitron"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                {subtitle}
              </motion.h2>

              {/* Description */}
              <motion.p
                className="text-lg md:text-xl text-gray-700 mb-8 leading-relaxed"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                {description}
              </motion.p>

              {/* Features */}
              <motion.div
                className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                {features.map((feature, index) => (
                  <motion.div
                    key={index}
                    className="flex items-center p-4 rounded-xl backdrop-blur-sm bg-white/60 border border-gray-200 hover:border-opacity-100 transition-all duration-300"
                    style={{
                      borderColor: `${accentColor}40`,
                    }}
                    whileHover={{
                      scale: 1.02,
                      borderColor: accentColor,
                      boxShadow: `0 4px 20px ${accentColor}20`,
                    }}
                  >
                    <motion.div
                      className="w-2 h-2 rounded-full mr-3 flex-shrink-0"
                      style={{ backgroundColor: accentColor }}
                      animate={{
                        scale: [1, 1.3, 1],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        delay: index * 0.2,
                      }}
                    />
                    <span className="text-gray-800 font-medium">{feature}</span>
                  </motion.div>
                ))}
              </motion.div>

              {/* CTA Button */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
              >
                <CyberpunkButton
                  href={ctaLink}
                  variant="primary"
                  size="lg"
                  className="text-lg px-8 py-4"
                  style={{ '--accent-color': accentColor } as React.CSSProperties}
                >
                  {ctaText}
                </CyberpunkButton>
              </motion.div>
            </motion.div>

            {/* Right Column - Animated Icon */}
            <motion.div
              className="relative flex items-center justify-center"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
            >
              {/* Glow Effect */}
              <motion.div
                className="absolute inset-0 rounded-full blur-3xl opacity-30"
                style={{ backgroundColor: accentColor }}
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.3, 0.5, 0.3],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                }}
              />

              {/* Icon Container */}
              <motion.div
                className="relative z-10"
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 300 }}
                onMouseEnter={() => setHoveredIndex(0)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <div className="w-64 h-64 md:w-80 md:h-80">
                  <AnimatedIcon
                    animationName="antibiotic.json"
                    className="w-full h-full"
                    isHovered={hoveredIndex === 0}
                  />
                </div>
              </motion.div>

              {/* Decorative Elements */}
              {[...Array(3)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute rounded-full"
                  style={{
                    width: 100 + i * 50,
                    height: 100 + i * 50,
                    border: `2px solid ${accentColor}`,
                    opacity: 0.1,
                  }}
                  animate={{
                    rotate: 360,
                    scale: [1, 1.1, 1],
                  }}
                  transition={{
                    duration: 10 + i * 2,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                />
              ))}
            </motion.div>
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
        animate={{
          y: [0, 10, 0],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
        }}
      >
        <div className="w-6 h-10 rounded-full border-2 flex items-start justify-center p-2" style={{ borderColor: accentColor }}>
          <motion.div
            className="w-1 h-3 rounded-full"
            style={{ backgroundColor: accentColor }}
            animate={{
              y: [0, 12, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
            }}
          />
        </div>
      </motion.div>
    </section>
  );
}

