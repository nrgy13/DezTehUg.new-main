'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Bug, SprayCan, Rat, Beaker } from 'lucide-react';

type ServiceIconProps = {
  name: 'bug' | 'spray' | 'rat' | 'beaker';
  className?: string;
};

/**
 * Компонент ServiceIcon заменяет иконки из библиотеки lucide-react на пользовательские SVG иконки
 * Если пользовательская иконка не найдена, используется иконка из библиотеки lucide-react
 */
export function ServiceIcon({ name, className = 'h-6 w-6' }: ServiceIconProps) {
  const [iconExists, setIconExists] = useState<boolean>(true);
  
  // Проверяем, существует ли пользовательская иконка
  useEffect(() => {
    const checkIconExists = async () => {
      try {
        const res = await fetch(`/icons/${name}.svg`);
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
          src={`/icons/${name}.svg`} 
          alt={`${name} icon`} 
          width={24} 
          height={24} 
          className="w-full h-full"
        />
      </div>
    );
  }
  
  // Если пользовательская иконка не найдена, используем иконку из библиотеки lucide-react
  switch (name) {
    case 'bug':
      return <Bug className={className} />;
    case 'spray':
      return <SprayCan className={className} />;
    case 'rat':
      return <Rat className={className} />;
    case 'beaker':
      return <Beaker className={className} />;
    default:
      return <Bug className={className} />;
  }
}