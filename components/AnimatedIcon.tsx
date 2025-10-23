'use client';

import React, { useEffect, useState } from 'react';
import Lottie from 'lottie-react';

interface AnimatedIconProps {
  animationName: string;
  className?: string;
}

const AnimatedIcon: React.FC<AnimatedIconProps> = ({ animationName, className }) => {
  const [animationData, setAnimationData] = useState(null);

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

  if (!animationData) {
    return null; // Or some fallback
  }

  return <Lottie animationData={animationData} className={className} />;
};

export default AnimatedIcon;
