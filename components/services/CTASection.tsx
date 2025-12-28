'use client';

import { motion } from 'framer-motion';
import { CTASectionProps } from '@/types/services';
import { CyberpunkButton } from '@/components/cyberpunk/CyberpunkButton';
import Image from 'next/image';
import { useState } from 'react';
import { AlertTriangle, Phone, Calendar, Shield } from 'lucide-react';

interface CTASectionComponentProps {
  data: CTASectionProps;
}

// Embedded icon components
const UrgentIcon = ({ accentColor }: { accentColor: string }) => {
  const [error, setError] = useState(false);

  if (error) {
    return <AlertTriangle className="text-2xl mr-3" style={{ color: accentColor }} />;
  }

  return (
    <Image
      src="/icons/services/shared-cta-finalcta/urgent-cta.svg"
      alt="Срочно"
      width={24}
      height={24}
      className="mr-3"
      style={{ filter: `brightness(0) saturate(100%) hue-rotate(0deg)`, color: accentColor }}
      onError={() => setError(true)}
    />
  );
};

const PhoneIcon = ({ accentColor }: { accentColor: string }) => {
  const [error, setError] = useState(false);

  if (error) {
    return <Phone className="text-2xl mb-2 cyber-glow" style={{ color: accentColor }} />;
  }

  return (
    <Image
      src="/icons/services/shared-cta-finalcta/phone-cta.svg"
      alt="Телефон"
      width={24}
      height={24}
      className="mb-2 cyber-glow"
      style={{ filter: `brightness(0) saturate(100%) hue-rotate(0deg)`, color: accentColor }}
      onError={() => setError(true)}
    />
  );
};

const ConsultationIcon = ({ accentColor }: { accentColor: string }) => {
  const [error, setError] = useState(false);

  if (error) {
    return <Calendar className="text-2xl mb-2 cyber-glow" style={{ color: accentColor }} />;
  }

  return (
    <Image
      src="/icons/services/shared-cta-finalcta/consultation-cta.svg"
      alt="Консультация"
      width={24}
      height={24}
      className="mb-2 cyber-glow"
      style={{ filter: `brightness(0) saturate(100%) hue-rotate(0deg)`, color: accentColor }}
      onError={() => setError(true)}
    />
  );
};

const GuaranteeIcon = ({ accentColor }: { accentColor: string }) => {
  const [error, setError] = useState(false);

  if (error) {
    return <Shield className="text-2xl mb-2 cyber-glow" style={{ color: accentColor }} />;
  }

  return (
    <Image
      src="/icons/services/shared-cta-finalcta/guarantee-cta.svg"
      alt="Гарантия"
      width={24}
      height={24}
      className="mb-2 cyber-glow"
      style={{ filter: `brightness(0) saturate(100%) hue-rotate(0deg)`, color: accentColor }}
      onError={() => setError(true)}
    />
  );
};

export function CTASection({ data }: CTASectionComponentProps) {
  // Яркие цветные акценты для элементов
  const accentColors = ['#00FF00', '#0066FF', '#FF0000', '#FFD700'];
  
  return (
    <section
      className="py-20 relative overflow-hidden bg-gradient-to-br from-white via-gray-50 to-white"
      style={{ '--accent-color': data.accentColor } as React.CSSProperties}
    >
      {/* Animated Background Gradient */}
      <motion.div
        className="absolute inset-0 opacity-30"
        animate={{
          background: [
            `radial-gradient(circle at 50% 50%, ${data.accentColor}15 0%, transparent 60%)`,
            `radial-gradient(circle at 30% 70%, ${data.accentColor}15 0%, transparent 60%)`,
            `radial-gradient(circle at 50% 50%, ${data.accentColor}15 0%, transparent 60%)`,
          ],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      
      {/* Background Effects */}
      <div className="absolute inset-0 cyber-grid opacity-5"></div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Header */}
          <div className="mb-12">
            <h2
              className="text-4xl md:text-6xl font-bold mb-6 cyber-glow flame-title font-orbitron"
              style={{
                color: data.accentColor,
                textShadow: `0 0 10px rgba(255, 107, 53, 0.5), 0 0 20px rgba(255, 107, 53, 0.4)`
              }}
            >
              {data.title}
            </h2>
            <h3 
              className="text-2xl md:text-3xl mb-8 font-medium font-orbitron tracking-tight"
              style={{ color: data.accentColor }}
            >
              {data.subtitle}
            </h3>
            <p className="text-lg text-gray-800 leading-relaxed tracking-normal font-medium">
              {data.description}
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {data.features.map((feature, index) => {
              const markerColor = accentColors[index % accentColors.length];
              return (
              <div
                key={index}
                className="relative p-6 group rounded-xl backdrop-blur-sm bg-white/80 border-2 overflow-hidden"
                style={{
                  borderColor: `${markerColor}40`,
                  boxShadow: `0 8px 32px ${markerColor}15, 0 0 0 1px ${data.accentColor}10`
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = `0 12px 40px ${markerColor}30, 0 0 0 2px ${markerColor}60`;
                  e.currentTarget.style.borderColor = markerColor;
                  e.currentTarget.style.transform = 'scale(1.03)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = `0 8px 32px ${markerColor}15, 0 0 0 1px ${data.accentColor}10`;
                  e.currentTarget.style.borderColor = `${markerColor}40`;
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                {/* Gradient Overlay */}
                <motion.div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                  style={{
                    background: `linear-gradient(135deg, ${markerColor}05 0%, transparent 100%)`,
                  }}
                />
                <div className="relative z-10">
                <div 
                  className="w-6 h-6 rounded-full mx-auto mb-4 cyber-glow"
                  style={{ backgroundColor: markerColor }}
                />
                <p className="text-gray-800 font-medium text-sm leading-relaxed">{feature}</p>
                </div>
              </div>
              );
            })}
          </div>

          {/* Urgency Text */}
          {data.urgencyText && (
            <div className="mb-8">
              <motion.div 
                className="relative p-6 border-2 max-w-2xl mx-auto rounded-xl backdrop-blur-sm bg-gradient-to-br from-white/90 to-red-50/50 overflow-hidden"
                style={{ 
                  borderColor: '#FF000040',
                  boxShadow: `0 8px 32px rgba(255, 0, 0, 0.15), 0 0 0 1px ${data.accentColor}10`
                }}
                whileHover={{ scale: 1.02 }}
              >
                {/* Animated Background */}
                <motion.div
                  className="absolute inset-0 opacity-20"
                  style={{
                    background: `radial-gradient(circle at center, rgba(255, 0, 0, 0.1) 0%, transparent 70%)`,
                  }}
                  animate={{
                    scale: [1, 1.1, 1],
                    opacity: [0.2, 0.3, 0.2],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                  }}
                />
                <div className="relative z-10">
                <div className="flex items-center justify-center mb-4">
                  <UrgentIcon accentColor={data.accentColor} />
                  <span
                    className="text-xl font-bold cyber-glow font-orbitron"
                    style={{ color: data.accentColor }}
                  >
                    СРОЧНО!
                  </span>
                </div>
                <p className="text-gray-800 font-medium leading-relaxed">{data.urgencyText}</p>
              </div>
              </motion.div>
            </div>
          )}

          {/* Main CTA Button */}
          <div className="mb-8">
            <CyberpunkButton
              href={data.ctaLink}
              variant="primary"
              size="xl"
              className="text-2xl px-16 py-6 relative overflow-hidden group"
              style={{ '--accent-color': data.accentColor } as React.CSSProperties}
            >
              <span className="relative z-10">
                {data.ctaText}
              </span>
            </CyberpunkButton>
          </div>

          {/* Additional Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <div className="cyber-card p-4 border-4 bg-white" style={{ borderColor: '#00FF00', boxShadow: `0 4px 20px #00FF0030` }}>
              <PhoneIcon accentColor={data.accentColor} />
              <p className="text-gray-800 text-sm font-medium">
                Бесплатная консультация
              </p>
            </div>
            
            <div className="cyber-card p-4 border-4 bg-white" style={{ borderColor: '#0066FF', boxShadow: `0 4px 20px #0066FF30` }}>
              <ConsultationIcon accentColor={data.accentColor} />
              <p className="text-gray-800 text-sm font-medium">
                Выезд в день обращения
              </p>
            </div>
            
            <div className="cyber-card p-4 border-4 bg-white" style={{ borderColor: '#FFD700', boxShadow: `0 4px 20px #FFD70030` }}>
              <GuaranteeIcon accentColor={data.accentColor} />
              <p className="text-gray-800 text-sm font-medium">
                Гарантия результата
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}