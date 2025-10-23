'use client';

import React from 'react';
import Image from 'next/image';
import { Bug, SprayCan, Rat, Beaker } from 'lucide-react';

type ServiceIconName = 'bug' | 'spray' | 'rat' | 'beaker' | 'disinfection' | 'pest-control' | 'deratization' | 'water-analysis';

interface ServiceIconProps {
  name: ServiceIconName;
  className?: string;
}

/**
 * Компонент ServiceIcon отображает иконки сервисов из директории /icons/services/
 * Использует Next.js Image компонент для оптимальной загрузки SVG иконок
 * При отсутствии SVG иконки показывает fallback иконку из lucide-react
 */
export function ServiceIcon({ name, className = 'h-6 w-6' }: ServiceIconProps) {
  const [error, setError] = React.useState(false);
  
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

  if (error) {
    return <FallbackComponent className={className} />;
  }

  return (
    <Image
      src={iconSrc}
      alt={`${name} icon`}
      width={24}
      height={24}
      className={className}
      onError={() => setError(true)}
      priority={false}
    />
  );
}
