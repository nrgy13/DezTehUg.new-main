'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Shield, Zap, Award, CheckCircle, Clock } from 'lucide-react';

type WhyChooseUsIconProps = {
  name: 'shield' | 'zap' | 'award' | 'check-circle' | 'clock' | 'cycle';
  className?: string;
};

/**
 * Компонент WhyChooseUsIcon заменяет иконки из библиотеки lucide-react на пользовательские SVG иконки
 * для блока "Почему выбирают ДЕЗТЕХЮГ"
 * Если пользовательская иконка не найдена, используется иконка из библиотеки lucide-react
 */
export function WhyChooseUsIcon({ name, className = 'h-6 w-6' }: WhyChooseUsIconProps) {
  const [iconExists, setIconExists] = useState<boolean>(true);
  
  // Проверяем, существует ли пользовательская иконка
  useEffect(() => {
    const checkIconExists = async () => {
      try {
        const res = await fetch(`/icons/why-choose-us/${name}.svg`);
        setIconExists(res.status === 200);
      } catch (error) {
        setIconExists(false);
      }
    };
    
    checkIconExists();
  }, [name]);
  
  // Если пользовательская иконка существует, используем ее
  if (iconExists) {
    return (
      <div className={className}>
        <Image 
          src={`/icons/why-choose-us/${name}.svg`} 
          alt={`${name} icon`} 
          width={48} 
          height={48} 
          className="w-full h-full"
        />
      </div>
    );
  }
  
  // Если пользовательская иконка не найдена, используем иконку из библиотеки lucide-react
  switch (name) {
    case 'shield':
      return <Shield className={className} />;
    case 'zap':
      return <Zap className={className} />;
    case 'award':
      return <Award className={className} />;
    case 'check-circle':
      return <CheckCircle className={className} />;
    case 'clock':
      return <Clock className={className} />;
    case 'cycle':
      return <Shield className={className} />; // fallback to shield for cycle
    default:
      return <Shield className={className} />;
  }
}