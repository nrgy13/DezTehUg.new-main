'use client';

import { motion } from 'framer-motion';
import { SolutionSectionProps } from '@/types/services';

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
                    <span 
                      className="text-4xl"
                      style={{ color: data.accentColor }}
                    >
                      {step.icon}
                    </span>
                  </div>
                </motion.div>
              </div>

              {/* Step Content */}
              <div className={`lg:w-2/3 ${index % 2 === 1 ? 'lg:order-1 lg:pr-12' : 'lg:pl-12'}`}>
                <h4 
                  className="text-2xl md:text-3xl font-bold mb-4 cyber-glow"
                  style={{ color: data.accentColor }}
                >
                  {step.title}
                </h4>
                
                <p className="text-gray-700 text-lg mb-6 leading-relaxed">
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
                      <p className="text-gray-600">{detail}</p>
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

        {/* Benefits Section */}
        <motion.div
          className="max-w-4xl mx-auto"
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          viewport={{ once: true }}
        >
          <h4 
            className="text-3xl font-bold text-center mb-12 cyber-glow"
            style={{ color: data.accentColor }}
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
                <p className="text-gray-700 font-medium">{benefit}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

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
              <span 
                className="text-3xl"
                style={{ color: data.accentColor }}
              >
                🛡️
              </span>
            </motion.div>
            
            <h5 
              className="text-2xl font-bold mb-4 cyber-glow"
              style={{ color: data.accentColor }}
            >
              Гарантия качества
            </h5>
            
            <p className="text-gray-700">
              Мы гарантируем эффективность наших методов и предоставляем гарантию на все виды работ.
              Если проблема вернется в течение гарантийного периода - мы устраним её бесплатно!
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}