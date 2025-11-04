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

  // Используем внешнее состояние или внутреннее
  const isHovered = externalIsHovered !== undefined ? externalIsHovered : internalIsHovered;

  useEffect(() => {
    const fetchAnimation = async () => {
      try {
        const response = await fetch(`/animations/${animationName}`);
      const data = await response.json();
      setAnimationData(data);
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
      if (isHovered) {
        lottieRef.current.play();
      } else {
        lottieRef.current.stop();
        // Возвращаем к первому кадру
        lottieRef.current.goToAndStop(0, true);
      }
    }
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
