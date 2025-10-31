'use client';

import React, { useEffect, useState, useRef } from 'react';
import Lottie from 'lottie-react';

interface AnimatedIconProps {
  animationName: string;
  className?: string;
  autoplay?: boolean;
  loop?: boolean;
}

const AnimatedIcon: React.FC<AnimatedIconProps> = ({ 
  animationName, 
  className, 
  autoplay = false, 
  loop = false 
}) => {
  const [animationData, setAnimationData] = useState<any>(null);
  const [isHovered, setIsHovered] = useState(false);
  const lottieRef = useRef<any>(null);

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

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (lottieRef.current && animationData) {
      lottieRef.current.play();
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (lottieRef.current && animationData) {
      lottieRef.current.stop();
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
