'use client';

import React, { useEffect, useState, useRef } from 'react';
import Lottie from 'lottie-react';

interface AnimatedIconProps {
  animationName: string;
  className?: string;
  autoplay?: boolean;
  loop?: boolean;
  isHovered?: boolean; // Внешнее управление анимацией
  color?: string; // Цвет для фильтрации иконки
}

const AnimatedIcon: React.FC<AnimatedIconProps> = ({ 
  animationName, 
  className, 
  autoplay = false, 
  loop = false,
  isHovered: externalIsHovered,
  color
}) => {
  const [animationData, setAnimationData] = useState<any>(null);
  const [internalIsHovered, setInternalIsHovered] = useState(false);
  const lottieRef = useRef<any>(null);
  const animationDurationRef = useRef<number | null>(null);
  const stopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    if (!lottieRef.current || !animationData) {
      return;
    }

    // Очищаем предыдущий timeout, если он есть
    if (stopTimeoutRef.current) {
      clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }

    const animationInstance = lottieRef.current;
    
    if (isHovered) {
      // Запускаем анимацию один раз (без loop)
      // loop уже установлен через проп компонента Lottie
      if (animationInstance && typeof animationInstance.play === 'function') {
        try {
          animationInstance.play();
        } catch (error) {
          console.error('Error playing animation:', error);
        }
      }
    } else {
      // При отпускании не останавливаем сразу - даем доиграть до конца цикла
      // Используем длительность из animationData
      const duration = animationDurationRef.current;
      const delay = duration || 2000; // Используем длительность или стандартные 2 секунды
      
      // Даем анимации доиграть до конца цикла
      stopTimeoutRef.current = setTimeout(() => {
        const currentInstance = lottieRef.current;
        if (currentInstance) {
          try {
            if (typeof currentInstance.stop === 'function') {
              currentInstance.stop();
            }
            if (typeof currentInstance.goToAndStop === 'function') {
              currentInstance.goToAndStop(0, true);
            }
          } catch (error) {
            console.error('Error stopping animation:', error);
          }
        }
        stopTimeoutRef.current = null;
      }, delay);
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

  // Цвета уже изменены напрямую в JSON файлах, поэтому CSS фильтры не нужны
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
