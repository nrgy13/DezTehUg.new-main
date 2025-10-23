'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Award, Zap, Clock } from 'lucide-react';

type TrustFactorIconName = 'award' | 'zap' | 'clock';

interface TrustFactorIconProps {
  name: TrustFactorIconName;
  className?: string;
}

export const TrustFactorIcon: React.FC<TrustFactorIconProps> = ({ name, className = '' }) => {
  const [error, setError] = useState(false);

  const iconSrc = `/icons/trust-factors/${name}.svg`;

  let FallbackComponent: React.ElementType;
  switch (name) {
    case 'award':
      FallbackComponent = Award;
      break;
    case 'zap':
      FallbackComponent = Zap;
      break;
    case 'clock':
      FallbackComponent = Clock;
      break;
    default:
      FallbackComponent = Award;
  }

  const colorFilters: Record<TrustFactorIconName, string> = {
    award: 'brightness(0) saturate(100%) invert(58%) sepia(96%) saturate(1352%) hue-rotate(169deg) brightness(101%) contrast(91%)', // electric-blue
    zap: 'brightness(0) saturate(100%) invert(71%) sepia(74%) saturate(1729%) hue-rotate(3deg) brightness(101%) contrast(103%)', // neon-orange
    clock: 'brightness(0) saturate(100%) invert(27%) sepia(51%) saturate(2878%) hue-rotate(346deg) brightness(104%) contrast(97%)', // cyber-blue
  };

  if (error) {
    return (
      <span style={{ filter: colorFilters[name] }} className={className}>
        <FallbackComponent className="inline-block w-4 h-4" />
      </span>
    );
  }

  return (
    <span style={{ filter: colorFilters[name] }} className={className}>
      <Image
        src={iconSrc}
        alt={`${name} icon`}
        width={16}
        height={16}
        className="inline-block"
        onError={() => setError(true)}
      />
    </span>
  );
};
