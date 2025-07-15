'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Bug, SprayCan, Rat, Beaker } from 'lucide-react';

type ServiceIconProps = {
  name: 'bug' | 'spray' | 'rat' | 'beaker' | 'disinfection' | 'pest-control' | 'deratization' | 'water-analysis';
  className?: string;
};

/**
 * Компонент ServiceIcon заменяет иконки из библиотеки lucide-react на пользовательские SVG иконки
 * Если пользовательская иконка не найдена, используется иконка из библиотеки lucide-react
 */
export function ServiceIcon({ name, className = 'h-6 w-6' }: ServiceIconProps) {
  const [iconExists, setIconExists] = useState<boolean>(true);
  
  // Определяем путь к иконке в зависимости от типа
  const getIconPath = (iconName: string) => {
    const serviceIcons = ['disinfection', 'pest-control', 'deratization', 'water-analysis'];
    if (serviceIcons.includes(iconName)) {
      return `/icons/services/${iconName}.svg`;
    }
    return `/icons/${iconName}.svg`;
  };
  
  // Проверяем, существует ли пользовательская иконка
  useEffect(() => {
    const checkIconExists = async () => {
      try {
        const iconPath = getIconPath(name);
        const res = await fetch(iconPath);
        setIconExists(res.status === 200);
      } catch (error) {
        setIconExists(false);
      }
    };
    
    checkIconExists();
  }, [name]);
  
  // Если пользовательская иконка существует, используем ее
  if (iconExists) {
    const iconPath = getIconPath(name);
    return (
      <div className={className}>
        <Image
          src={iconPath}
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