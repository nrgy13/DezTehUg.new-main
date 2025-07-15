'use client';

import { motion } from 'framer-motion';
import { FinalCTAProps } from '@/types/services';
import { CyberpunkButton } from '@/components/cyberpunk/CyberpunkButton';

interface FinalCTASectionComponentProps {
  data: FinalCTAProps;
}

export function FinalCTASection({ data }: FinalCTASectionComponentProps) {
  return (
    <section 
      className="py-20 relative overflow-hidden bg-gradient-to-b from-white via-gray-50 to-white"
      style={{ '--accent-color': data.accentColor } as React.CSSProperties}
    >
      {/* Background Effects */}
      <div className="absolute inset-0 cyber-grid opacity-20"></div>
      
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
              className="text-4xl md:text-6xl font-bold mb-6 cyber-glow"
              style={{ color: data.accentColor }}
            >
              {data.title}
            </h2>
            <h3 className="text-2xl md:text-3xl text-gray-700 mb-8 font-light">
              {data.subtitle}
            </h3>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto leading-relaxed">
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
              <div className="cyber-card p-8">
                <h4 
                  className="text-2xl font-bold mb-6 cyber-glow"
                  style={{ color: data.accentColor }}
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
                    <span 
                      className="text-xl"
                      style={{ color: data.accentColor }}
                    >
                      📞
                    </span>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Телефон</p>
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
                    <span 
                      className="text-xl"
                      style={{ color: data.accentColor }}
                    >
                      📧
                    </span>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Email</p>
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
                    <span 
                      className="text-xl"
                      style={{ color: data.accentColor }}
                    >
                      🕒
                    </span>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Режим работы</p>
                    <p className="text-lg font-medium text-gray-700">
                      {data.contactInfo.workingHours}
                    </p>
                  </div>
                </motion.div>
              </div>

              {/* Guarantees */}
              <motion.div
                className="cyber-card p-8"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.4 }}
                viewport={{ once: true }}
              >
                <h5 
                  className="text-xl font-bold mb-6 cyber-glow"
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
                      <p className="text-gray-700">{guarantee}</p>
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
                className="cyber-card p-12 border-2 relative overflow-hidden"
                style={{ borderColor: data.accentColor }}
              >
                {/* Animated Background */}
                <motion.div
                  className="absolute inset-0 opacity-10"
                  style={{
                    background: `radial-gradient(circle at center, ${data.accentColor}40, transparent)`,
                  }}
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.1, 0.2, 0.1],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                />

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
                  <span 
                    className="text-4xl"
                    style={{ color: data.accentColor }}
                  >
                    🎯
                  </span>
                </motion.div>

                <h4 
                  className="text-3xl font-bold mb-6 cyber-glow"
                  style={{ color: data.accentColor }}
                >
                  Получите расчет стоимости
                </h4>
                
                <p className="text-gray-700 mb-8 text-lg">
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
                    <span 
                      className="text-lg mr-2"
                      style={{ color: data.accentColor }}
                    >
                      ⚡
                    </span>
                    <span className="text-gray-600">Быстро</span>
                  </div>
                  <div className="flex items-center justify-center">
                    <span 
                      className="text-lg mr-2"
                      style={{ color: data.accentColor }}
                    >
                      🎯
                    </span>
                    <span className="text-gray-600">Точно</span>
                  </div>
                  <div className="flex items-center justify-center">
                    <span 
                      className="text-lg mr-2"
                      style={{ color: data.accentColor }}
                    >
                      💰
                    </span>
                    <span className="text-gray-600">Выгодно</span>
                  </div>
                  <div className="flex items-center justify-center">
                    <span 
                      className="text-lg mr-2"
                      style={{ color: data.accentColor }}
                    >
                      🛡️
                    </span>
                    <span className="text-gray-600">Надежно</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Floating Particles */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(25)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full"
            style={{ 
              backgroundColor: data.accentColor,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -100, 0],
              x: [0, Math.random() * 50 - 25, 0],
              opacity: [0, 1, 0],
              scale: [0, 1, 0],
            }}
            transition={{
              duration: 5 + Math.random() * 3,
              repeat: Infinity,
              delay: Math.random() * 3,
              ease: "easeInOut"
            }}
          />
        ))}
      </div>
    </section>
  );
}