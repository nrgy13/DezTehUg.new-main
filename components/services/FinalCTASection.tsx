'use client';

import { motion } from 'framer-motion';
import { FinalCTAProps } from '@/types/services';
import { CyberpunkButton } from '@/components/cyberpunk/CyberpunkButton';
import MoleculeAnimation from '../MoleculeAnimation';
import Image from 'next/image';
import { useState } from 'react';
import { Phone, Mail, Clock, Target, Zap, DollarSign, Shield } from 'lucide-react';

interface FinalCTASectionComponentProps {
  data: FinalCTAProps;
}

// Contact icons component
function ContactIcon({ type, accentColor }: { type: 'phone' | 'email' | 'hours'; accentColor: string }) {
  const [error, setError] = useState(false);

  const iconMap = {
    phone: { path: '/icons/services/shared-cta-finalcta/phone-cta.svg', fallback: Phone },
    email: { path: '/icons/services/shared-cta-finalcta/email-finalcta.svg', fallback: Mail },
    hours: { path: '/icons/services/shared-cta-finalcta/clock-finalcta.svg', fallback: Clock }
  };

  const { path, fallback: FallbackIcon } = iconMap[type];

  if (error) {
    return <FallbackIcon size={20} style={{ color: accentColor }} />;
  }

  return (
    <Image
      src={path}
      alt={type}
      width={20}
      height={20}
      style={{
        filter: `brightness(0) saturate(100%) hue-rotate(0deg)`,
        color: accentColor
      }}
      onError={() => setError(true)}
    />
  );
}

// Target icon component for main CTA
function TargetIcon({ accentColor }: { accentColor: string }) {
  const [error, setError] = useState(false);

  if (error) {
    return <Target size={48} style={{ color: accentColor }} />;
  }

  return (
    <Image
      src="/icons/services/shared-cta-finalcta/target-finalcta.svg"
      alt="target"
      width={48}
      height={48}
      style={{
        filter: `brightness(0) saturate(100%) hue-rotate(0deg)`,
        color: accentColor
      }}
      onError={() => setError(true)}
    />
  );
}

// Benefits icons component
function BenefitIcon({ type, accentColor }: { type: 'fast' | 'target' | 'money' | 'shield'; accentColor: string }) {
  const [error, setError] = useState(false);

  const iconMap = {
    fast: { path: '/icons/services/shared-cta-finalcta/fast-finalcta.svg', fallback: Zap },
    target: { path: '/icons/services/shared-cta-finalcta/accurate-finalcta.svg', fallback: Target },
    money: { path: '/icons/services/shared-cta-finalcta/money-finalcta.svg', fallback: DollarSign },
    shield: { path: '/icons/services/shared-cta-finalcta/shield-finalcta.svg', fallback: Shield }
  };

  const { path, fallback: FallbackIcon } = iconMap[type];

  if (error) {
    return <FallbackIcon size={18} style={{ color: accentColor }} />;
  }

  return (
    <Image
      src={path}
      alt={type}
      width={18}
      height={18}
      style={{
        filter: `brightness(0) saturate(100%) hue-rotate(0deg)`,
        color: accentColor
      }}
      onError={() => setError(true)}
    />
  );
}

export function FinalCTASection({ data }: FinalCTASectionComponentProps) {
  return (
    <section 
      className="py-20 relative overflow-hidden bg-white"
      style={{ '--accent-color': data.accentColor } as React.CSSProperties}
    >
      {/* Background Effects */}
      <div className="absolute inset-0 cyber-grid opacity-10"></div>
      
      {/* Animated Border */}
      <motion.div
        className="absolute inset-0 border-4 border-transparent"
        style={{
          borderImage: `linear-gradient(45deg, transparent, ${data.accentColor}, transparent) 1`,
        }}
        animate={{
          borderImageSource: [
            `linear-gradient(45deg, transparent, ${data.accentColor}40, transparent)`,
            `linear-gradient(45deg, ${data.accentColor}40, transparent, ${data.accentColor}40)`,
            `linear-gradient(45deg, transparent, ${data.accentColor}40, transparent)`,
          ],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-5xl mx-auto">
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
                textShadow: '0 1px 2px rgba(0,0,0,0.7)'
              }}
            >
              {data.title}
            </h2>
            <h3 className="text-2xl md:text-3xl text-gray-800 mb-8 font-medium font-orbitron tracking-normal" style={{ lineHeight: '1.6' }}>
              {data.subtitle}
            </h3>
            <p className="text-lg text-gray-800 max-w-3xl mx-auto font-medium tracking-normal" style={{ lineHeight: '1.8', fontWeight: '500' }}>
              {data.description}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Contact Information */}
            <motion.div
              className="space-y-8"
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              viewport={{ once: true }}
            >
              <div className="cyber-card p-8 border-4 bg-white" style={{ borderColor: '#0066FF', boxShadow: `0 4px 20px #0066FF30` }}>
                <h4
                  className="text-2xl font-bold mb-6 cyber-glow-muted font-orbitron"
                  style={{
                    color: data.accentColor,
                    textShadow: '0 1px 2px rgba(0,0,0,0.7)'
                  }}
                >
                  Свяжитесь с нами прямо сейчас
                </h4>
                
                {/* Phone */}
                <motion.div
                  className="flex items-center mb-6 group cursor-pointer"
                  whileHover={{ scale: 1.02 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center mr-4 cyber-glow"
                    style={{ backgroundColor: `${data.accentColor}20` }}
                  >
                    <ContactIcon type="phone" accentColor={data.accentColor} />
                  </div>
                  <div>
                    <p className="text-gray-800 text-sm font-medium">Телефон</p>
                    <p 
                      className="text-xl font-bold group-hover:cyber-glow transition-all duration-300"
                      style={{ color: data.accentColor }}
                    >
                      {data.contactInfo.phone}
                    </p>
                  </div>
                </motion.div>

                {/* Email */}
                <motion.div
                  className="flex items-center mb-6 group cursor-pointer"
                  whileHover={{ scale: 1.02 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center mr-4 cyber-glow"
                    style={{ backgroundColor: `${data.accentColor}20` }}
                  >
                    <ContactIcon type="email" accentColor={data.accentColor} />
                  </div>
                  <div>
                    <p className="text-gray-800 text-sm font-medium">Email</p>
                    <p 
                      className="text-lg font-medium group-hover:cyber-glow transition-all duration-300"
                      style={{ color: data.accentColor }}
                    >
                      {data.contactInfo.email}
                    </p>
                  </div>
                </motion.div>

                {/* Working Hours */}
                <motion.div
                  className="flex items-center"
                  whileHover={{ scale: 1.02 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center mr-4 cyber-glow"
                    style={{ backgroundColor: `${data.accentColor}20` }}
                  >
                    <ContactIcon type="hours" accentColor={data.accentColor} />
                  </div>
                  <div>
                    <p className="text-gray-800 text-sm font-medium">Режим работы</p>
                    <p className="text-lg font-medium text-gray-800">
                      {data.contactInfo.workingHours}
                    </p>
                  </div>
                </motion.div>
              </div>

              {/* Guarantees */}
              <motion.div
                className="cyber-card p-8 border-4 bg-white"
                style={{ borderColor: '#00FF00', boxShadow: `0 4px 20px #00FF0030` }}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.4 }}
                viewport={{ once: true }}
              >
                <h5
                  className="text-xl font-bold mb-6 cyber-glow font-orbitron"
                  style={{ color: data.accentColor }}
                >
                  Наши гарантии
                </h5>
                
                <div className="space-y-4">
                  {data.guarantees.map((guarantee, index) => (
                    <motion.div
                      key={index}
                      className="flex items-start"
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.5, delay: 0.4 + (index * 0.1) }}
                      viewport={{ once: true }}
                    >
                      <div 
                        className="w-3 h-3 rounded-full mt-1.5 mr-3 flex-shrink-0 cyber-glow"
                        style={{ backgroundColor: data.accentColor }}
                      />
                      <p className="text-gray-800 font-medium tracking-normal" style={{ lineHeight: '1.6', fontWeight: '500' }}>{guarantee}</p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </motion.div>

            {/* CTA Section */}
            <motion.div
              className="text-center"
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              viewport={{ once: true }}
            >
              <div 
                className="cyber-card p-12 border-4 relative overflow-hidden bg-white"
                style={{ 
                  borderColor: '#FF0000',
                  boxShadow: `0 4px 20px #FF000030, 0 0 0 1px ${data.accentColor}20`
                }}
              >

                {/* Pulsing Icon */}
                <motion.div
                  className="w-24 h-24 rounded-full mx-auto mb-8 flex items-center justify-center cyber-glow"
                  style={{ backgroundColor: `${data.accentColor}20` }}
                  animate={{
                    scale: [1, 1.1, 1],
                    boxShadow: [
                      `0 0 20px ${data.accentColor}40`,
                      `0 0 40px ${data.accentColor}60`,
                      `0 0 20px ${data.accentColor}40`,
                    ],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                >
                  <TargetIcon accentColor={data.accentColor} />
                </motion.div>

                <h4
                  className="text-3xl font-bold mb-6 cyber-glow font-orbitron"
                  style={{ color: data.accentColor }}
                >
                  Получите расчет стоимости
                </h4>
                
                <p className="text-gray-800 mb-8 text-lg font-medium tracking-normal">
                  Узнайте точную стоимость услуг за 2 минуты с помощью нашего калькулятора
                </p>

                {/* Main CTA Button */}
                <CyberpunkButton
                  href={data.ctaLink}
                  variant="primary"
                  size="xl"
                  className="text-2xl px-12 py-6 mb-6 relative overflow-hidden group w-full"
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
                </CyberpunkButton>

                {/* Additional Benefits */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center justify-center">
                    <BenefitIcon
                      type="fast"
                      accentColor={data.accentColor}
                    />
                    <span className="text-gray-800 font-medium ml-2">Быстро</span>
                  </div>
                  <div className="flex items-center justify-center">
                    <BenefitIcon
                      type="target"
                      accentColor={data.accentColor}
                    />
                    <span className="text-gray-800 font-medium ml-2">Точно</span>
                  </div>
                  <div className="flex items-center justify-center">
                    <BenefitIcon
                      type="money"
                      accentColor={data.accentColor}
                    />
                    <span className="text-gray-800 font-medium ml-2">Выгодно</span>
                  </div>
                  <div className="flex items-center justify-center">
                    <BenefitIcon
                      type="shield"
                      accentColor={data.accentColor}
                    />
                    <span className="text-gray-800 font-medium ml-2">Надежно</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Molecule Animation */}
      <MoleculeAnimation accentColor={data.accentColor} count={12} />
    </section>
  );
}