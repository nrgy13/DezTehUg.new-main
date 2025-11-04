'use client';

import { LoadingProvider, useLoading } from '@/context/LoadingContext';
import { AnimatePresence, motion } from 'framer-motion';
import { LoadingScreen } from './LoadingScreen';
import { Header } from './Header';
import { Footer } from './Footer';
import { useEffect, useState, useCallback } from 'react';

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

const MainContent = ({ children }: { children: React.ReactNode }) => {
  const { isLoading, unregisterLoading } = useLoading();
  
  useEffect(() => {
    // Простая логика: показываем загрузочный экран ровно 3 секунды
    const timer = setTimeout(() => {
      unregisterLoading('initial');
    }, 3000);

    return () => clearTimeout(timer);
  }, [unregisterLoading]);

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
      <MainContent>{children}</MainContent>
    </LoadingProvider>
  );
};