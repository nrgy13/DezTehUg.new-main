'use client';

import { LoadingProvider, useLoading } from '@/context/LoadingContext';
import { AnimatePresence, motion } from 'framer-motion';
import { LoadingScreen } from './LoadingScreen';
import { Header } from './Header';
import { Footer } from './Footer';
import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

// Роуты CRM и страница логина — рендерятся БЕЗ публичного Header/Footer
const isCrmPath = (pathname: string) =>
  pathname.startsWith('/admin') ||
  pathname.startsWith('/manager') ||
  pathname.startsWith('/master') ||
  pathname.startsWith('/profile') ||
  pathname.startsWith('/manual') ||
  pathname.startsWith('/login');

// Масштаб 0.9 на мобиле — только для CRM (под него выверена мобильная вёрстка панели).
// Публичному сайту оставляем initial-scale=1 из app/layout.tsx: подмена на 0.9 раскладывала
// страницу шире экрана (телефон 390px → 433px), и Яндекс.Вебмастер помечал сайт
// «не оптимизирован для мобильных устройств». Уменьшение публички даёт body zoom в globals.css.
const ViewportScale = () => {
  const pathname = usePathname();

  useEffect(() => {
    const scale = isCrmPath(pathname) ? '0.9' : '1';
    const content = `width=device-width, initial-scale=${scale}, maximum-scale=5, user-scalable=yes`;
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      viewport.setAttribute('content', content);
    } else {
      const meta = document.createElement('meta');
      meta.name = 'viewport';
      meta.content = content;
      document.getElementsByTagName('head')[0].appendChild(meta);
    }
  }, [pathname]);

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
  const pathname = usePathname();
  const isCrm = isCrmPath(pathname);

  const [isLoading, setIsLoading] = useState(!isCrm); // на CRM не показываем splash

  useEffect(() => {
    if (isCrm) return;
    const MIN_LOAD_TIME = 3000;

    const loadTimeout = setTimeout(() => {
      setIsLoading(false);
    }, MIN_LOAD_TIME);

    return () => {
      clearTimeout(loadTimeout);
    };
  }, [isCrm]);

  // CRM-роуты: чистый layout без публичного хедера/футера
  if (isCrm) {
    return <>{children}</>;
  }

  return (
    // Убираем фон отсюда, чтобы он не перекрывал частицы в дочерних компонентах.
    // overflow-x-clip: стартовые сдвиги анимаций (x: ±50) и декор не раздувают ширину страницы
    // на телефоне (clip, а не hidden — не создаёт скролл-контейнер, sticky/fixed не ломаются).
    <div className="min-h-screen flex flex-col overflow-x-clip">
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
