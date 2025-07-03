'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface NeonInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: 'default' | 'error' | 'success';
  icon?: React.ReactNode;
}

const NeonInput = forwardRef<HTMLInputElement, NeonInputProps>(
  ({ className, variant = 'default', icon, type, ...props }, ref) => {
    const baseClasses = cn(
      'flex h-11 w-full rounded-md bg-bg-primary px-3 py-2 text-sm transition-all duration-300',
      'border border-gray-200 focus:border-poison-green focus:ring-2 focus:ring-poison-green/20',
      'placeholder:text-content-muted',
      'disabled:cursor-not-allowed disabled:opacity-50',
      {
        'border-destructive focus:border-destructive focus:ring-destructive/20': variant === 'error',
        'border-green-500 focus:border-green-500 focus:ring-green-500/20': variant === 'success',
      },
      icon && 'pl-10',
      className
    );

    if (icon) {
      return (
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted">
            {icon}
          </div>
          <input
            type={type}
            className={baseClasses}
            ref={ref}
            {...props}
          />
        </div>
      );
    }

    return (
      <input
        type={type}
        className={baseClasses}
        ref={ref}
        {...props}
      />
    );
  }
);

NeonInput.displayName = 'NeonInput';

export { NeonInput };