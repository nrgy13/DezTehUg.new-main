# DOCX-шаблоны

Шаблоны для генерации документов клиентам через [docxtemplater](https://docxtemplater.com/).

> 📘 **Актуальная полная инструкция (полный цикл + все плейсхолдеры, включая
> `{#objectServices}` и единицы измерения из Sprint 10): [`TEMPLATE_GUIDE_RU.md`](TEMPLATE_GUIDE_RU.md).**
> Таблицы ниже в этом README частично устарели (нет `objectServices`, `services`, `upd`) —
> сверяйся с гайдом.

## Файлы

| Файл | Что генерирует | Источник-эталон |
|---|---|---|
| `contract-services.docx` | Договор на оказание услуг (дезинсекция / дератизация / дезинфекция) | `tmp/source/ДОГОВОР ООО Аппетит от 28.01.2026 г..pdf` |
| `agreement-addendum.docx` | Дополнительное соглашение к договору (изменение Приложения № 2) | `tmp/source/ДС№4 ООО Аппетит (Архипо-Осиповка).pdf` |
| `inspection-report.docx` | Акт обследования объекта | `tmp/source/Акт обледования шаблон ИП Белавина.docx` |
| `work-completion-report.docx` | Акт о приёмке выполненных работ | `tmp/source/Акт по проведению работ ИП Белавина О.В. Столовая СОК Анапа.docx` |
| `commercial-offer.docx` | Коммерческое предложение | свёрстан с нуля (заменим, если придёт оригинал) |
| `invoice.docx` | Счёт на оплату | свёрстан с нуля (стандартная RU-форма) |

## Сборка и тестирование

```bash
# Все 6 шаблонов
python3 tools/build-templates.py

# Только один
python3 tools/build-templates.py contract

# Smoke-тест: рендерит все шаблоны с тестовыми данными
# Результаты — в tmp/rendered-*.docx (gitignored)
node tools/test-render-all.mjs
```

**Важно:** редактируй структуру и формулировки **только в `tools/build-templates.py`**, а не в самом DOCX. Иначе при правке в Word плейсхолдеры могут «расплыться» по разным `<w:r>`-runs (`{contract.` + `number}` в двух тегах) — docxtemplater их не увидит и в результате будет пусто.

## Синтаксис тегов

Используются **одинарные** фигурные скобки (стандарт docxtemplater):
- Простая подстановка: `{client.shortName}`
- Цикл: `{#priceItems}{serviceName}{/priceItems}`
- Условие: `{?clientType.legal}...{/clientType.legal}` (если потребуется)

**Dot-notation** (`{client.shortName}`) работает только при использовании custom parser из [`lib/render-docx.ts`](../lib/render-docx.ts). Без него — `undefined` в готовом DOCX. Всегда рендеруем через `renderDocx({ template, data })`.

## Общие плейсхолдеры (используются во всех шаблонах)

### Документ-обвязка
| Tag | Описание | Пример |
|---|---|---|
| `{contract.number}` | Номер договора | `ДТЮ-28/01/26-16` |
| `{contract.date}` | Дата заключения | `28 января 2026 г.` |
| `{contract.place}` | Место заключения | `г. Новороссийск` |
| `{contract.endDate}` | Срок действия | `31 декабря 2026 г.` |

### Заказчик (mapping → Drizzle table `clients`)
| Tag | Drizzle column |
|---|---|
| `{client.shortName}` | `short_name` |
| `{client.fullName}` | `full_name` |
| `{client.directorName}` | `director_name` |
| `{client.directorRole}` | `director_role` |
| `{client.actingBasis}` | `acting_basis` |
| `{client.legalAddress}` | `legal_address` |
| `{client.postalAddress}` | `postal_address` |
| `{client.inn}` | `inn` |
| `{client.kpp}` | `kpp` |
| `{client.ogrn}` | `ogrn` |
| `{client.phone}` | `phone` |
| `{client.email}` | `email` |
| `{client.bankName}` | `bank_name` |
| `{client.bankAccount}` | `bank_account` |
| `{client.bankBik}` | `bank_bik` |
| `{client.bankCorrAccount}` | `bank_corr_account` |

### Исполнитель (источник: [`lib/contract-provider.ts`](../lib/contract-provider.ts) / `CONTRACT_PROVIDER`)
| Tag | Описание |
|---|---|
| `{provider.brand}` | ДЕЗТЕХЮГ |
| `{provider.shortName}` | ИП Белавина О.В. |
| `{provider.fullName}` | Индивидуальный предприниматель Белавина Ольга Владимировна |
| `{provider.signatoryFullName}` | Белавина Ольга Владимировна |
| `{provider.signatoryShort}` | О.В.Белавина |
| `{provider.licenseNumber}` | №23.КК.08.003.Л.000016.02.25 |
| `{provider.licenseDate}` | 13.02.2025 |
| `{provider.licenseAuthority}` | Управление Роспотребнадзора по КК |
| `{provider.ogrnip}` | 321237500467390 |
| `{provider.inn}` | 231507022304 |
| `{provider.legalAddress}` | 353915, … |
| `{provider.bankName}` | Краснодарское отделение №8619 ПАО Сбербанк |
| `{provider.bankAccount}` | 40802810330000166200 |
| `{provider.bankBik}` | 040349602 |
| `{provider.bankCorrAccount}` | 30101810100000000602 |
| `{provider.phone}` | 8-988-331-33-32 |
| `{provider.email}` | Adm_dty@mail.ru |

## Специфичные плейсхолдеры по шаблонам

### `agreement-addendum.docx` — Доп. соглашение
| Tag | Описание |
|---|---|
| `{addendum.number}` | Номер ДС (1, 2, 3, …) |
| `{addendum.date}` | Дата заключения ДС |
| `{addendum.place}` | Место заключения |
| `{#priceItems}…{/priceItems}` | Новый прайс (вытесняет Приложение № 2) |

### `inspection-report.docx` — Акт обследования
| Tag | Описание |
|---|---|
| `{report.number}` | № акта |
| `{report.date}` | Дата обследования |
| `{report.objectStatus}` | «удовлетворительное» / «неудовлетворительное» |
| `{report.deviations}` | Выявленные отклонения (свободный текст) |
| `{report.description}` | Краткое описание состояния объекта |
| `{report.recommendation}` | Рекомендация |
| `{report.infestationLevel}` | «не заселён» / «мало заселён» / «много заселён» |
| `{report.hasJournal}` | «нет» / «да» |
| `{report.journalStatus}` | «удовлетворительное» / «требует замены» |
| `{#objects}…{/objects}` | Список обследованных объектов |

### `work-completion-report.docx` — Акт о приёмке работ
| Tag | Описание |
|---|---|
| `{act.number}` | № акта |
| `{act.date}` | Дата выполнения работ |
| `{act.qualityCheck}` | «соответствует» / «не соответствует» |
| `{act.areaCheck}` | «совпадает» / «не совпадает» |
| `{act.actualArea}` | Фактическая площадь обработки, м² |
| `{act.discrepancy}` | Текст несоответствия (если есть) |
| `{act.disinfector}` | ФИО дезинфектора, выполнившего работу |
| `{act.responsibleName}` | ФИО уполномоченного лица заказчика |
| `{act.responsibleRole}` | Должность уполномоченного |
| `{act.responsiblePhone}` | Телефон уполномоченного |
| `{#objects}…{/objects}` | Список обработанных объектов |

### `commercial-offer.docx` — Коммерческое предложение
| Tag | Описание |
|---|---|
| `{offer.number}` | № КП |
| `{offer.date}` | Дата КП |
| `{offer.validUntil}` | Срок действия предложения |
| `{offer.intro}` | Вступительный абзац (опционально) |
| `{offer.totalNet}` | Итог без НДС, руб. |
| `{offer.totalGross}` | Стоимость с НДС 5%, руб. |
| `{offer.totalInWords}` | Сумма прописью |
| `{#priceItems}…{/priceItems}` | Перечень предлагаемых услуг |

### `invoice.docx` — Счёт на оплату
| Tag | Описание |
|---|---|
| `{invoice.number}` | № счёта |
| `{invoice.date}` | Дата выставления |
| `{invoice.dueDate}` | Срок оплаты |
| `{invoice.basis}` | Основание (например: «Договор № X от Y») |
| `{invoice.totalNet}` | Итого без НДС, руб. |
| `{invoice.vatAmount}` | Сумма НДС, руб. |
| `{invoice.totalGross}` | Всего к оплате, руб. |
| `{invoice.totalInWords}` | Сумма прописью |
| `{#priceItems}…{/priceItems}` | Позиции счёта (см. ниже расширенные поля) |

## Поля внутри `{#priceItems}` (масштабируется по шаблонам)

| Tag | Где используется | Описание |
|---|---|---|
| `{serviceName}` | везде | Наименование услуги |
| `{area}` | договор, ДС | Площадь, м² |
| `{method}` | договор, ДС | Метод обработки |
| `{frequency}` | договор, ДС | Кратность (Ежемесячно / По заявке) |
| `{priceNet}` | везде | Цена без НДС |
| `{priceGross}` | договор, ДС | Стоимость с НДС 5% |
| `{index}` | счёт | Порядковый номер позиции |
| `{quantity}` | счёт | Количество |
| `{unit}` | счёт | Единица измерения (усл. / шт. / м²) |
| `{amount}` | счёт | Сумма по позиции |

В будущем `priceItems` замапится на Drizzle table `deal_price_items` (после реализации модуля сделок).

## Поля внутри `{#objects}` (для актов)

| Tag | Описание |
|---|---|
| `{index}` | № п/п |
| `{name}` | Название объекта (Столовая / Склад / …) |
| `{address}` | Адрес объекта |
| `{area}` | Площадь, м² |
| `{service}` | Какая услуга оказана/будет оказана |

В CRM это будет связь с `client_objects` (если у клиента несколько объектов).

## Известные ограничения (на будущее)

- **Падежи**: `{client.directorName}` всегда в именительном падеже («в лице Иванов И.И.» вместо «Иванова И.И.»). Юридически валидно, но стилистически неидеально. Решение: интегрировать [petrovich](https://github.com/zhalovets/petrovich-js) для склонения. Отложено.
- **Сумма прописью**: `{offer.totalInWords}` / `{invoice.totalInWords}` сейчас передаются строкой. На стороне CRM можно сгенерировать через npm-пакет `numbers-to-words-ru` или аналог.
- **Счёт-фактура**: пока не сделан (нужен по запросу для НДС-плательщиков, у нас УСН 5% — обычно достаточно счёта).
- **Договоры на физлиц**: текущий `contract-services.docx` рассчитан на юр. лиц. Для физлиц некоторые поля (`{client.kpp}`, `{client.ogrn}`) останутся пустыми — выглядит криво. Возможно понадобится отдельный `contract-individual.docx`.
