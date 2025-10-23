'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface MoleculeAnimationProps {
  accentColor: string;
  count?: number;
  className?: string;
}

interface Molecule {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
  isExploding: boolean;
  particles: Particle[];
}

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
}

const MoleculeAnimation: React.FC<MoleculeAnimationProps> = ({
  accentColor,
  count = 6,
  className = ""
}) => {
  const [molecules, setMolecules] = useState<Molecule[]>([]);

  // Создание начальных молекул
  const initialMolecules = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 4 + Math.random() * 4, // 4-8px
      delay: Math.random() * 2, // 0-2s задержка
      duration: 3 + Math.random() * 2, // 3-5s движение
      isExploding: false,
      particles: []
    }));
  }, [count]);

  useEffect(() => {
    setMolecules(initialMolecules);
  }, [initialMolecules]);

  // Создание частиц для взрыва
  const createExplosionParticles = (molecule: Molecule): Particle[] => {
    const particleCount = 8 + Math.random() * 4; // 8-12 частиц
    return Array.from({ length: Math.floor(particleCount) }, (_, i) => ({
      id: i,
      x: 0,
      y: 0,
      vx: (Math.random() - 0.5) * 100, // скорость по X
      vy: (Math.random() - 0.5) * 100, // скорость по Y
      size: 1 + Math.random() * 2, // 1-3px
      opacity: 0.8 + Math.random() * 0.2
    }));
  };

  // Обработка взрыва молекулы
  const handleMoleculeExplode = (moleculeId: number) => {
    setMolecules(prev => prev.map(mol => {
      if (mol.id === moleculeId && !mol.isExploding) {
        return {
          ...mol,
          isExploding: true,
          particles: createExplosionParticles(mol)
        };
      }
      return mol;
    }));

    // Удаление молекулы после взрыва и создание новой
    setTimeout(() => {
      setMolecules(prev => prev.map(mol => {
        if (mol.id === moleculeId) {
          return {
            id: moleculeId,
            x: Math.random() * 100,
            y: Math.random() * 100,
            size: 4 + Math.random() * 4,
            delay: Math.random() * 2,
            duration: 3 + Math.random() * 2,
            isExploding: false,
            particles: []
          };
        }
        return mol;
      }));
    }, 1000); // 1s для завершения анимации взрыва
  };

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      <AnimatePresence>
        {molecules.map((molecule) => (
          <React.Fragment key={molecule.id}>
            {/* Основная молекула */}
            {!molecule.isExploding && (
              <motion.div
                className="absolute rounded-full"
                style={{
                  backgroundColor: accentColor,
                  width: molecule.size,
                  height: molecule.size,
                  left: `${molecule.x}%`,
                  top: `${molecule.y}%`,
                  boxShadow: `0 0 ${molecule.size * 2}px ${accentColor}40`
                }}
                initial={{ 
                  opacity: 0, 
                  scale: 0,
                  x: 0,
                  y: 0
                }}
                animate={{
                  opacity: [0, 0.8, 0.6, 0.8, 0],
                  scale: [0, 1, 1.2, 1, 0],
                  x: [
                    0,
                    (Math.random() - 0.5) * 50,
                    (Math.random() - 0.5) * 80,
                    (Math.random() - 0.5) * 30,
                    0
                  ],
                  y: [
                    0,
                    (Math.random() - 0.5) * 50,
                    (Math.random() - 0.5) * 80,
                    (Math.random() - 0.5) * 30,
                    0
                  ]
                }}
                transition={{
                  duration: molecule.duration,
                  delay: molecule.delay,
                  ease: "easeInOut",
                  repeat: Infinity,
                  repeatDelay: 1 + Math.random() * 2
                }}
                onAnimationComplete={() => {
                  // Случайный шанс взрыва в конце цикла
                  if (Math.random() < 0.3) { // 30% шанс
                    handleMoleculeExplode(molecule.id);
                  }
                }}
              />
            )}

            {/* Частицы взрыва */}
            {molecule.isExploding && molecule.particles.map((particle) => (
              <motion.div
                key={`${molecule.id}-particle-${particle.id}`}
                className="absolute rounded-full"
                style={{
                  backgroundColor: accentColor,
                  width: particle.size,
                  height: particle.size,
                  left: `${molecule.x}%`,
                  top: `${molecule.y}%`,
                  boxShadow: `0 0 ${particle.size * 3}px ${accentColor}60`
                }}
                initial={{
                  opacity: particle.opacity,
                  scale: 1,
                  x: 0,
                  y: 0
                }}
                animate={{
                  opacity: 0,
                  scale: 0,
                  x: particle.vx,
                  y: particle.vy
                }}
                exit={{
                  opacity: 0,
                  scale: 0
                }}
                transition={{
                  duration: 0.8 + Math.random() * 0.4,
                  ease: "easeOut"
                }}
              />
            ))}
          </React.Fragment>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default MoleculeAnimation;