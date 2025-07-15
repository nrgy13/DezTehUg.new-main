'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function LogoText() {
  const [isHovered, setIsHovered] = useState(false);
  const [isAnimating, setIsAnimating] = useState(true);
  
  // Анимация всегда активна после загрузки
  useEffect(() => {
    // Устанавливаем анимацию как постоянно активную
    setIsAnimating(true);
    
    return () => {
      // Очистка при размонтировании компонента (если нужно)
    };
  }, []);
  
  // Анимация для букв
  const letterVariants = {
    initial: { y: 0, opacity: 0.9 },
    hover: (i: number) => ({
      y: [-3, 0, -3],
      opacity: [0.9, 1, 0.9],
      filter: ["blur(0px)", "blur(0.5px)", "blur(0px)"],
      transition: {
        delay: i * 0.05,
        duration: 1.2,
        repeat: Infinity,
        repeatType: "reverse" as const,
      }
    }),
    animate: (i: number) => ({
      y: [-2, 0, -2],
      opacity: [0.9, 1, 0.9],
      filter: ["blur(0px)", "blur(0.5px)", "blur(0px)"],
      scale: [1, 1.02, 1],
      transition: {
        delay: i * 0.08,
        duration: 3.5,
        repeat: Infinity,
        repeatType: "reverse" as const,
      }
    })
  };

  // Анимация для подсветки и эффекта дыма
  const glowVariants = {
    initial: { opacity: 0.3, scale: 1 },
    hover: {
      opacity: [0.4, 0.8, 0.4],
      scale: [1, 1.05, 1],
      filter: ["blur(8px)", "blur(12px)", "blur(8px)"],
      transition: {
        duration: 3,
        repeat: Infinity,
        repeatType: "reverse" as const,
      }
    },
    animate: {
      opacity: [0.3, 0.7, 0.3],
      scale: [1, 1.08, 1],
      filter: ["blur(8px)", "blur(15px)", "blur(8px)"],
      transition: {
        duration: 5,
        times: [0, 0.5, 1],
        repeat: Infinity,
        repeatType: "reverse" as const,
      }
    }
  };
  
  // Анимация для эффекта дыма
  const smokeVariants = {
    initial: { opacity: 0 },
    hover: {
      opacity: [0.1, 0.3, 0.1],
      transition: {
        duration: 3,
        repeat: Infinity,
        repeatType: "reverse" as const,
      }
    },
    animate: {
      opacity: [0.05, 0.3, 0.05],
      scale: [0.95, 1.05, 0.95],
      transition: {
        duration: 6,
        times: [0, 0.5, 1],
        repeat: Infinity,
        repeatType: "reverse" as const,
      }
    }
  };

  return (
    <div
      className="flex flex-col items-center"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-center relative w-full justify-center">
        {/* Эффект дыма позади логотипа */}
        <motion.div
          className="absolute inset-0 rounded-xl -z-20"
          style={{
            background: 'radial-gradient(circle, rgba(76,176,50,0.15), rgba(226,8,25,0.15), transparent)',
          }}
          initial="initial"
          animate={isHovered ? "hover" : isAnimating ? "animate" : "initial"}
          variants={smokeVariants}
        />
        
        {/* Основной логотип */}
        <motion.div
          className="flex justify-center w-full relative z-10"
          initial="initial"
          animate={isHovered ? "hover" : isAnimating ? "animate" : "initial"}
        >
          {/* ДЕЗ в красном цвете */}
          <motion.span
            className="font-bebas font-bold text-3xl tracking-wider"
            style={{ color: '#e20819', textShadow: '0px 0px 1px rgba(226,8,25,0.5)' }}
            variants={letterVariants}
            custom={0}
          >
            Д
          </motion.span>
          <motion.span
            className="font-bebas font-bold text-3xl tracking-wider"
            style={{ color: '#e20819', textShadow: '0px 0px 1px rgba(226,8,25,0.5)' }}
            variants={letterVariants}
            custom={1}
          >
            Е
          </motion.span>
          <motion.span
            className="font-bebas font-bold text-3xl tracking-wider"
            style={{ color: '#e20819', textShadow: '0px 0px 1px rgba(226,8,25,0.5)' }}
            variants={letterVariants}
            custom={2}
          >
            З
          </motion.span>
          
          {/* ТЕХ в зеленом цвете */}
          <motion.span
            className="font-bebas font-bold text-3xl tracking-wider"
            style={{ color: '#4cb032', textShadow: '0px 0px 1px rgba(76,176,50,0.5)' }}
            variants={letterVariants}
            custom={3}
          >
            Т
          </motion.span>
          <motion.span
            className="font-bebas font-bold text-3xl tracking-wider"
            style={{ color: '#4cb032', textShadow: '0px 0px 1px rgba(76,176,50,0.5)' }}
            variants={letterVariants}
            custom={4}
          >
            Е
          </motion.span>
          <motion.span
            className="font-bebas font-bold text-3xl tracking-wider"
            style={{ color: '#4cb032', textShadow: '0px 0px 1px rgba(76,176,50,0.5)' }}
            variants={letterVariants}
            custom={5}
          >
            Х
          </motion.span>
          
          {/* ЮГ в красном цвете */}
          <motion.span
            className="font-bebas font-bold text-3xl tracking-wider"
            style={{ color: '#e20819', textShadow: '0px 0px 1px rgba(226,8,25,0.5)' }}
            variants={letterVariants}
            custom={6}
          >
            Ю
          </motion.span>
          <motion.span
            className="font-bebas font-bold text-3xl tracking-wider"
            style={{ color: '#e20819', textShadow: '0px 0px 1px rgba(226,8,25,0.5)' }}
            variants={letterVariants}
            custom={7}
          >
            Г
          </motion.span>
        </motion.div>
        
        {/* Эффект свечения и дыма */}
        <motion.div
          className="absolute inset-0 rounded-xl -z-10 w-full"
          style={{
            background: 'linear-gradient(90deg, rgba(226,8,25,0.3), rgba(76,176,50,0.3), rgba(226,8,25,0.3))',
          }}
          initial="initial"
          animate={isHovered ? "hover" : isAnimating ? "animate" : "initial"}
          variants={glowVariants}
        />
        
        {/* Дополнительный эффект дыма */}
        <motion.div
          className="absolute inset-0 rounded-xl -z-15 w-full h-full"
          style={{
            background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.1), transparent 70%)',
          }}
          initial="initial"
          animate={isHovered ? "hover" : isAnimating ? "animate" : "initial"}
          variants={smokeVariants}
        />
      </div>
      
      {/* Подпись под логотипом */}
      <motion.span
        className="text-xs text-content-secondary mt-1 font-roboto-condensed tracking-wider text-center relative z-10 font-medium"
        style={{ letterSpacing: '0.05em', maxWidth: 'fit-content', margin: '0.25rem auto 0 auto' }}
        initial={{ opacity: 0.7 }}
        animate={{
          opacity: isHovered || isAnimating ? [0.7, 1, 0.7] : 0.7,
          filter: isHovered || isAnimating ? ["blur(0px)", "blur(0.3px)", "blur(0px)"] : "blur(0px)"
        }}
        transition={{
          duration: isHovered ? 2 : isAnimating ? 3 : 0.3,
          repeat: isHovered ? Infinity : isAnimating ? Infinity : 0,
          repeatType: "reverse"
        }}
      >
        ДЕЗИНФЕКЦИОННЫЕ ТЕХНОЛОГИИ - ЮГ
      </motion.span>
    </div>
  );
}