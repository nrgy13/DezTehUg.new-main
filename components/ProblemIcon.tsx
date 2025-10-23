'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Bug, SprayCan, Rat, Beaker } from 'lucide-react';
import { motion } from 'framer-motion';

type ProblemIconProps = {
  src: string;
  alt: string;
  className?: string;
  color?: string;
};

export function ProblemIcon({ src, alt, className = 'h-16 w-16', color = '#FF6B35' }: ProblemIconProps) {
  return (
    <motion.div
      className={`${className} relative`}
      whileHover={{
        scale: 1.1,
        filter: `drop-shadow(0 0 15px ${color})`,
        transition: { duration: 0.3 }
      }}
    >
      <Image
        src={src}
        alt={alt}
        width={64}
        height={64}
        className="w-full h-full"
        style={{
          filter: `
            drop-shadow(0 0 8px ${color}80)
            drop-shadow(0 0 4px ${color}40)
          `,
        }}
      />
      <div className="absolute inset-0 rounded-full bg-current opacity-10 mix-blend-overlay"></div>
      <div className="absolute inset-0 rounded-full border border-current opacity-20 pointer-events-none"></div>
    </motion.div>
  );
}