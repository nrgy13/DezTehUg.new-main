'use client';

import { LoadingProvider, useLoading } from '@/context/LoadingContext';
import { AnimatePresence, motion } from 'framer-motion';
import { LoadingScreen } from './LoadingScreen';
import { Header } from './Header';
import { Footer } from './Footer';
import { useEffect } from 'react';

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
    let observer: IntersectionObserver | null = null;
    let intervalId: NodeJS.Timeout | null = null;
    let timeoutId: NodeJS.Timeout | null = null;
    const markerId = 'half-page-loading-marker';
    
    const checkHalfPageLoaded = () => {
      const documentHeight = document.documentElement.scrollHeight;
      const viewportHeight = window.innerHeight;
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const viewportBottom = scrollTop + viewportHeight;
      const halfPagePosition = documentHeight / 2;
      
      // Если видимая область достигла или прошла половину страницы
      // или страница короткая (меньше 1.5 экранов)
      if (viewportBottom >= halfPagePosition || documentHeight <= viewportHeight * 1.5) {
        unregisterLoading('initial');
        return true;
      }
      return false;
    };
    
    const setupObserver = () => {
      // Проверяем сразу
      if (checkHalfPageLoaded()) {
        return;
      }
      
      // Создаем невидимый маркер на половине страницы
      let marker = document.getElementById(markerId);
      if (!marker) {
        marker = document.createElement('div');
        marker.id = markerId;
        marker.style.position = 'absolute';
        marker.style.top = '50%';
        marker.style.left = '0';
        marker.style.width = '1px';
        marker.style.height = '1px';
        marker.style.pointerEvents = 'none';
        marker.style.opacity = '0';
        marker.style.zIndex = '-1';
        document.body.appendChild(marker);
      }
      
      // Используем Intersection Observer для отслеживания маркера
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            // Когда маркер попадает в видимую область (половина страницы загружена)
            if (entry.isIntersecting || entry.boundingClientRect.top <= viewportHeight) {
              unregisterLoading('initial');
              cleanup();
            }
          });
        },
        {
          root: null,
          rootMargin: '0px',
          threshold: [0, 0.1, 0.5, 1],
        }
      );
      
      observer.observe(marker);
      
      // Периодическая проверка на случай, если Intersection Observer не сработает
      intervalId = setInterval(() => {
        if (checkHalfPageLoaded()) {
          cleanup();
        }
      }, 200);
      
      // Таймаут безопасности - максимум 5 секунд
      timeoutId = setTimeout(() => {
        cleanup();
        unregisterLoading('initial');
      }, 5000);
    };
    
    const cleanup = () => {
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      const marker = document.getElementById(markerId);
      if (marker) {
        marker.remove();
      }
    };
    
    // Запускаем проверку после небольшой задержки для инициализации DOM
    const initTimeout = setTimeout(() => {
      setupObserver();
    }, 300);
    
    // Также проверяем при событии load
    window.addEventListener('load', setupObserver, { once: true });
    
    return () => {
      clearTimeout(initTimeout);
      cleanup();
      window.removeEventListener('load', setupObserver);
    };
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