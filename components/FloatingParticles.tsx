'use client';

import React, { useState, useEffect } from 'react';
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
  xPoints: number[];
  yPoints: number[];
}

// Пропсы компонента
interface FloatingParticlesProps {
  particleCount?: number;
  className?: string;
  isLoadingScreen?: boolean; // Флаг для определения, используется ли компонент на загрузочном экране
  strategy?: 'client-only' | 'deterministic-ssr';
}

// Основные цвета из проекта
const COLORS = {
  poisonGreen: '#39FF14',
  neonOrange: '#FF6B35',
  cyberBlue: '#1E40AF',
};

// Функция для генерации случайного числа в диапазоне
const randomRange = (min: number, max: number) => Math.random() * (max - min) + min;

// Детерминированный PRNG для SSR-совпадения при необходимости
function makeRng(seedInit = 1234567) {
  let seed = seedInit >>> 0;
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

export const FloatingParticles: React.FC<FloatingParticlesProps> = ({
  particleCount = 30, // Уменьшено с 50 до 30 для повышения производительности
  className = "",
  isLoadingScreen = false,
  strategy = 'client-only',
}) => {
  const [mounted, setMounted] = useState(strategy === 'deterministic-ssr');
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (strategy === 'client-only') {
      // Генерируем частицы только на клиенте после монтирования — исключаем SSR/CSR рассинхрон
      const rng = makeRng(987654321);
      const generated = Array.from({ length: particleCount }, (_, i) => {
        const colorWeights = [0.7, 0.2, 0.1];
        const rand = rng();
        let color = COLORS.poisonGreen;
        if (rand > colorWeights[0]) {
          color = rand > colorWeights[0] + colorWeights[1] ? COLORS.cyberBlue : COLORS.neonOrange;
        }

        const x = rng() * 100;
        const y = rng() * 100;

        const xRange = 40;
        const yRange = 30;

        const rr = (min: number, max: number) => rng() * (max - min) + min;

        const xPoints = [
          x,
          (x + rr(-xRange / 2, xRange / 2) + 100) % 100,
          (x + rr(-xRange, xRange) + 100) % 100,
          x,
        ];

        const yPoints = [
          y,
          (y + rr(-yRange / 2, yRange / 2) + 100) % 100,
          (y + rr(-yRange, yRange) + 100) % 100,
          y,
        ];

        return {
          id: i,
          x,
          y,
          xPoints,
          yPoints,
          size: rng() * 6 + 2,
          color,
          duration: rng() * 15 + 15,
          delay: rng() * 5,
          glowIntensity: rng() * 0.6 + 0.4,
        } as Particle;
      });

      setParticles(generated);
      setMounted(true);
      return;
    }

    // deterministic-ssr: генерируем одинаково и на клиенте, и на сервере (если потребуется SSR)
    const rng = makeRng(1234567);
    const generated = Array.from({ length: particleCount }, (_, i) => {
      const colorWeights = [0.7, 0.2, 0.1];
      const rand = rng();
      let color = COLORS.poisonGreen;
      if (rand > colorWeights[0]) {
        color = rand > colorWeights[0] + colorWeights[1] ? COLORS.cyberBlue : COLORS.neonOrange;
      }

      const x = rng() * 100;
      const y = rng() * 100;

      const xRange = 40;
      const yRange = 30;

      const rr = (min: number, max: number) => rng() * (max - min) + min;

      const xPoints = [
        x,
        (x + rr(-xRange / 2, xRange / 2) + 100) % 100,
        (x + rr(-xRange, xRange) + 100) % 100,
        x,
      ];

      const yPoints = [
        y,
        (y + rr(-yRange / 2, yRange / 2) + 100) % 100,
        (y + rr(-yRange, yRange) + 100) % 100,
        y,
      ];

      return {
        id: i,
        x,
        y,
        xPoints,
        yPoints,
        size: rng() * 6 + 2,
        color,
        duration: rng() * 15 + 15,
        delay: rng() * 5,
        glowIntensity: rng() * 0.6 + 0.4,
      } as Particle;
    });

    setParticles(generated);
    setMounted(true);
  }, [particleCount, strategy]);

  // На сервере (при client-only) рендерим только пустой контейнер, чтобы SSR/CSR совпали по структуре
  if (!mounted) {
    return <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`} aria-hidden="true" />;
  }

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
            filter: `blur(${particle.size * 0.05}px)`,
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

      {/* Дополнительные мерцающие частицы рендерим только после монтирования и только на клиенте */}
      {!isLoadingScreen && particles.length > 0 && Array.from({ length: Math.floor(particleCount * 0.2) }, (_, i) => {
        const rng = makeRng(192837465 + i);
        const twinkleParticle = {
          id: i + particleCount,
          x: rng() * 100,
          y: rng() * 100,
          size: rng() * 3 + 1,
          color: COLORS.poisonGreen,
          duration: rng() * 5 + 5,
          delay: rng() * 5,
        };

        return (
          <motion.div
            key={twinkleParticle.id}
            className="absolute rounded-full"
            style={{
              width: twinkleParticle.size,
              height: twinkleParticle.size,
              backgroundColor: twinkleParticle.color,
              filter: `blur(${twinkleParticle.size * 0.1}px)`,
            }}
            initial={{
              left: `${twinkleParticle.x}%`,
              top: `${twinkleParticle.y}%`,
              opacity: 0,
              scale: 0,
            }}
            animate={{
              opacity: [0, 1, 0],
              scale: [0, 1, 0],
            }}
            transition={{
              duration: twinkleParticle.duration,
              delay: twinkleParticle.delay,
              repeat: Infinity,
              ease: "easeInOut",
              times: [0, 0.15, 0.3, 0.5, 0.7, 0.85, 1],
            }}
          />
        );
      })}
    </div>
  );
};