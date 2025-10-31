# Интеграция анимационных иконок в DezTehUg

## 1. Обзор

Этот документ описывает структуру, правила и процедуры интеграции анимационных иконок в проект DezTehUg. Анимационные иконки используют библиотеку Lottie для отображения JSON-анимаций, созданных в Adobe After Effects или других инструментах.

**Цель документа**: предоставить разработчикам полное руководство по работе с анимационными иконками, включая их создание, интеграцию и оптимизацию.

**Технологический стек**:
- **Lottie React**: библиотека для рендеринга Lottie-анимаций
- **Next.js 13+**: фреймворк с App Router
- **TypeScript**: типизация компонентов
- **JSON**: формат данных анимаций

## 2. Структура файлов

### Расположение файлов

Все JSON-файлы анимаций хранятся в директории [`public/animations/`](public/animations/):

```
public/animations/
├── .gitkeep
├── antibiotic.json
├── insect.json
└── microscope.json
```

### Правила именования файлов

1. **Формат имени**: `kebab-case.json`
2. **Язык**: английский (transliteration при необходимости)
3. **Описательность**: имя должно отражать содержимое анимации
4. **Расширение**: обязательное `.json`

**Примеры корректных имен**:
- `antibiotic.json` ✅
- `insect-destroyer.json` ✅
- `water-analysis.json` ✅
- `disinfection-process.json` ✅

**Некорректные имена**:
- `animation1.json` ❌ (не описательно)
- `Антибиотик.json` ❌ (кириллица)
- `antibiotic` ❌ (нет расширения)

### Структура директории

- **[`public/animations/`](public/animations/)**: основная директория для всех JSON-файлов анимаций
- **[`.gitkeep`](public/animations/.gitkeep)**: обеспечивает сохранение директории в Git
- **Будущие расширения**: при росте количества анимаций можно создать поддиректории по категориям

## 3. Компонент `AnimatedIcon`

### Описание компонента

[`AnimatedIcon`](components/AnimatedIcon.tsx) - это React-компонент для отображения Lottie-анимаций с динамической загрузкой данных.

**Файл компонента**: [`components/AnimatedIcon.tsx`](components/AnimatedIcon.tsx)

### Интерфейс пропсов

```typescript
interface AnimatedIconProps {
  animationName: string;    // Имя файла анимации (без расширения .json)
  className?: string;       // Дополнительные CSS классы для стилизации
}
```

### Пропсы

| Пропс | Тип | Обязательный | Описание |
|-------|-----|-------------|----------|
| `animationName` | `string` | ✅ Да | Имя JSON-файла анимации (без расширения) |
| `className` | `string` | ❌ Нет | Дополнительные CSS классы для кастомизации |

### Внутренняя логика компонента

1. **Динамическая загрузка**: компонент использует `fetch` для загрузки JSON-данных
2. **Обработка ошибок**: при ошибке загрузки компонент возвращает `null`
3. **Клиентский рендеринг**: компонент помечен как `'use client'` для работы с `useState` и `useEffect`

### Пример использования

```typescript
// Базовое использование
<AnimatedIcon animationName="antibiotic" />

// С дополнительными классами
<AnimatedIcon 
  animationName="insect" 
  className="w-16 h-16 text-poison-green" 
/>

// В контексте другого компонента
const HeroSection = () => {
  return (
    <div className="flex items-center space-x-4">
      <AnimatedIcon 
        animationName="microscope" 
        className="w-24 h-24" 
      />
      <h1>Дезинфекция</h1>
    </div>
  );
};
```

## 4. Интеграция в страницы/компоненты

### Базовая интеграция

```typescript
// Импорт компонента
import AnimatedIcon from '@/components/AnimatedIcon';

// Использование в JSX
export default function ServicePage() {
  return (
    <section className="service-hero">
      <AnimatedIcon animationName="antibiotic" className="w-32 h-32" />
      <h2>Профессиональная дезинфекция</h2>
    </section>
  );
}
```

### Условный рендеринг

```typescript
// Динамический выбор анимации
const ServiceAnimation = ({ serviceType }: { serviceType: string }) => {
  const animationMap: Record<string, string> = {
    disinfection: 'antibiotic',
    'pest-control': 'insect',
    deratization: 'rat-trap',
    'water-analysis': 'microscope'
  };

  const animationName = animationMap[serviceType] || 'default';

  return (
    <AnimatedIcon 
      animationName={animationName} 
      className="w-20 h-20" 
    />
  );
};

// Использование в компоненте
const ServiceCard = ({ service }: { service: ServiceProps }) => {
  return (
    <div className="service-card">
      <ServiceAnimation serviceType={service.type} />
      <h3>{service.title}</h3>
    </div>
  );
};
```

### Интеграция с Tailwind CSS

```typescript
// Киберпанк стилизация
const CyberpunkAnimatedIcon = ({ animationName }: { animationName: string }) => {
  return (
    <div className="relative group">
      <div className="absolute inset-0 bg-poison-green opacity-20 blur-xl group-hover:opacity-30 transition-opacity" />
      <AnimatedIcon 
        animationName={animationName}
        className="relative w-16 h-16 filter drop-shadow-[0_0_8px_rgba(57,255,20,0.5)] group-hover:drop-shadow-[0_0_12px_rgba(57,255,20,0.8)] transition-all"
      />
    </div>
  );
};
```

### Интеграция в существующие компоненты

```typescript
// Пример интеграции в HeroSection
import AnimatedIcon from '@/components/AnimatedIcon';

const HeroSection = ({ title, animation }: HeroSectionProps) => {
  return (
    <div className="flex flex-col items-center space-y-6">
      <div className="relative">
        <FloatingParticles />
        <AnimatedIcon 
          animationName={animation} 
          className="w-32 h-32 md:w-48 md:h-48 relative z-10" 
        />
      </div>
      <h1 className="text-4xl md:text-6xl font-orbitron text-poison-green">
        {title}
      </h1>
    </div>
  );
};
```

## 5. Добавление новых анимаций

### Пошаговая инструкция

#### Шаг 1: Создание анимации

1. **Создайте анимацию** в Adobe After Effects или другом инструменте
2. **Экспортируйте** в формате JSON с помощью Bodymovin или LottieFiles
3. **Оптимизируйте** размер файла (удалите неиспользуемые элементы, упростите пути)

#### Шаг 2: Подготовка файла

1. **Проверьте валидность** JSON-файла
2. **Оптимизируйте размер** (цель: < 100KB для простых анимаций)
3. **Переименуйте файл** согласно правилам именования

```bash
# Пример переименования
mv animation-1.json antibiotic.json
```

#### Шаг 3: Размещение в проекте

1. **Скопируйте файл** в директорию [`public/animations/`](public/animations/):
```bash
cp antibiotic.json public/animations/
```

2. **Проверьте доступность** через браузер:
```
http://localhost:3000/animations/antibiotic.json
```

#### Шаг 4: Интеграция в компонент

1. **Добавьте использование** в нужном компоненте:
```typescript
<AnimatedIcon animationName="antibiotic" className="w-16 h-16" />
```

2. **Протестируйте отображение** в различных размерах
3. **Проверьте производительность** в браузерных инструментах

#### Шаг 5: Оптимизация (опционально)

1. **Проверьте вес файла**:
```bash
ls -lh public/animations/antibiotic.json
```

2. **Оптимизируйте при необходимости**:
   - Упростите анимацию
   - Уменьшите количество кадров
   - Используйте сжатие

### Валидация анимации

```typescript
// Проверка загрузки анимации
const validateAnimation = async (animationName: string) => {
  try {
    const response = await fetch(`/animations/${animationName}.json`);
    if (!response.ok) {
      throw new Error(`Animation ${animationName} not found`);
    }
    const data = await response.json();
    console.log(`Animation ${animationName} loaded successfully:`, data);
    return true;
  } catch (error) {
    console.error(`Error loading animation ${animationName}:`, error);
    return false;
  }
};

// Использование в разработке
validateAnimation('antibiotic');
```

## 6. Рекомендации

### Оптимизация размера файлов

1. **Целевой размер**: < 100KB для простых анимаций, < 500KB для сложных
2. **Сжатие**: используйте gzip-сжатие на сервере
3. **Оптимизация путей**: упрощайте векторные пути в After Effects
4. **Количество кадров**: используйте минимально необходимое количество кадров

```typescript
// Пример проверки размера анимации
const checkAnimationSize = async (animationName: string) => {
  const response = await fetch(`/animations/${animationName}.json`);
  const blob = await response.blob();
  const sizeInKB = blob.size / 1024;
  
  console.log(`Animation ${animationName} size: ${sizeInKB.toFixed(2)} KB`);
  
  if (sizeInKB > 500) {
    console.warn(`Animation ${animationName} is too large (> 500KB)`);
  }
};
```

### Доступность (Accessibility)

1. **Альтернативный текст**: добавляйте `aria-label` для смысловых анимаций
2. **Остановка анимации**: предоставляйте возможность остановить анимацию
3. **Предпочтения пользователя**: уважайте `prefers-reduced-motion`

```typescript
// Доступная версия компонента
const AccessibleAnimatedIcon = ({ 
  animationName, 
  className, 
  ariaLabel 
}: AnimatedIconProps & { ariaLabel?: string }) => {
  const [isReduced, setIsReduced] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setIsReduced(mediaQuery.matches);
    
    const handleChange = (e: MediaQueryListEvent) => {
      setIsReduced(e.matches);
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  if (isReduced) {
    // Показать статическую иконку вместо анимации
    return <StaticIcon name={animationName} className={className} />;
  }

  return (
    <div 
      role="img" 
      aria-label={ariaLabel}
      aria-describedby={`${animationName}-description`}
    >
      <AnimatedIcon animationName={animationName} className={className} />
      <div id={`${animationName}-description`} className="sr-only">
        Анимация, показывающая {ariaLabel}
      </div>
    </div>
  );
};
```

### Производительность

1. **Ленивая загрузка**: используйте для анимаций вне первого экрана
2. **Кэширование**: настройте кэширование JSON-файлов на сервере
3. **Дебаунсинг**: для динамических анимаций используйте дебаунсинг

```typescript
// Ленивая загрузка анимации
const LazyAnimatedIcon = ({ animationName, className }: AnimatedIconProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={className}>
      {isVisible ? (
        <AnimatedIcon animationName={animationName} />
      ) : (
        <div className="animate-pulse bg-gray-200 rounded" />
      )}
    </div>
  );
};
```

### Киберпанк стилизация

1. **Цветовая схема**: используйте корпоративные цвета (#39FF14, #FF6B35)
2. **Эффекты свечения**: добавляйте neon-эффекты через CSS
3. **Анимации появления**: комбинируйте с Framer Motion

```typescript
// Киберпанк стилизованная анимация
const CyberpunkAnimation = ({ animationName }: { animationName: string }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="relative"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-poison-green to-neon-orange opacity-20 blur-xl" />
      <AnimatedIcon 
        animationName={animationName}
        className="relative w-24 h-24 filter contrast-125 brightness-110"
      />
      <div className="absolute inset-0 border border-poison-green opacity-50" />
    </motion.div>
  );
};
```

### Тестирование

1. **Кроссбраузерность**: тестируйте в Chrome, Firefox, Safari
2. **Мобильные устройства**: проверьте производительность на мобильных
3. **Разные размеры**: тестируйте в различных размерах контейнера

```typescript
// Тестовый компонент для проверки анимаций
const AnimationTestSuite = () => {
  const animations = ['antibiotic', 'insect', 'microscope'];
  
  return (
    <div className="p-8 space-y-8">
      <h2 className="text-2xl font-bold">Тест анимаций</h2>
      {animations.map(name => (
        <div key={name} className="flex items-center space-x-4">
          <AnimatedIcon animationName={name} className="w-16 h-16" />
          <span>{name}</span>
          <AnimatedIcon animationName={name} className="w-8 h-8" />
          <span>Маленький</span>
          <AnimatedIcon animationName={name} className="w-32 h-32" />
          <span>Большой</span>
        </div>
      ))}
    </div>
  );
};
```

### Поиск и устранение проблем

1. **Ошибка 404**: проверьте правильность имени файла
2. **Ошибка парсинга JSON**: валидируйте JSON-файл
3. **Медленная загрузка**: оптимизируйте размер файла

```typescript
// Компонент с обработкой ошибок
const RobustAnimatedIcon = ({ animationName, className }: AnimatedIconProps) => {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadAnimation = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch(`/animations/${animationName}.json`);
        
        if (!response.ok) {
          throw new Error(`Animation not found: ${animationName}`);
        }
        
        await response.json();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    loadAnimation();
  }, [animationName]);

  if (isLoading) {
    return <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-poison-green" />;
  }

  if (error) {
    return (
      <div className="text-red-500 text-sm">
        Ошибка загрузки анимации: {error}
      </div>
    );
  }

  return <AnimatedIcon animationName={animationName} className={className} />;
};
```

---

## Заключение

Этот документ предоставляет полное руководство по работе с анимационными иконками в проекте DezTehUg. Следуйте изложенным правилам и рекомендациям для обеспечения оптимальной производительности, доступности и соответствия киберпанк стилистике проекта.

**Ключевые моменты**:
- Используйте описательные имена файлов в `kebab-case`
- Оптимизируйте размер JSON-файлов (< 500KB)
- Обеспечивайте доступность для всех пользователей
- Следуйте киберпанк дизайн-системе проекта
- Тестируйте на различных устройствах и браузерах

---

*Создано: 24 октября 2025 г.*  
*Версия документации: 1.0.0*  
*Статус: Активный документ*