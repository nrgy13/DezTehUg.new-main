'use client';

import { LoadingProvider, useLoading } from '@/context/LoadingContext';
import { AnimatePresence, motion } from 'framer-motion';
import { LoadingScreen } from './LoadingScreen';
import { Header } from './Header';
import { Footer } from './Footer';
import { useEffect, useState, useCallback } from 'react';

const MainContent = ({ children }: { children: React.ReactNode }) => {
  const { isLoading, unregisterLoading } = useLoading();
  const [isMounted, setIsMounted] = useState(false);
  
  // Функция для обработки завершения загрузки с искусственной задержкой
  const handleMounted = useCallback(() => {
    setIsMounted(true);
    // Добавляем искусственную задержку в 6 секунд
    // Это гарантирует, что экран загрузки будет отображаться полные 6 секунд
    setTimeout(() => {
      unregisterLoading('initial');
    }, 6000);
  }, [unregisterLoading]);

  useEffect(() => {
    // Используем requestIdleCallback для выполнения монтирования в период простоя браузера
    // С fallback на setTimeout для браузеров, которые не поддерживают requestIdleCallback
    if (typeof window !== 'undefined') {
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(() => {
          handleMounted();
        });
      } else {
        setTimeout(handleMounted, 10);
      }
    }
  }, [handleMounted]);

  if (!isMounted) {
    return <LoadingScreen />;
  }

  return (
    // Убираем фон отсюда, чтобы он не перекрывал частицы в дочерних компонентах
    <div className="min-h-screen flex flex-col">
      <AnimatePresence>
        {isLoading && <LoadingScreen />}
      </AnimatePresence>

      {!isLoading && (
        <motion.div
          className="flex flex-col flex-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }} // Уменьшено время анимации для более быстрого отображения
        >
          <Header />
          <main className="flex-1">
            {children}
          </main>
          <Footer />
        </motion.div>
      )}
    </div>
  );
};

export const AppWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <LoadingProvider>
      <MainContent>{children}</MainContent>
    </LoadingProvider>
  );
};