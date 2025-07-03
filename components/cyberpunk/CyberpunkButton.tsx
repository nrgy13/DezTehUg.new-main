'use client';

import { forwardRef } from 'react';
import Link from 'next/link';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-poison-green focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none uppercase tracking-wider font-orbitron',
  {
    variants: {
      variant: {
        primary: 'bg-poison-green text-content-primary hover:bg-poison-green/90 hover:shadow-poison border-2 border-poison-green',
        secondary: 'bg-transparent text-content-primary border-2 border-neon-orange hover:bg-neon-orange hover:text-white hover:shadow-neon',
        outline: 'bg-transparent text-content-primary border-2 border-content-primary hover:bg-content-primary hover:text-white',
        ghost: 'bg-transparent text-content-primary hover:bg-poison-green/10 hover:text-poison-green',
        cyber: 'bg-cyber-blue text-white hover:bg-cyber-blue/90 hover:shadow-lg border-2 border-cyber-blue',
      },
      size: {
        sm: 'h-9 px-4 py-2 text-xs',
        default: 'h-11 px-6 py-3 text-sm',
        lg: 'h-14 px-8 py-4 text-base',
        xl: 'h-16 px-10 py-5 text-lg',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  }
);

export interface CyberpunkButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'size'>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  href?: string;
}

const CyberpunkButton = forwardRef<HTMLButtonElement, CyberpunkButtonProps>(
  ({ className, variant, size, asChild = false, href, children, ...props }, ref) => {
    const Comp = asChild ? 'span' : href ? Link : 'button';
    
    if (href) {
      return (
        <Link
          href={href}
          className={cn(buttonVariants({ variant, size, className }))}
        >
          {children}
        </Link>
      );
    }

    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      >
        {children}
      </button>
    );
  }
);

CyberpunkButton.displayName = 'CyberpunkButton';

export { CyberpunkButton, buttonVariants };