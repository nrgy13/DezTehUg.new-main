import React from 'react';

interface TrustFactorIconProps {
  name: 'award' | 'zap' | 'clock';
  className?: string;
}

export const TrustFactorIcon: React.FC<TrustFactorIconProps> = ({ name, className = '' }) => {
  const iconPaths = {
    award: '/icons/trust-factors/award.svg',
    zap: '/icons/trust-factors/zap.svg',
    clock: '/icons/trust-factors/clock.svg',
  };

  // CSS фильтры для цветов согласно стилю сайта
  const colorFilters = {
    award: 'brightness(0) saturate(100%) invert(58%) sepia(96%) saturate(1352%) hue-rotate(169deg) brightness(101%) contrast(91%)', // electric-blue
    zap: 'brightness(0) saturate(100%) invert(71%) sepia(74%) saturate(1729%) hue-rotate(3deg) brightness(101%) contrast(103%)', // neon-orange
    clock: 'brightness(0) saturate(100%) invert(27%) sepia(51%) saturate(2878%) hue-rotate(346deg) brightness(104%) contrast(97%)', // cyber-blue
  };

  return (
    <img
      src={iconPaths[name]}
      alt={`${name} icon`}
      className={className}
      style={{ filter: colorFilters[name] }}
    />
  );
};