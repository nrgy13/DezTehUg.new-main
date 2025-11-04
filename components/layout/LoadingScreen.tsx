'use client';

import React, { useEffect, useState, memo } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { FloatingParticles } from '../FloatingParticles';

// Мемоизируем компонент для предотвращения ненужных ререндеров
const LoadingScreenComponent: React.FC = () => {
  const [progress, setProgress] = useState(0);
  const [startTime] = useState(Date.now());

  useEffect(() => {
    // Адаптивное время загрузки - 3 секунды
    const maxDuration = 3000;
    const minIncrement = 3; // Минимальный прирост за интервал для более плавной анимации
    
    // Используем requestAnimationFrame вместо setInterval для более плавной анимации
    let animationFrameId: number;
    let lastTimestamp: number;
    let currentProgress = 0;
    
    const updateProgress = (timestamp: number) => {
      if (!lastTimestamp) lastTimestamp = timestamp;
      
      const elapsed = Date.now() - startTime;
      const elapsedPercent = Math.min(100, (elapsed / maxDuration) * 100);
      
      // Обеспечиваем плавный прогресс, но с минимальным приростом
      const newProgress = Math.max(
        currentProgress + minIncrement,
        elapsedPercent
      );
      
      if (newProgress < 100) {
        currentProgress = Math.min(99, newProgress); // Никогда не достигаем 100% до завершения загрузки
        setProgress(currentProgress);
        animationFrameId = requestAnimationFrame(updateProgress);
      } else {
        setProgress(100);
      }
      
      lastTimestamp = timestamp;
    };
    
    animationFrameId = requestAnimationFrame(updateProgress);
    
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [startTime]); // Убираем зависимость от progress

  return (
    <motion.div
      key="loading-screen"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-bg-primary"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 1 } }}
    >
      <FloatingParticles particleCount={25} isLoadingScreen={true} />
      
      <motion.div 
        className="relative z-10"
        initial={{ opacity: 0, scale: 0.5, rotate: -180 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ duration: 1.2, type: 'spring', damping: 15, stiffness: 100 }}
      >
        <motion.div
          animate={{
            scale: [1, 1.03, 1], // Уменьшена амплитуда масштабирования
            filter: [
              'drop-shadow(0 0 10px rgba(57, 255, 20, 0.4))',
              'drop-shadow(0 0 20px rgba(57, 255, 20, 0.6))',
              'drop-shadow(0 0 10px rgba(57, 255, 20, 0.4))',
            ],
          }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }} // Уменьшена длительность
        >
          <Image
            src="/logo.png"
            alt="DezTechYug Logo"
            width={160}
            height={160}
            className="rounded-full"
            style={{ width: 'auto', height: 'auto' }}
            priority
          />
        </motion.div>
      </motion.div>

      <div className="w-64 mt-12 relative z-10">
        <div className="h-2 bg-cyber-blue/20 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-poison-green"
            style={{
              boxShadow: '0 0 8px #39FF14, 0 0 15px #39FF14', // Уменьшена интенсивность тени
            }}
            initial={{ width: '0%' }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.05, ease: 'linear' }} // Более быстрый переход для плавности
          />
        </div>
        <p className="text-center text-sm font-mono mt-2 text-poison-green">
          ЗАГРУЗКА... {Math.round(progress)}%
        </p>
      </div>
    </motion.div>
  );
};

LoadingScreenComponent.displayName = 'LoadingScreen';

export const LoadingScreen = memo(LoadingScreenComponent);