'use client';

import { LoadingProvider, useLoading } from '@/context/LoadingContext';
import { AnimatePresence, motion } from 'framer-motion';
import { LoadingScreen } from './LoadingScreen';
import { Header } from './Header';
import { Footer } from './Footer';
import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

// Компонент для установки масштаба страницы
const ViewportScale = () => {
  useEffect(() => {
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      viewport.setAttribute('content', 'width=device-width, initial-scale=0.9, maximum-scale=5, user-scalable=yes');
    } else {
      const meta = document.createElement('meta');
      meta.name = 'viewport';
      meta.content = 'width=device-width, initial-scale=0.9, maximum-scale=5, user-scalable=yes';
      document.getElementsByTagName('head')[0].appendChild(meta);
    }
  }, []);

  return null;
};

// Компонент для скролла наверх при изменении пути и обновлении страницы
const ScrollToTop = () => {
  const pathname = usePathname();

  useEffect(() => {
    // Скроллим наверх при изменении пути
    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    // Скроллим наверх при обновлении страницы
    const handleBeforeUnload = () => {
      window.scrollTo(0, 0);
    };

    // Скроллим наверх при загрузке страницы
    window.scrollTo(0, 0);

    // Обработчик для обновления страницы
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  return null;
};

const MainContent = ({ children }: { children: React.ReactNode }) => {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const MIN_LOAD_TIME = 3000;
    
    const loadTimeout = setTimeout(() => {
      setIsLoading(false);
    }, MIN_LOAD_TIME);
    
    return () => {
      clearTimeout(loadTimeout);
    };
  }, []);

  return (
    // Убираем фон отсюда, чтобы он не перекрывал частицы в дочерних компонентах
    <div className="min-h-screen flex flex-col">
      {/* Экран загрузки для главной страницы */}
      <AnimatePresence>
        {isLoading && <LoadingScreen />}
      </AnimatePresence>

      <motion.div
        className="flex flex-col flex-1"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <Header />
        <main className="flex-1">
          {children}
        </main>
        <Footer />
      </motion.div>
    </div>
  );
};

export const AppWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <LoadingProvider>
      <ViewportScale />
      <ScrollToTop />
      <MainContent>{children}</MainContent>
    </LoadingProvider>
  );
};
