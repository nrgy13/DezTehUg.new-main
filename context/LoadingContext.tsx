'use client';

import { createContext, useContext, useState, ReactNode, useCallback, useEffect, useMemo } from 'react';

interface LoadingContextType {
  isLoading: boolean;
  registerLoading: (id: string) => void;
  unregisterLoading: (id: string) => void;
  loadingSources: Set<string>; // Экспортируем loadingSources для отладки
  minLoadingTime: number; // Минимальное время отображения загрузочного экрана
  setMinLoadingTime: (time: number) => void; // Функция для установки минимального времени
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export const useLoading = () => {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
};

export const LoadingProvider = ({ children }: { children: ReactNode }) => {
  const [loadingSources, setLoadingSources] = useState<Set<string>>(new Set(['initial']));
  const [minLoadingTime, setMinLoadingTime] = useState<number>(6000); // 6 секунд минимум
  const [loadingStartTime, setLoadingStartTime] = useState<number>(Date.now());
  
  const registerLoading = useCallback((id: string) => {
    setLoadingSources(prev => new Set(prev).add(id));
  }, []);

  const unregisterLoading = useCallback((id: string) => {
    setLoadingSources(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  }, []);

  // Отслеживаем изменения в loadingSources
  useEffect(() => {
    // Если добавлен новый источник загрузки, обновляем время начала загрузки
    if (loadingSources.size > 0) {
      setLoadingStartTime(Date.now());
    }
  }, [loadingSources.size]);

  // Изначально считаем, что страница грузится, 'initial' удалится в главном layout
  useEffect(() => {
    const handleLoad = () => {
      // Проверяем, прошло ли минимальное время загрузки
      const timeElapsed = Date.now() - loadingStartTime;
      
      if (timeElapsed >= minLoadingTime) {
        unregisterLoading('initial');
      } else {
        // Если не прошло минимальное время, ждем оставшееся время
        const remainingTime = minLoadingTime - timeElapsed;
        setTimeout(() => {
          unregisterLoading('initial');
        }, remainingTime);
      }
    };

    // Проверяем, загрузилось ли уже окно
    if (document.readyState === 'complete') {
      handleLoad();
    } else {
      window.addEventListener('load', handleLoad);
    }
    
    return () => window.removeEventListener('load', handleLoad);
  }, [unregisterLoading, loadingStartTime, minLoadingTime]);

  // Мемоизируем значение контекста для предотвращения ненужных ререндеров
  const contextValue = useMemo(() => ({
    isLoading: loadingSources.size > 0,
    registerLoading,
    unregisterLoading,
    loadingSources,
    minLoadingTime,
    setMinLoadingTime
  }), [loadingSources, registerLoading, unregisterLoading, minLoadingTime]);

  return (
    <LoadingContext.Provider value={contextValue}>
      {children}
    </LoadingContext.Provider>
  );
};