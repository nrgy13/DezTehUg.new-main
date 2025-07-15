'use client';

import { motion } from 'framer-motion';
import { ProblemSectionProps } from '@/types/services';

interface ProblemSectionComponentProps {
  data: ProblemSectionProps;
}

export function ProblemSection({ data }: ProblemSectionComponentProps) {
  return (
    <section 
      className="py-20 relative overflow-hidden"
      style={{ '--accent-color': data.accentColor } as React.CSSProperties}
    >
      {/* Background Elements */}
      <div className="absolute inset-0 bg-gradient-to-b from-gray-50 to-white"></div>
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

        {/* Problems Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {data.problems.map((problem, index) => (
            <motion.div
              key={index}
              className="cyber-card p-8 group hover:scale-105 transition-all duration-300"
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
              whileHover={{ 
                boxShadow: `0 0 30px ${data.accentColor}40`,
              }}
            >
              {/* Problem Icon */}
              <div className="flex items-center mb-6">
                <div 
                  className="w-16 h-16 rounded-lg flex items-center justify-center mr-4 cyber-glow"
                  style={{ backgroundColor: `${data.accentColor}20` }}
                >
                  <span 
                    className="text-2xl"
                    style={{ color: data.accentColor }}
                  >
                    {problem.icon}
                  </span>
                </div>
                <h4 
                  className="text-xl font-bold cyber-glow"
                  style={{ color: data.accentColor }}
                >
                  {problem.title}
                </h4>
              </div>

              {/* Problem Description */}
              <p className="text-gray-700 mb-6 leading-relaxed">
                {problem.description}
              </p>

              {/* Impact */}
              <div 
                className="border-l-4 pl-4 py-2"
                style={{ borderColor: data.accentColor }}
              >
                <p className="text-sm text-gray-600 mb-1 uppercase tracking-wide">
                  Последствия:
                </p>
                <p 
                  className="font-semibold"
                  style={{ color: data.accentColor }}
                >
                  {problem.impact}
                </p>
              </div>

              {/* Hover Effect */}
              <motion.div
                className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                style={{
                  background: `linear-gradient(45deg, transparent, ${data.accentColor}10, transparent)`,
                }}
              />
            </motion.div>
          ))}
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
            className="cyber-card p-8 text-center border-2"
            style={{ borderColor: data.accentColor }}
          >
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
              <span 
                className="text-2xl"
                style={{ color: data.accentColor }}
              >
                ⚠️
              </span>
            </motion.div>
            
            <h4 
              className="text-2xl font-bold mb-4 cyber-glow"
              style={{ color: data.accentColor }}
            >
              Не откладывайте решение проблемы!
            </h4>
            
            <p className="text-gray-700 text-lg">
              Каждый день промедления усугубляет ситуацию и увеличивает стоимость решения проблемы.
              Обратитесь к профессионалам ДЕЗТЕХЮГ уже сегодня!
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}