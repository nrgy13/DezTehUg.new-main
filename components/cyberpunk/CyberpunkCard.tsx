'use client';

import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { ComponentPropsWithRef } from 'react';

// Define the component-specific props
interface CyberpunkCardCustomProps {
  variant?: 'default' | 'service' | 'feature' | 'testimonial';
  glowEffect?: boolean;
  hoverEffect?: boolean;
}

// Combine with Framer Motion's props using the canonical React way
type CyberpunkCardProps = ComponentPropsWithRef<typeof motion.div> & CyberpunkCardCustomProps;


const CyberpunkCard = forwardRef<HTMLDivElement, CyberpunkCardProps>(
  ({ 
    className, 
    variant = 'default', 
    glowEffect = false, 
    hoverEffect = true, 
    children, 
    // All custom props are destructured, the rest are passed down
    ...props 
  }, ref) => {
    const baseClasses = cn(
      'relative rounded-lg bg-bg-primary border transition-all duration-300',
      {
        'border-gray-200 hover:border-poison-green': (variant === 'default' || variant === 'testimonial') && hoverEffect,
        'border-gray-200 hover:border-neon-orange': variant === 'service' && hoverEffect,
        'border-cyber-blue/30 hover:border-cyber-blue': variant === 'feature' && hoverEffect,
        'shadow-lg hover:shadow-xl': hoverEffect,
        'shadow-cyberpunk': glowEffect,
      },
      className
    );

    return (
      <motion.div
        ref={ref}
        className={baseClasses}
        whileHover={hoverEffect ? {
          scale: 1.02,
          boxShadow: variant === 'service'
            ? '0 0 20px rgba(255, 107, 53, 0.3)'
            : '0 0 20px rgba(57, 255, 20, 0.3)'
        } : undefined}
        transition={{ duration: 0.3 }}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

CyberpunkCard.displayName = 'CyberpunkCard';

export { CyberpunkCard };