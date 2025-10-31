# DezTehUg - Детальная иерархия страниц и компонентов

## Обзор структуры сайта

**Проект**: DezTehUg (ДЕЗТЕХЮГ) - сайт санитарных услуг с киберпанк дизайном  
**Технологии**: Next.js 13.5.1, TypeScript 5.2.2, Tailwind CSS 3.3.3  
**Статус**: Активная разработка (версия 0.1.0)

---

## Главная страница ([`app/page.tsx`](../app/page.tsx))

### Блоки на странице:

#### 1. **Hero Section** - Главная секция
- **Заголовок**: "ДЕЗТЕХЮГ - Future disinfection today"
- **Описание**: "Elite team of tech specialists. 10 years of flawless work. Complete threat elimination in 24 hours."

**Иконки**:
- [`disinfection.svg`](../../public/icons/services/disinfection.svg) - Иконка дезинфекции
- [`pest-control.svg`](../../public/icons/services/pest-control.svg)
- [`deratization.svg`](../../public/icons/services/deratization.svg)
- [`water-analysis.svg`](../../public/icons/services/water-analysis.svg)

#### 2. **Trust Factors Section** - Секция доверия
- **Заголовок**: "Почему нам доверяют"
- **Описание**: "Наши клиенты доверяют нам самое ценное - свою безопасность."

**Иконки доверия**:
- [`award.svg`](../../public/icons/trust-factors/award.svg) - Награды
- [`zap.svg`](../../public/icons/trust-factors/zap.svg) - Быстрота
- [`clock.svg`](../../public/icons/trust-factors/clock.svg) - Надежность

---

## Страница калькулятора ([`app/calculator/page.tsx`](../app/calculator/page.tsx))

### Блоки на странице:

#### 1. **Calculator Hero Section** - Главная секция калькулятора
- **Заголовок**: "РАССЧИТАТЬ СТОИМОСТЬ УСЛУГ"
- **Описание**: "Узнайте точную стоимость услуг за 2 минуты с помощью нашего калькулятора."

**Иконки**:
- [`money.svg`](../../public/icons/services/shared-cta-finalcta/money-finalcta.svg) - Стоимость
- [`target.svg`](../../public/icons/shared/actions/target.svg) - Цель
- [`shield.svg`](../../public/icons/services/shared-cta-finalcta/shield-finalcta.svg) - Гарантия

---

## Страницы сервисов

### Общая структура всех страниц сервисов:

#### 1. **HeroSection** ([`components/services/HeroSection.tsx`](../components/services/HeroSection.tsx))

**Компонент**: [`HeroSection`](../components/services/HeroSection.tsx))

**Текст**:
- **Заголовок**: Зависит от сервиса
- **Описание**: Детальное описание сервиса
- **Кнопка**: "РАССЧИТАТЬ СТОИМОСТЬ"

**Иконки сервисов**:
- [`ServiceIcon`](../components/ServiceIcon.tsx)) - Основные иконки сервисов

#### 2. **ProblemSection** ([`components/services/ProblemSection.tsx`](../components/services/ProblemSection.tsx))

### Блоки:

#### 1. **Problem Header** - Заголовок проблем
- **Заголовок**: "ПРОБЛЕМЫ" + конкретный подзаголовок
- **Описание**: Общее описание проблем сервиса

**Проблемы**:
- **Иконка проблемы**: [`warning.svg`](../../public/icons/services/shared-problem/warning.svg) - Предупреждение

#### 2. **Problems Grid** - Сетка проблем
- **Проблема 1**: Заголовок + описание + последствия
- **Иконка**: Зависит от конкретной проблемы

#### 3. **SolutionSection** ([`components/services/SolutionSection.tsx`](../components/services/SolutionSection.tsx))

### Блоки:

#### 1. **Solution Header** - Заголовок решения
- **Заголовок**: "НАШЕ РЕШЕНИЕ"
- **Описание**: "Комплексный подход к решению проблемы

**Шаги решения**:
- **Шаг 1**: Заголовок + описание + детали

#### 4. **CTASection** ([`components/services/CTASection.tsx))

### Блоки:

#### 1. **CTA Header** - Заголовок призыва к действию
---

## Компоненты сервисов

### 1. **HeroSection** ([`components/services/HeroSection.tsx`](../components/services/HeroSection.tsx))

**Текст**:
- **Заголовок**: "ЗАКАЖИТЕ УСЛУГУ СЕГОДНЯ"
- **Описание**: "Избавьтесь от проблемы раз и навсегда с помощью профессионалов ДЕЗТЕХЮГ."

**Иконки CTA**:
- [`urgent-cta.svg`](../../public/icons/services/shared-cta-finalcta/urgent-cta.svg) - Срочность
- [`phone-cta.svg`](../../public/icons/services/shared-cta-finalcta/phone-cta.svg) - Телефон
- [`consultation-cta.svg`](../../public/icons/services/shared-cta-finalcta/consultation-cta.svg) - Консультация
- [`guarantee-cta.svg`](../../public/icons/services/shared-cta-finalcta/guarantee-cta.svg) - Гарантия

---

## Система иконок

### Категории иконок:

#### 1. **Service Icons** ([`components/ServiceIcon.tsx`](../components/ServiceIcon.tsx))

**Поддерживаемые иконки**:
- `bug` - Насекомые
- `spray` - Дезинфекция
- `rat` - Грызуны
- `beaker` - Анализ воды

**Файлы**:
- [`disinfection.svg`](../../public/icons/services/disinfection.svg))
- [`pest-control.svg`](../../public/icons/services/pest-control.svg))
- [`deratization.svg`](../../public/icons/services/deratization.svg))
- [`water-analysis.svg`](../../public/icons/services/water-analysis.svg))

#### 2. **TrustFactorIcon** ([`components/TrustFactorIcon.tsx`](../components/TrustFactorIcon.tsx))

**Типы иконок доверия**:
- `award` - Награды
- `zap` - Быстрота
- `clock` - Надежность

#### 3. **WhyChooseUsIcon** ([`components/WhyChooseUsIcon.tsx`](../components/WhyChooseUsIcon.tsx))

**Иконки преимуществ**:
- `shield` - Безопасность
- `zap` - Эффективность
- `award` - Качество
- `check-circle` - Гарантия
- `clock` - Сроки
- `cycle` - Цикличность
- `award` - Награды
- `clock` - Надежность

---

## Данные сервисов

### 1. **Дезинфекция** ([`data/services/disinfection.ts`](../data/services/disinfection.ts))

**Структура данных**:
```typescript
interface ServicePageData {
  hero: HeroSectionProps;
  problem: ProblemSectionProps;
  solution: SolutionSectionProps;
  cta: CTASectionProps;
  finalCta: FinalCTAProps;
  metadata: SEOMetadata;
}
```

### 2. **Дезинсекция** ([`data/services/pest-control.ts`](../data/services/pest-control.ts))
- **Иконки проблем**:
  - [`virus-search-problem.svg`](../../public/icons/services/disinfection/virus-search-problem.svg))
- [`hospital-problem.svg`](../../public/icons/services/disinfection/hospital-problem.svg))
- [`scales-problem.svg`](../../public/icons/services/disinfection/scales-problem.svg))
- [`building-gear-problem.svg`](../../public/icons/services/disinfection/building-gear-problem.svg))
- [`sprinkler-spray-solutionsteps.svg`](../../public/icons/services/disinfection/sprinkler-spray-solutionsteps.svg))
- [`quality-control-solutionsteps.svg`](../../public/icons/services/disinfection/quality-control-solutionsteps.svg))
```

---

## Детальная иерархия по сервисам

### 1. **Дезинфекция** ([`data/services/disinfection.ts`](../data/services/disinfection.ts))

**Структура**:
- **Hero section**: Заголовок, описание, иконки
- **Problem section**: Заголовок, описание, сетка проблем
- **Solution section**: Заголовок, описание, шаги решения
- **WhyChooseUs section**: Иконки преимуществ

**Иконки сервиса**:
- [`disinfection.svg`](../../public/icons/services/disinfection.svg))
- **Иконки шагов решения**:
  - [`mircoscope.svg`](../../public/icons/services/disinfection/microscope-solutionsteps.svg))
- [`clipboard-solutionsteps.svg`](../../public/icons/services/disinfection/clipboard-solutionsteps.svg))
- [`shield-guarantee.svg`](../../public/icons/services/disinfection/shield-guarantee.svg) - Гарантия качества
- [`sprinkler-spray-solutionsteps.svg`](../../public/icons/services/disinfection/sprinkler-spray-solutionsteps.svg))
- [`hospital-problem.svg`](../../public/icons/services/disinfection/hospital-problem.svg))

### 2. **Дезинсекция** ([`data/services/pest-control.ts`](../data/services/pest-control.ts))

**Проблемы дезинфекции**:
- **Проблема 1**: "Распространение инфекций"
- **Иконка**: [`virus-search-problem.svg`](../../public/icons/services/disinfection/virus-search-problem.svg))

---

## Ключевые файлы и ссылки

### Основные компоненты:

- **[`HeroSection`](../components/services/HeroSection.tsx)) - Главная секция
- **[`ProblemSection`](../components/services/ProblemSection.tsx)) - Секция проблем
- **Проблема 2**: "Ущерб здоровью"
- **Иконка**: [`scales-problem.svg`](../../public/icons/services/disinfection/scales-problem.svg))
- **[`SolutionSection`](../components/services/SolutionSection.tsx)) - Секция решений

### Иконки:

#### **Service Icons**:
- [`bug.svg`](../../public/icons/services/pest-control/bug-problem.svg))
- [`food-garbage-problem.svg`](../../public/icons/services/pest-control/food-garbage-problem.svg))
- [`sick-infection-problem.svg`](../../public/icons/services/pest-control/sick-infection-problem.svg))
- [`clipboard-check-solutionsteps.svg`](../../public/icons/services/pest-control/clipboard-check-solutionsteps.svg))
- [`search-pest-solutionsteps.svg`](../../public/icons/services/pest-control/search-pest-solutionsteps.svg))

---

## Заключение

Этот документ предоставляет полную иерархию всех страниц сайта DezTehUg с детальным описанием всех блоков, используемого текста и иконок. Все ссылки на файлы являются кликабельными и ведут к соответствующим файлам в проекте.

**Использование**:
- Для быстрого поиска конкретных блоков и их содержимого
- Для точного определения где находятся иконки и тексты
- Для планирования изменений в дизайне и контенте

---

*Последнее обновление: 24 октября 2025, 23:07 (UTC+3)*
*Версия документа: 1.0.0*
*Статус: Активная разработка*
*Ответственный: Kilo Code*