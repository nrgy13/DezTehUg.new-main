# Отчет о завершении задачи

## Общая информация

**Дата завершения:** `{{completionDate}}`  
**Время выполнения:** `{{totalDuration}}`  
**Режим выполнения:** `{{executionMode}}`  
**ID задачи:** `{{taskId}}`  
**ID сессии:** `{{sessionId}}`

---

## Описание задачи

### Исходная задача
```
{{originalTask}}
```

### Итоговый результат
```
{{finalResult}}
```

### Статус завершения
- **Статус:** {{completionStatus}}
- **Успешность:** {{successRate}}%
- **Качество:** {{qualityScore}}/10

---

## Выполненная работа

### Созданные файлы ({{createdFilesCount}})
{{#createdFiles}}
- **{{path}}** ({{size}} байт)
  - Назначение: {{purpose}}
  - Тип: {{fileType}}
  - Строк кода: {{linesOfCode}}
  - Зависимости: {{dependencies}}
{{/createdFiles}}

### Измененные файлы ({{modifiedFilesCount}})
{{#modifiedFiles}}
- **{{path}}**
  - Тип изменений: {{modificationType}}
  - Добавлено строк: +{{linesAdded}}
  - Удалено строк: -{{linesRemoved}}
  - Изменения: {{changesSummary}}
  - Влияние: {{impact}}
{{/modifiedFiles}}

### Удаленные файлы ({{deletedFilesCount}})
{{#deletedFiles}}
- **{{path}}** - {{reason}}
{{/deletedFiles}}

---

## Технические достижения

### Реализованные функции
{{#implementedFeatures}}
- **{{name}}**
  - Описание: {{description}}
  - Сложность: {{complexity}}
  - Тестирование: {{testStatus}}
  - Документация: {{documentationStatus}}
{{/implementedFeatures}}

### Исправленные ошибки
{{#fixedBugs}}
- **{{title}}** ({{severity}})
  - Описание: {{description}}
  - Решение: {{solution}}
  - Время на исправление: {{timeToFix}}
{{/fixedBugs}}

### Оптимизации
{{#optimizations}}
- **{{area}}**
  - Улучшение: {{improvement}}
  - Метрика: {{metric}}
  - Результат: {{result}}
{{/optimizations}}

---

## Архитектурные решения

### Использованные паттерны
{{#patterns}}
- **{{name}}** - {{description}}
  - Применение: {{usage}}
  - Преимущества: {{benefits}}
{{/patterns}}

### Технологический стек
- **Языки:** {{languages}}
- **Фреймворки:** {{frameworks}}
- **Библиотеки:** {{libraries}}
- **Инструменты:** {{tools}}

### Структура проекта
```
{{projectStructure}}
```

---

## Метрики производительности

### Использование ресурсов
- **Общее время:** {{totalTime}}
- **Активное время:** {{activeTime}}
- **Время ожидания:** {{idleTime}}
- **Использованные токены:** {{totalTokens}}
- **Эффективность токенов:** {{tokenEfficiency}}%

### Статистика действий
- **Всего действий:** {{totalActions}}
- **Успешных действий:** {{successfulActions}}
- **Неудачных действий:** {{failedActions}}
- **Повторных попыток:** {{retryAttempts}}

### Операции с файлами
- **Чтений файлов:** {{fileReads}}
- **Записей файлов:** {{fileWrites}}
- **Модификаций:** {{fileModifications}}
- **Поиск в файлах:** {{fileSearches}}

---

## Качество кода

### Метрики качества
- **Покрытие тестами:** {{testCoverage}}%
- **Сложность кода:** {{codeComplexity}}
- **Дублирование кода:** {{codeDuplication}}%
- **Соответствие стандартам:** {{codeStandards}}%

### Проведенные проверки
- [{{testsStatus}}] **Тестирование**
- [{{lintingStatus}}] **Линтинг**
- [{{typeCheckStatus}}] **Проверка типов**
- [{{securityCheckStatus}}] **Проверка безопасности**
- [{{performanceCheckStatus}}] **Проверка производительности**

### Найденные проблемы
{{#codeIssues}}
- **{{severity}}:** {{description}}
  - Файл: {{file}}:{{line}}
  - Рекомендация: {{recommendation}}
{{/codeIssues}}

---

## Тестирование

### Результаты тестов
- **Всего тестов:** {{totalTests}}
- **Пройдено:** {{passedTests}}
- **Провалено:** {{failedTests}}
- **Пропущено:** {{skippedTests}}
- **Покрытие:** {{testCoverage}}%

### Типы тестов
{{#testTypes}}
- **{{type}}:** {{count}} тестов ({{coverage}}% покрытие)
{{/testTypes}}

### Провалившиеся тесты
{{#failedTestDetails}}
- **{{testName}}**
  - Ошибка: {{error}}
  - Ожидалось: {{expected}}
  - Получено: {{actual}}
{{/failedTestDetails}}

---

## Документация

### Созданная документация
{{#documentation}}
- **{{type}}:** {{path}}
  - Размер: {{size}}
  - Полнота: {{completeness}}%
{{/documentation}}

### Комментарии в коде
- **Общее количество:** {{totalComments}}
- **Функции с комментариями:** {{documentedFunctions}}%
- **Классы с комментариями:** {{documentedClasses}}%

---

## Проблемы и решения

### Встреченные проблемы
{{#problems}}
- **{{title}}** ({{severity}})
  - Описание: {{description}}
  - Время обнаружения: {{discoveryTime}}
  - Время решения: {{resolutionTime}}
  - Решение: {{solution}}
  - Предотвращение: {{prevention}}
{{/problems}}

### Нерешенные вопросы
{{#openIssues}}
- **{{title}}** ({{priority}})
  - Описание: {{description}}
  - Влияние: {{impact}}
  - Рекомендуемые действия: {{recommendedActions}}
{{/openIssues}}

---

## Развертывание и интеграция

### Готовность к развертыванию
- **Статус:** {{deploymentStatus}}
- **Среда:** {{targetEnvironment}}
- **Требования:** {{deploymentRequirements}}

### Интеграционные тесты
- **Статус:** {{integrationTestStatus}}
- **Покрытие:** {{integrationCoverage}}%
- **Критические пути:** {{criticalPaths}}

### Миграции
{{#migrations}}
- **{{name}}** - {{status}}
  - Описание: {{description}}
  - Риски: {{risks}}
{{/migrations}}

---

## Рекомендации

### Следующие шаги
{{#nextSteps}}
1. **{{title}}** ({{priority}})
   - Описание: {{description}}
   - Ожидаемое время: {{estimatedTime}}
   - Ресурсы: {{requiredResources}}
{{/nextSteps}}

### Улучшения
{{#improvements}}
- **{{area}}:** {{suggestion}}
  - Обоснование: {{reasoning}}
  - Приоритет: {{priority}}
  - Сложность: {{complexity}}
{{/improvements}}

### Мониторинг
{{#monitoring}}
- **{{metric}}:** {{description}}
  - Пороговые значения: {{thresholds}}
  - Частота проверки: {{frequency}}
{{/monitoring}}

---

## Команды для воспроизведения

### Установка зависимостей
```bash
{{installCommands}}
```

### Сборка проекта
```bash
{{buildCommands}}
```

### Запуск тестов
```bash
{{testCommands}}
```

### Запуск приложения
```bash
{{runCommands}}
```

---

## Приложения

### Логи выполнения
```
{{executionLogs}}
```

### Конфигурационные файлы
{{#configFiles}}
- **{{name}}:** {{path}}
  - Назначение: {{purpose}}
{{/configFiles}}

### Скриншоты/Демонстрация
{{#screenshots}}
- **{{title}}:** {{path}}
  - Описание: {{description}}
{{/screenshots}}

---

## Подпись

**Выполнено:** KiloCode (Code Mode)  
**Дата:** {{completionDate}}  
**Версия системы:** {{systemVersion}}  
**Хеш сессии:** {{sessionHash}}

---

*Этот отчет автоматически сгенерирован системой автосохранения KiloCode*  
*Версия шаблона: 1.0.0*