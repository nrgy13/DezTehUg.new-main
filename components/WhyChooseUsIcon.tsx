'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Shield, Zap, Award, CheckCircle, Clock, RefreshCw } from 'lucide-react';

type WhyChooseUsIconName = 'shield' | 'zap' | 'award' | 'check-circle' | 'clock' | 'cycle';

interface WhyChooseUsIconProps {
  name: WhyChooseUsIconName;
  className?: string;
}

/**
 * Компонент WhyChooseUsIcon отображает иконки преимуществ из директории /public/icons/why-choose-us/
 * Использует Next.js Image для оптимальной загрузки SVG иконок.
 * При ошибке загрузки или отсутствии файла используется fallback иконка из lucide-react.
 */
export function WhyChooseUsIcon({ name, className = 'h-6 w-6' }: WhyChooseUsIconProps) {
  const [error, setError] = useState(false);

  // Формируем стандартизированный путь к иконке
  const iconSrc = `/icons/why-choose-us/${name}.svg`;

  // Карта для fallback-иконок
  const fallbackIcons: { [key in WhyChooseUsIconName]: React.ElementType } = {
    shield: Shield,
    zap: Zap,
    award: Award,
    'check-circle': CheckCircle,
    clock: Clock,
    cycle: RefreshCw, // Более подходящая иконка для cycle
  };

  const FallbackComponent = fallbackIcons[name] || Shield; // Shield как дефолтный fallback

  // Если произошла ошибка загрузки SVG, показываем fallback иконку
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
      priority={false} // Иконки не являются критически важными для LCP
    />
  );
}
