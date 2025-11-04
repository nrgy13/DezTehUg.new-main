'use client';

import { motion } from 'framer-motion';
import { ProblemSectionProps } from '@/types/services';
import { ProblemIcon } from '@/components/ProblemIcon';
import Image from 'next/image';
import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ProblemSectionComponentProps {
  data: ProblemSectionProps;
}

export function ProblemSection({ data }: ProblemSectionComponentProps) {
  // Яркие цветные акценты для элементов
  const accentColors = ['#00FF00', '#0066FF', '#FF0000', '#FFD700'];
  
  return (
    <section 
      className="py-20 relative overflow-hidden bg-gradient-to-b from-white via-gray-50 to-white"
      style={{ '--accent-color': data.accentColor } as React.CSSProperties}
    >
      {/* Animated Background Gradient */}
      <motion.div
        className="absolute inset-0 opacity-20"
        animate={{
          background: [
            `radial-gradient(circle at 10% 20%, ${data.accentColor}10 0%, transparent 50%)`,
            `radial-gradient(circle at 90% 80%, ${data.accentColor}10 0%, transparent 50%)`,
            `radial-gradient(circle at 10% 20%, ${data.accentColor}10 0%, transparent 50%)`,
          ],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      
      {/* Background Elements */}
      <div className="absolute inset-0 cyber-grid opacity-5"></div>

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
          <h3 
            className="text-2xl md:text-3xl mb-8 font-medium font-orbitron"
            style={{ color: data.accentColor }}
          >
            {data.subtitle}
          </h3>
          <p className="text-lg text-gray-800 max-w-3xl mx-auto font-medium leading-relaxed tracking-tight">
            {data.description}
          </p>
        </motion.div>

        {/* Problems Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {data.problems.map((problem, index) => {
            const markerColor = accentColors[index % accentColors.length];
            return (
            <motion.div
              key={index}
              className="relative p-8 group rounded-2xl backdrop-blur-sm bg-white/80 border-2 overflow-hidden"
              style={{
                borderColor: `${markerColor}40`,
                boxShadow: `0 8px 32px ${markerColor}15, 0 0 0 1px ${data.accentColor}10`
              }}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
              whileHover={{ 
                scale: 1.02,
                boxShadow: `0 12px 40px ${markerColor}30, 0 0 0 2px ${markerColor}60`,
                borderColor: markerColor,
              }}
            >
              {/* Gradient Overlay on Hover */}
              <motion.div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                style={{
                  background: `linear-gradient(135deg, ${markerColor}05 0%, transparent 100%)`,
                }}
              />
              
              {/* Content Wrapper */}
              <div className="relative z-10">
                {/* Problem Icon */}
                <div className="flex items-center mb-6">
                  <div className="mr-4">
                    <ProblemIcon
                      src={problem.icon}
                      alt={problem.title}
                      color={data.accentColor}
                    />
                  </div>
                  <h4
                    className="text-xl font-bold font-orbitron tracking-tight"
                    style={{
                      color: data.accentColor,
                      textShadow: `0 0 8px ${data.accentColor}80, 0 0 10px rgba(255, 107, 53, 0.5)`
                    }}
                  >
                    {problem.title}
                  </h4>
                </div>

                {/* Problem Description */}
                <p className="text-gray-800 mb-6 font-medium leading-relaxed tracking-tight">
                  {problem.description}
                </p>

                {/* Impact */}
                <div 
                  className="border-l-4 pl-4 py-2"
                  style={{ borderColor: markerColor }}
                >
                  <p className="text-sm text-gray-800 mb-1 uppercase tracking-wider font-medium">
                    Последствия:
                  </p>
                  <p 
                    className="font-semibold"
                    style={{ color: data.accentColor }}
                  >
                    {problem.impact}
                  </p>
                </div>
              </div>
            </motion.div>
            );
          })}
        </div>

        {/* Warning Banner */}
        <motion.div
          className="mt-16 max-w-4xl mx-auto"
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          viewport={{ once: true }}
        >
          <div 
            className="relative p-8 text-center rounded-2xl backdrop-blur-sm bg-gradient-to-br from-white/90 to-red-50/50 border-2 overflow-hidden"
            style={{ 
              borderColor: '#FF000040',
              boxShadow: `0 8px 32px rgba(255, 0, 0, 0.15), 0 0 0 1px ${data.accentColor}10`
            }}
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
            <motion.div
              className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center cyber-glow"
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
              <WarningIcon accentColor={data.accentColor} />
            </motion.div>
            
            <h4 
              className="text-2xl font-bold mb-4 cyber-glow"
              style={{ color: data.accentColor }}
            >
              Не откладывайте решение проблемы!
            </h4>
            
            <p className="text-gray-800 text-lg font-medium leading-snug">
              Каждый день промедления усугубляет ситуацию и увеличивает стоимость решения проблемы.
              Обратитесь к профессионалам ДЕЗТЕХЮГ уже сегодня!
            </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

interface WarningIconProps {
  accentColor: string;
}

function WarningIcon({ accentColor }: WarningIconProps) {
  const [error, setError] = useState(false);

  if (error) {
    return (
      <AlertTriangle
        className="text-2xl"
        style={{ color: accentColor }}
      />
    );
  }

  return (
    <Image
      src="/icons/services/shared-problem/warning.svg"
      alt="Warning"
      width={24}
      height={24}
      className="text-2xl"
      style={{ color: accentColor }}
      onError={() => setError(true)}
    />
  );
}