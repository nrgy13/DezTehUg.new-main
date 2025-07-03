import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

// Типы для частиц
interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  duration: number;
  delay: number;
  glowIntensity: number;
}

// Пропсы компонента
interface FloatingParticlesProps {
  particleCount?: number;
  className?: string;
  isLoadingScreen?: boolean; // Флаг для определения, используется ли компонент на загрузочном экране
}

// Основные цвета из проекта
const COLORS = {
  poisonGreen: '#39FF14',
  neonOrange: '#FF6B35',
  cyberBlue: '#1E40AF',
};

// Функция для генерации случайного числа в диапазоне
const randomRange = (min: number, max: number) => Math.random() * (max - min) + min;

export const FloatingParticles: React.FC<FloatingParticlesProps> = ({
  particleCount = 30, // Уменьшено с 50 до 30 для повышения производительности
  className = "",
  isLoadingScreen = false
}) => {
  // Генерируем частицы только один раз с помощью useMemo для оптимизации
  const particles = useMemo(() => {
    return Array.from({ length: particleCount }, (_, i) => {
      const colorWeights = [0.7, 0.2, 0.1]; // 70% poison-green, 20% neon-orange, 10% cyber-blue
      const rand = Math.random();
      let color = COLORS.poisonGreen;
      
      if (rand > colorWeights[0]) {
        color = rand > colorWeights[0] + colorWeights[1] ? COLORS.cyberBlue : COLORS.neonOrange;
      }

      // Создаем уникальные точки для движения каждой частицы
      const x = Math.random() * 100;
      const y = Math.random() * 100;
      
      // Генерируем случайные точки для траектории движения
      // Используем одинаковые параметры для Hero и загрузочного экрана
      const xRange = 40;
      const yRange = 30;
      
      const xPoints = [
        x,
        (x + randomRange(-xRange/2, xRange/2) + 100) % 100,
        (x + randomRange(-xRange, xRange) + 100) % 100,
        x
      ];
      
      const yPoints = [
        y,
        (y + randomRange(-yRange/2, yRange/2) + 100) % 100,
        (y + randomRange(-yRange, yRange) + 100) % 100,
        y
      ];

      return {
        id: i,
        x,
        y,
        xPoints,
        yPoints,
        size: Math.random() * 6 + 2, // 2-8px (уменьшен максимальный размер)
        color,
        duration: Math.random() * 15 + 15, // 15-30s (уменьшен диапазон для более предсказуемой анимации)
        delay: Math.random() * 5,
        glowIntensity: Math.random() * 0.6 + 0.4, // 0.4-1.0 (уменьшена интенсивность свечения)
      } as Particle & { xPoints: number[], yPoints: number[] };
    });
  }, [particleCount]);

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute rounded-full"
          style={{
            width: particle.size,
            height: particle.size,
            backgroundColor: particle.color,
            boxShadow: `0 0 ${particle.size * 1.5}px ${particle.color}${Math.floor(particle.glowIntensity * 255).toString(16).padStart(2, '0')}`,
            filter: `blur(${particle.size * 0.05}px)`, // Уменьшено размытие для лучшей производительности
          }}
          initial={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            opacity: isLoadingScreen ? 0 : 0.8,
            scale: isLoadingScreen ? 0 : 1,
          }}
          animate={{
            left: [
              `${particle.xPoints[0]}%`,
              `${particle.xPoints[1]}%`,
              `${particle.xPoints[2]}%`,
              `${particle.xPoints[3]}%`,
            ],
            top: [
              `${particle.yPoints[0]}%`,
              `${particle.yPoints[1]}%`,
              `${particle.yPoints[2]}%`,
              `${particle.yPoints[3]}%`,
            ],
            opacity: [0, 0.8, 0.3, 0.8, 0],
            scale: [0, 1, 0.7, 1, 0],
          }}
          transition={{
            duration: particle.duration,
            delay: particle.delay,
            repeat: Infinity,
            ease: "linear",
            times: [0, 0.25, 0.5, 0.75, 1],
          }}
        />
      ))}
      
      {/* Дополнительные мерцающие частицы для атмосферы - отображаются только не на загрузочном экране */}
      {!isLoadingScreen && Array.from({ length: Math.floor(particleCount * 0.2) }, (_, i) => { // Уменьшено с 0.3 до 0.2
        const twinkleParticle = {
          id: i + particleCount,
          x: Math.random() * 100,
          y: Math.random() * 100,
          size: Math.random() * 3 + 1,
          color: COLORS.poisonGreen,
          duration: Math.random() * 5 + 5,
          delay: Math.random() * 5,
        };

        return (
          <motion.div
            key={`twinkle-${twinkleParticle.id}`}
            className="absolute rounded-full"
            style={{
              width: twinkleParticle.size,
              height: twinkleParticle.size,
              backgroundColor: twinkleParticle.color,
              boxShadow: `0 0 ${twinkleParticle.size * 2}px ${twinkleParticle.color}`, // Уменьшено свечение
              left: `${twinkleParticle.x}%`,
              top: `${twinkleParticle.y}%`,
            }}
            initial={{
              opacity: 0.6,
              scale: 0.9
            }}
            animate={{
              opacity: [0.6, 0.3, 0.6, 0.8, 0.6, 0.3, 0.6],
              scale: [0.6, 0.8, 0.9, 1.0, 0.9, 0.8, 0.6],
            }}
            transition={{
              duration: twinkleParticle.duration,
              delay: twinkleParticle.delay,
              repeat: Infinity,
              ease: "linear",
              times: [0, 0.15, 0.3, 0.5, 0.7, 0.85, 1],
            }}
          />
        );
      })}
    </div>
  );
};