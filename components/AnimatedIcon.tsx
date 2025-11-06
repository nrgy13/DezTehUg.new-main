'use client';

import React, { useEffect, useState, useRef } from 'react';
import Lottie from 'lottie-react';

interface AnimatedIconProps {
  animationName: string;
  className?: string;
  autoplay?: boolean;
  loop?: boolean;
  isHovered?: boolean; // Внешнее управление анимацией
}

const AnimatedIcon: React.FC<AnimatedIconProps> = ({ 
  animationName, 
  className, 
  autoplay = false, 
  loop = false,
  isHovered: externalIsHovered
}) => {
  const [animationData, setAnimationData] = useState<any>(null);
  const [internalIsHovered, setInternalIsHovered] = useState(false);
  const lottieRef = useRef<any>(null);
  const animationDurationRef = useRef<number | null>(null);
  const stopTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Используем внешнее состояние или внутреннее
  const isHovered = externalIsHovered !== undefined ? externalIsHovered : internalIsHovered;

  useEffect(() => {
    const fetchAnimation = async () => {
      try {
        const response = await fetch(`/animations/${animationName}`);
      const data = await response.json();
      setAnimationData(data);
      
      // Вычисляем длительность анимации в миллисекундах
      // Длительность = (op - ip) / fr * 1000
      if (data.op !== undefined && data.ip !== undefined && data.fr !== undefined) {
        animationDurationRef.current = ((data.op - data.ip) / data.fr) * 1000;
      }
    } catch (error) {
      console.error(`Error loading animation ${animationName}:`, error);
      setAnimationData(null);
    }
  };

  fetchAnimation();
  }, [animationName]);

  // Управление анимацией при изменении isHovered
  useEffect(() => {
    if (lottieRef.current && animationData) {
      // Очищаем предыдущий timeout, если он есть
      if (stopTimeoutRef.current) {
        clearTimeout(stopTimeoutRef.current);
        stopTimeoutRef.current = null;
      }

      if (isHovered) {
        // Запускаем анимацию один раз (без loop)
        lottieRef.current.setLoop(false);
        lottieRef.current.play();
      } else {
        // При отпускании не останавливаем сразу - даем доиграть до конца цикла
        // Используем длительность из animationData
        const duration = animationDurationRef.current;
        const delay = duration || 2000; // Используем длительность или стандартные 2 секунды
        
        // Даем анимации доиграть до конца цикла
        stopTimeoutRef.current = setTimeout(() => {
          if (lottieRef.current) {
            lottieRef.current.stop();
            lottieRef.current.goToAndStop(0, true);
          }
          stopTimeoutRef.current = null;
        }, delay);
      }
    }

    // Очистка timeout при размонтировании
    return () => {
      if (stopTimeoutRef.current) {
        clearTimeout(stopTimeoutRef.current);
        stopTimeoutRef.current = null;
      }
    };
  }, [isHovered, animationData]);

  const handleMouseEnter = () => {
    if (externalIsHovered === undefined) {
      setInternalIsHovered(true);
    }
  };

  const handleMouseLeave = () => {
    if (externalIsHovered === undefined) {
      setInternalIsHovered(false);
    }
  };

  if (!animationData) {
    return null; // Or some fallback
  }

  return (
    <div 
      className={className}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleMouseEnter}
      onTouchEnd={handleMouseLeave}
    >
      <Lottie 
        animationData={animationData}
        autoplay={autoplay}
        loop={loop}
        lottieRef={lottieRef}
    />
    </div>
  );
};

export default AnimatedIcon;
