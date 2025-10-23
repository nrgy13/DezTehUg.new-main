'use client';

import { motion } from 'framer-motion';
import { SolutionSectionProps } from '@/types/services';
import Image from 'next/image';
import { useState } from 'react';
import { Shield, Target, Zap, CheckCircle, Clock, Settings } from 'lucide-react';
import { WhyChooseUsIcon } from '@/components/WhyChooseUsIcon';

interface SolutionSectionComponentProps {
  data: SolutionSectionProps;
}

export function SolutionSection({ data }: SolutionSectionComponentProps) {
  return (
    <section
      className="py-20 relative overflow-hidden bg-gradient-to-b from-white via-gray-50 to-white"
      style={{ '--accent-color': data.accentColor } as React.CSSProperties}
    >
      {/* Background Elements */}
      <div className="absolute inset-0 cyber-grid opacity-20"></div>
      
      <div className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <h2
            className="text-4xl md:text-6xl font-bold mb-6 cyber-glow-muted flame-title font-orbitron"
            style={{
              color: data.accentColor,
              textShadow: '0 1px 2px rgba(0,0,0,0.7), 0 0 10px rgba(255, 107, 53, 0.4)'
            }}
          >
            {data.title}
          </h2>
          <h3 className="text-2xl md:text-3xl text-gray-800 mb-8 font-medium flame-subtitle font-orbitron tracking-tight leading-relaxed">
            {data.subtitle}
          </h3>
          <p className="text-lg text-gray-800 max-w-3xl mx-auto font-medium tracking-normal leading-snug">
            {data.description}
          </p>
        </motion.div>

        {/* Solution Steps */}
        <div className="max-w-6xl mx-auto mb-16">
          {data.steps.map((step, index) => (
            <motion.div
              key={index}
              className="flex flex-col lg:flex-row items-center mb-16 last:mb-0"
              initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: index * 0.2 }}
              viewport={{ once: true }}
            >
              {/* Step Number and Icon */}
              <div className={`lg:w-1/3 mb-8 lg:mb-0 ${index % 2 === 1 ? 'lg:order-2' : ''}`}>
                <motion.div
                  className="relative"
                  whileHover={{ scale: 1.05 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  {/* Step Number */}
                  <div 
                    className="absolute -top-4 -left-4 w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold cyber-glow z-10"
                    style={{ backgroundColor: data.accentColor }}
                  >
                    {step.step}
                  </div>
                  
                  {/* Icon Container */}
                  <div
                    className="w-32 h-32 rounded-2xl flex items-center justify-center mx-auto cyber-card"
                    style={{ backgroundColor: `${data.accentColor}10` }}
                  >
                    <div className="mx-auto" style={{ color: data.accentColor }}>
                      <StepIcon iconName={step.icon} accentColor={data.accentColor} />
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Step Content */}
              <div className={`lg:w-2/3 ${index % 2 === 1 ? 'lg:order-1 lg:pr-12' : 'lg:pl-12'}`}>
                <h4
                  className="text-2xl md:text-3xl font-bold mb-4 font-orbitron tracking-tight"
                  style={{
                    color: data.accentColor,
                    textShadow: `0 0 10px ${data.accentColor}60, 0 0 8px rgba(255, 107, 53, 0.4), 0 1px 2px rgba(0,0,0,0.3)`
                  }}
                >
                  {step.title}
                </h4>
                
                <p className="text-gray-800 text-lg mb-6 font-medium tracking-normal leading-snug">
                  {step.description}
                </p>

                {/* Step Details */}
                <div className="space-y-3">
                  {step.details.map((detail, detailIndex) => (
                    <motion.div
                      key={detailIndex}
                      className="flex items-start"
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.5, delay: (index * 0.2) + (detailIndex * 0.1) }}
                      viewport={{ once: true }}
                    >
                      <div 
                        className="w-2 h-2 rounded-full mt-2 mr-3 flex-shrink-0 cyber-glow"
                        style={{ backgroundColor: data.accentColor }}
                      />
                      <p className="text-gray-800 font-medium tracking-tight leading-relaxed">{detail}</p>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Connecting Line */}
              {index < data.steps.length - 1 && (
                <motion.div
                  className="hidden lg:block absolute left-1/2 transform -translate-x-1/2 w-px h-24 mt-32"
                  style={{ backgroundColor: `${data.accentColor}40` }}
                  initial={{ scaleY: 0 }}
                  whileInView={{ scaleY: 1 }}
                  transition={{ duration: 0.8, delay: (index * 0.2) + 0.5 }}
                  viewport={{ once: true }}
                />
              )}
            </motion.div>
          ))}
        </div>

        {/* WhyChooseUs Section - NEW SYSTEM */}
        {data.whyChooseUs && data.whyChooseUs.length > 0 && (
          <motion.div
            className="max-w-4xl mx-auto"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            viewport={{ once: true }}
          >
            <h4
              className="text-3xl font-bold text-center mb-12 font-orbitron tracking-tight"
              style={{
                color: data.accentColor,
                textShadow: `0 0 10px ${data.accentColor}60, 0 0 8px rgba(255, 107, 53, 0.4), 0 1px 2px rgba(0,0,0,0.3)`
              }}
            >
              Преимущества нашего подхода
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data.whyChooseUs.map((item, index) => (
                <motion.div
                  key={index}
                  className="cyber-card p-6 text-center group hover:scale-105 transition-all duration-300"
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  whileHover={{
                    boxShadow: `0 0 30px ${data.accentColor}40`,
                  }}
                >
                  <div className="mb-4">
                    <WhyChooseUsIconDynamic
                      iconPath={item.icon}
                      className="mx-auto h-12 w-12"
                      accentColor={data.accentColor}
                    />
                  </div>
                  <p className="text-gray-800 font-medium tracking-tight leading-relaxed">{item.title}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Benefits Section - LEGACY SYSTEM (fallback) */}
        {(!data.whyChooseUs || data.whyChooseUs.length === 0) && data.benefits && data.benefits.length > 0 && (
          <motion.div
            className="max-w-4xl mx-auto"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            viewport={{ once: true }}
          >
            <h4
              className="text-3xl font-bold text-center mb-12 font-orbitron tracking-tight"
              style={{
                color: data.accentColor,
                textShadow: `0 0 10px ${data.accentColor}60, 0 0 8px rgba(255, 107, 53, 0.4), 0 1px 2px rgba(0,0,0,0.3)`
              }}
            >
              Преимущества нашего подхода
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data.benefits.map((benefit, index) => (
                <motion.div
                  key={index}
                  className="cyber-card p-6 text-center group hover:scale-105 transition-all duration-300"
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  whileHover={{
                    boxShadow: `0 0 30px ${data.accentColor}40`,
                  }}
                >
                  <div
                    className="w-4 h-4 rounded-full mx-auto mb-4 cyber-glow"
                    style={{ backgroundColor: data.accentColor }}
                  />
                  <p className="text-gray-800 font-medium tracking-tight leading-relaxed">{benefit}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Process Guarantee */}
        <motion.div
          className="mt-16 text-center"
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          viewport={{ once: true }}
        >
          <div 
            className="cyber-card p-8 max-w-2xl mx-auto border-2"
            style={{ borderColor: data.accentColor }}
          >
            <motion.div
              className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center cyber-glow"
              style={{ backgroundColor: `${data.accentColor}20` }}
              animate={{
                rotate: [0, 360],
              }}
              transition={{
                duration: 10,
                repeat: Infinity,
                ease: "linear"
              }}
            >
              <ShieldIcon accentColor={data.accentColor} />
            </motion.div>
            
            <h5
              className="text-2xl font-bold mb-4 cyber-glow font-orbitron"
              style={{ color: data.accentColor }}
            >
              Гарантия качества
            </h5>
            
            <p className="text-gray-800 font-medium tracking-tight leading-relaxed">
              Мы гарантируем эффективность наших методов и предоставляем гарантию на все виды работ.
              Если проблема вернется в течение гарантийного периода - мы устраним её бесплатно!
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

interface StepIconProps {
  iconName: string;
  accentColor: string;
}

function StepIcon({ iconName, accentColor }: StepIconProps) {
  const [error, setError] = useState(false);

  // Lucide React fallback icons
  const getFallbackIcon = (name: string) => {
    switch (name) {
      case 'shield': return Shield;
      case 'target': return Target;
      case 'zap': return Zap;
      case 'check': return CheckCircle;
      case 'clock': return Clock;
      case 'settings': return Settings;
      default: return Target;
    }
  };

  if (error) {
    const FallbackIcon = getFallbackIcon(iconName);
    return (
      <FallbackIcon
        className="h-12 w-12"
        style={{ color: accentColor }}
      />
    );
  }

  return (
    <Image
      src={iconName} // Используем iconName напрямую, так как он уже содержит полный путь
      alt={iconName}
      width={48}
      height={48}
      className="h-12 w-12"
      // style={{ filter: `brightness(0) saturate(100%) invert(1)` }} // Удален фильтр инверсии
      onError={() => setError(true)}
    />
  );
}

interface ShieldIconProps {
  accentColor: string;
}

function ShieldIcon({ accentColor }: ShieldIconProps) {
  const [error, setError] = useState(false);

  if (error) {
    return (
      <Shield
        className="text-3xl"
        style={{ color: accentColor }}
      />
    );
  }

  return (
    <Image
      src="/icons/services/disinfection/shield-guarantee.svg"
      alt="Shield"
      width={32}
      height={32}
      className="text-3xl"
      // style={{ filter: `brightness(0) saturate(100%) invert(1)` }} // Удален фильтр инверсии
      onError={() => setError(true)}
    />
  );
}

interface WhyChooseUsIconDynamicProps {
  iconPath: string;
  className?: string;
  accentColor: string;
}

function WhyChooseUsIconDynamic({ iconPath, className = 'h-12 w-12', accentColor }: WhyChooseUsIconDynamicProps) {
  const [error, setError] = useState(false);

  // Fallback icon based on filename patterns
  const getFallbackIconFromPath = (path: string) => {
    if (path.includes('shield')) return Shield;
    if (path.includes('people') || path.includes('safe')) return CheckCircle;
    if (path.includes('bug') || path.includes('off')) return Target;
    if (path.includes('zap') || path.includes('light')) return Zap;
    if (path.includes('clock') || path.includes('time')) return Clock;
    if (path.includes('settings') || path.includes('gear')) return Settings;
    return Shield; // Default fallback
  };

  if (error) {
    const FallbackIcon = getFallbackIconFromPath(iconPath);
    return (
      <FallbackIcon
        className={className}
        style={{ color: accentColor }}
      />
    );
  }

  return (
    <Image
      src={iconPath}
      alt={iconPath.split('/').pop()?.replace('.svg', '') || 'icon'}
      width={48}
      height={48}
      className={className}
      style={{ filter: `hue-rotate(${accentColor === '#39FF14' ? '120deg' : accentColor === '#FF6B35' ? '20deg' : '0deg'})` }}
      onError={() => setError(true)}
    />
  );
}