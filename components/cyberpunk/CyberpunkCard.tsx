'use client';

import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface CyberpunkCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'service' | 'feature' | 'testimonial';
  glowEffect?: boolean;
  hoverEffect?: boolean;
}

const CyberpunkCard = forwardRef<HTMLDivElement, CyberpunkCardProps>(
  ({ className, variant = 'default', glowEffect = false, hoverEffect = true, children, ...props }, ref) => {
    const baseClasses = cn(
      'relative rounded-lg bg-bg-primary border transition-all duration-300',
      {
        'border-gray-200 hover:border-poison-green': variant === 'default' && hoverEffect,
        'border-gray-200 hover:border-neon-orange': variant === 'service' && hoverEffect,
        'border-cyber-blue/30 hover:border-cyber-blue': variant === 'feature' && hoverEffect,
        'border-gray-200 hover:border-poison-green': variant === 'testimonial' && hoverEffect,
        'shadow-lg hover:shadow-xl': hoverEffect,
        'shadow-cyberpunk': glowEffect,
      },
      className
    );

    if (hoverEffect) {
      return (
        <motion.div
          ref={ref}
          className={baseClasses}
          whileHover={{ 
            scale: 1.02,
            boxShadow: variant === 'service' 
              ? '0 0 20px rgba(255, 107, 53, 0.3)'
              : '0 0 20px rgba(57, 255, 20, 0.3)'
          }}
          transition={{ duration: 0.3 }}
          {...props}
        >
          {children}
        </motion.div>
      );
    }

    return (
      <div ref={ref} className={baseClasses} {...props}>
        {children}
      </div>
    );
  }
);

CyberpunkCard.displayName = 'CyberpunkCard';

export { CyberpunkCard };