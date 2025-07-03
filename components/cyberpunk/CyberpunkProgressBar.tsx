'use client';

import { cn } from '@/lib/utils';

interface CyberpunkProgressBarProps {
  value: number;
  max?: number;
  className?: string;
  showPercentage?: boolean;
  variant?: 'default' | 'success' | 'warning';
}

export function CyberpunkProgressBar({ 
  value, 
  max = 100, 
  className,
  showPercentage = false,
  variant = 'default'
}: CyberpunkProgressBarProps) {
  const percentage = Math.min((value / max) * 100, 100);
  
  const variantClasses = {
    default: 'bg-poison-green',
    success: 'bg-green-500',
    warning: 'bg-neon-orange',
  };

  return (
    <div className={cn('w-full', className)}>
      <div className="flex justify-between items-center mb-2">
        {showPercentage && (
          <span className="text-sm font-medium text-content-primary">
            {Math.round(percentage)}%
          </span>
        )}
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2 relative overflow-hidden">
        <div 
          className={cn(
            'h-full rounded-full transition-all duration-500 ease-out relative',
            variantClasses[variant]
          )}
          style={{ width: `${percentage}%` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" />
        </div>
      </div>
    </div>
  );
}