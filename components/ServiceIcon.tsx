'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Bug, SprayCan, Rat, Beaker } from 'lucide-react';
import AnimatedIcon from './AnimatedIcon';

type ServiceIconName = 'bug' | 'spray' | 'rat' | 'beaker' | 'disinfection' | 'pest-control' | 'deratization' | 'water-analysis';

interface ServiceIconProps {
  name: ServiceIconName;
  className?: string;
  useAnimation?: boolean;
}

/**
 * Компонент ServiceIcon отображает иконки сервисов из директории /icons/services/
 * Использует Next.js Image компонент для оптимальной загрузки SVG иконок
 * При отсутствии SVG иконки показывает fallback иконку из lucide-react
 * Поддерживает hover-анимации через AnimatedIcon компонент
 */
export function ServiceIcon({ name, className = 'h-6 w-6', useAnimation = false }: ServiceIconProps) {
  const [error, setError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  
  const iconNameMapping: Record<ServiceIconName, string> = {
    bug: 'pest-control',
    spray: 'disinfection',
    rat: 'deratization',
    beaker: 'water-analysis',
    'pest-control': 'pest-control',
    disinfection: 'disinfection',
    deratization: 'deratization',
    'water-analysis': 'water-analysis',
  };

  const finalIconName = iconNameMapping[name] || 'pest-control';
  const iconSrc = `/icons/services/${finalIconName}.svg`;

  let FallbackComponent: React.ElementType;

  switch (finalIconName) {
    case 'disinfection':
      FallbackComponent = SprayCan;
      break;
    case 'pest-control':
      FallbackComponent = Bug;
      break;
    case 'deratization':
      FallbackComponent = Rat;
      break;
    case 'water-analysis':
      FallbackComponent = Beaker;
      break;
    default:
      FallbackComponent = Bug;
  }

  // Если включены анимации и курсор наведен, показываем анимированную иконку
  if (useAnimation && isHovered) {
    const animationMapping: Record<ServiceIconName, string> = {
      bug: 'bug',
      spray: 'spray',
      rat: 'rat',
      beaker: 'microscope',
      'pest-control': 'bug',
      disinfection: 'spray',
      deratization: 'rat',
      'water-analysis': 'microscope',
    };
    
    const animationName = animationMapping[name];
    return (
      <div 
        className={className}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <AnimatedIcon animationName={animationName} className="w-full h-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div 
        className={className}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <FallbackComponent className="w-full h-full" />
      </div>
    );
  }

  return (
    <div 
      className={className}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Image
        src={iconSrc}
        alt={`${name} icon`}
        width={24}
        height={24}
        className="w-full h-full"
        onError={() => setError(true)}
        priority={false}
      />
    </div>
  );
}
