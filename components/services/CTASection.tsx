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
  return (
    <section
      className="py-20 relative overflow-hidden bg-gradient-to-r from-gray-50 via-white to-gray-50"
      style={{ '--accent-color': data.accentColor } as React.CSSProperties}
    >
      {/* Background Effects */}
      <div className="absolute inset-0 cyber-grid opacity-20"></div>
      
      {/* Animated Background Elements */}
      <motion.div
        className="absolute top-0 left-0 w-full h-2"
        style={{ backgroundColor: data.accentColor }}
        animate={{
          scaleX: [0, 1, 0],
          opacity: [0.5, 1, 0.5],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      
      <motion.div
        className="absolute bottom-0 right-0 w-full h-2"
        style={{ backgroundColor: data.accentColor }}
        animate={{
          scaleX: [0, 1, 0],
          opacity: [0.5, 1, 0.5],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1.5
        }}
      />

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Header */}
          <motion.div
            className="mb-12"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2
              className="text-4xl md:text-6xl font-bold mb-6 cyber-glow flame-title font-orbitron"
              style={{
                color: data.accentColor,
                textShadow: `0 0 10px rgba(255, 107, 53, 0.5), 0 0 20px rgba(255, 107, 53, 0.4)`
              }}
            >
              {data.title}
            </h2>
            <h3 className="text-2xl md:text-3xl text-gray-900 mb-8 font-medium font-orbitron tracking-tight">
              {data.subtitle}
            </h3>
            <p className="text-lg text-gray-800 leading-relaxed tracking-normal">
              {data.description}
            </p>
          </motion.div>

          {/* Features Grid */}
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            viewport={{ once: true }}
          >
            {data.features.map((feature, index) => (
              <motion.div
                key={index}
                className="cyber-card p-6 group hover:scale-105 transition-all duration-300"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                whileHover={{
                  boxShadow: `0 0 30px ${data.accentColor}40`,
                }}
              >
                <div 
                  className="w-6 h-6 rounded-full mx-auto mb-4 cyber-glow"
                  style={{ backgroundColor: data.accentColor }}
                />
                <p className="text-gray-700 font-medium text-sm">{feature}</p>
              </motion.div>
            ))}
          </motion.div>

          {/* Urgency Text */}
          {data.urgencyText && (
            <motion.div
              className="mb-8"
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              viewport={{ once: true }}
            >
              <div 
                className="cyber-card p-6 border-2 max-w-2xl mx-auto"
                style={{ borderColor: data.accentColor }}
              >
                <motion.div
                  className="flex items-center justify-center mb-4"
                  animate={{
                    scale: [1, 1.1, 1],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                >
                  <UrgentIcon accentColor={data.accentColor} />
                  <span
                    className="text-xl font-bold cyber-glow font-orbitron"
                    style={{ color: data.accentColor }}
                  >
                    СРОЧНО!
                  </span>
                </motion.div>
                <p className="text-gray-700 font-medium">{data.urgencyText}</p>
              </div>
            </motion.div>
          )}

          {/* Main CTA Button */}
          <motion.div
            className="mb-8"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            viewport={{ once: true }}
          >
            <CyberpunkButton
              href={data.ctaLink}
              variant="primary"
              size="xl"
              className="text-2xl px-16 py-6 relative overflow-hidden group"
              style={{ '--accent-color': data.accentColor } as React.CSSProperties}
            >
              <motion.span
                className="relative z-10"
                animate={{
                  textShadow: [
                    `0 0 10px ${data.accentColor}`,
                    `0 0 20px ${data.accentColor}`,
                    `0 0 10px ${data.accentColor}`,
                  ],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                {data.ctaText}
              </motion.span>
              
              {/* Button Animation Effect */}
              <motion.div
                className="absolute inset-0 opacity-0 group-hover:opacity-100"
                style={{
                  background: `linear-gradient(45deg, transparent, ${data.accentColor}20, transparent)`,
                }}
                animate={{
                  x: ['-100%', '100%'],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
            </CyberpunkButton>
          </motion.div>

          {/* Additional Info */}
          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            viewport={{ once: true }}
          >
            <div className="cyber-card p-4">
              <PhoneIcon accentColor={data.accentColor} />
              <p className="text-gray-700 text-sm">
                Бесплатная консультация
              </p>
            </div>
            
            <div className="cyber-card p-4">
              <ConsultationIcon accentColor={data.accentColor} />
              <p className="text-gray-700 text-sm">
                Выезд в день обращения
              </p>
            </div>
            
            <div className="cyber-card p-4">
              <GuaranteeIcon accentColor={data.accentColor} />
              <p className="text-gray-700 text-sm">
                Гарантия результата
              </p>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Floating Elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(15)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 rounded-full opacity-60"
            style={{ 
              backgroundColor: data.accentColor,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -50, 0],
              x: [0, Math.random() * 20 - 10, 0],
              opacity: [0.6, 1, 0.6],
              scale: [1, 1.5, 1],
            }}
            transition={{
              duration: 4 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
              ease: "easeInOut"
            }}
          />
        ))}
      </div>
    </section>
  );
}