# DezTehYug CRM — память проекта

> Файл читается Claude автоматически в начале каждой сессии в этом проекте.
> Обновляй при больших изменениях. Последнее обновление: **2026-06-22 — РЕАЛЬНЫЕ ШАБЛОНЫ «точь-в-точь» (В РАБОТЕ, см. первый блок). Прод HEAD = `7623df2` (не менялся; новое НЕ задеплоено).**

---

## ⚡ ВНИМАНИЕ: где сейчас стоит работа (читать перед стартом!)

# ════════ СЕССИЯ 2026-06-22 — РЕАЛЬНЫЕ ШАБЛОНЫ «ТОЧЬ-В-ТОЧЬ» (В РАБОТЕ, НЕ задеплоено) ════════
**Задача:** сделать DOCX-шаблоны из РЕАЛЬНЫХ доков ИП Белавина (формат 1:1, с логотипом/QR) вместо генерённых python. **Метод:** правка живого .docx — замена конкретики на `{плейсхолдеры}`, НЕ генерация с нуля.

## Сделано (НЕ задеплоено, прод по-прежнему на `7623df2`)
- **Фундамент в `build-data.ts`** (коммит `4b5f404`): `client.directorShort` (инициалы «А.А.Фамилия» из ФИО), `priceItems[].vatLine` (сумма НДС на строку), `priceItemsByObject` (группировка прайса по объектам для мульти-объектных ДС). Аддитивно, существующую генерацию не меняет.
- **Конвертер `tools/build-templates-from-real.py`** — helpers (`has_drawing`/`full_text`/`set_merge`) + `build_ao()` ГОТОВ; `build_avr/build_dogovor/build_ds` — стабы с КАРТАМИ ЗАМЕН в docstring. Запуск: `python tools/build-templates-from-real.py ao|avr|dogovor|ds|all`.
- **Валидатор `tools/render-test-template.js`** — рендер тем же dot-notation парсером, что приложение; проверяет остаточные теги + `<a:blip>` (картинки). Запуск: `node tools/render-test-template.js templates/<file>.docx`.
- **АО (act_inspection) ГОТОВ:** `templates/inspection-report.docx` пересобран из реального «Акт обследования шаблон ИП Белавина». Заголовок +`{report.date}`, строка `Контактное лицо: {contact.fio}/{contact.phone}`, таблица→`{#objectServices}`, чекбоксы РУЧНЫЕ, логотип+QR сохранены (`<a:blip>`=2), рендер ✓. ⚠️ Саня визуал финально НЕ подтвердил (смотрел `tmp/ao-rendered2.docx`).

## ⛔ КРИТИЧЕСКАЯ ГРАБЛЯ
`python-docx run.text = ""` УДАЛЯЕТ `<w:drawing>` — логотип/QR живут В run'ах! Поэтому `set_merge` ПРОПУСКАЕТ run'ы с картинками. **ВСЕГДА** сверять `<a:blip>` в выводе == исходник (для АО = 2). Первый прогон АО потерял лого+QR — поймали сравнением с реальным доком.

## Решения Сани (зафиксированы)
- **АО:** точь-в-точь + строка контакта (добавлена).
- **АВР:** «соответствует/совпадает» — РУКАМИ (статикой), «уполномоченное лицо» — АВТО (`{act.responsibleName/Role/Phone}`).
- **ДС:** ВЛОЖЕННЫЙ цикл по объектам (`{#priceItemsByObject}` → `{#items}`), НЕ «ДС на один объект».
- **Инициалы директора:** поле `directorShort` (авто), сделано.
- **АО чекбоксы состояния** (◻ удовл/заселён/журнал) — РУЧНЫЕ, НЕ плейсхолдеры.

## ОСТАЛОСЬ (новая сессия)
1. Собрать **АВР → Договор → ДС** тем же конвейером (реализовать `build_avr/build_dogovor/build_ds` в конвертере — карты замен в их docstring; детальный план `tmp/plans/templates-plan.md` если та же машина). Каждый: править → `render-test` (теги + `<a:blip>`) → Саня сверяет визуал в Word.
2. Источники (gitignored, локально у Сани): `DTUdocs/` (АО/АВР/ДС), `DTU_docs_clients/Договора на заключение — копия/` (договоры). Под новым аккаунтом эти папки нужны локально.
3. **ДЕПЛОЙ всех 4 шаблонов + build-data ВМЕСТЕ** в конце (templates/*.docx — активный seed читает файл; ⚠️ `build-templates.py` для этих типов больше НЕ запускать — перезатрёт hand-crafted). Бэкап не нужен (шаблоны файловые), но прокатать smoke.
4. Счёт/УПД/КП — исходников в DTUdocs НЕТ, Саня даст отдельно если нужны.

# ════════ СЕССИЯ 2026-06-16 — ПОЛНЫЙ ХЕНДОФФ ════════

# ════════ СЕССИЯ 2026-06-16 — ПОЛНЫЙ ХЕНДОФФ ════════
Ветка `feature/crm`, БЕЗ миграций во всех деплоях. HEAD на проде и локально = `7623df2`. Working tree чистый, всё запушено. Прод: https://crm.дезтехюг.рф (login 200, app Ready ~260ms, рестартов 0).

## Задеплоенные коммиты (4 шт, по порядку)
1. **`81c707b` — спринт правок (8 из 10 задач от Сани).** Бэкап `prod-db-20260616-before-ten-fixes.sql.gz`.
   - **(1) Номер договора** правится в Реквизитах (`deals/[id]/DealRequisitesTab.tsx` + `updateDeal` + `deals/schemas.ts`; поле опционально, чтобы createDeal-автоген не падал; аудит from→to). Офиц. номер документа `ДГ-2026-NNN` идёт от `document_number_counters`, НЕ от `contractNumber` → правка безопасна.
   - **(2) Каскадное удаление клиента** (Саня ВЫБРАЛ каскад) — `clients/actions.ts::deleteClient(id,{force})` двухшаговый: `needsConfirm` со списком зависимостей → подтверждение в `DeleteClientButton` → транзакция (delete deals каскадит price/addendums/worklogs; delete client каскадит objects/services; leads.client_id SET NULL); документы (файлы+записи) удаляются явно через `executeDocumentDeletion`; полный снимок в `activity_log` (`client.delete_cascade`).
   - **(3) Аппетит «не правится м²»** = клиентская zod молча рубила сабмит из-за невидимой ошибки СТРОКИ УСЛУГИ. Фикс `ObjectForm.tsx`: показ ошибок строк услуг + `toast.error` ВСЕГДА; `clients/schemas.ts` areaM2/quantity `.positive()`→`.nonnegative()`.
   - **(4) Поиск календаря** `components/crm/CalendarFull.tsx`: +masterName +услуга в haystack; при активном поиске показываются ВСЕ совпадения (не только видимый месяц).
   - **(7+8) Сумма НМТП/Карпецов** — арифм. бага НЕТ. Карточка/доки = `Σ price_with_vat`. Расходился только список (читает `deals.total_amount`, пишет только импортёр) ↔ карточка (Σ). У НМТП stored 80000 (годовой договор) ≠ Σ 10000 (разовая). Решение: **«Сумма договора» (`total_amount`) = РУЧНОЕ поле** в Реквизитах + рядом «Итого по прайсу» (Σ). createDeal total не трогает.
   - **(9) Заказ-наряд без услуг** — на проде нарядов 0, баг формы создания. `calendar/work-order-actions.ts::getObjectWorkOrderDefaults` +3-й fallback: услуги из `deal_price_items` по object_id когда `client_object_services` пуст (+дедуп). Реальные услуги на проде живут в прайсе, объектные разрежены.
   - **(10) Навигация** — новый `components/crm/Breadcrumbs.tsx` (Клиенты›Клиент›Договор›Объект) в 3 карточках; табы разведены (клиент «Объекты»→«Все объекты», сделка →«Объекты договора»); объект кликабелен в `VisitsTab`.
   - Импортёр `tools/parse-regina-contracts.py` +дедуп прайс-позиций. ⚠️ дедуп ключует по (service,object_name,area,price,freq) — для сетей с одинаковым именем объекта может ОБ-collapse при реимпорте; реимпорт сейчас не делается.
2. **`30eb20e` — поле «Тип»→«Метка» + метка/адрес в выпадашках объектов.** `object_type` переименован в форме на «Метка» (БД-колонка та же, без миграции). В выпадашках выбора объекта (`PriceItemsTable` прайс + `DealObjectsTab` привязка) показывается «Имя — Метка · Адрес» → сети с одинаковыми именами различимы. «Тип/Метка» в документы НЕ идёт.
3. **`23939db` — удаление документов из общего списка** `/manager/documents`. Кнопка «Удалить» в каждой строке (новый `documents/DeleteDocumentButton.tsx`), переиспользует `deals/actions.ts::deleteDocument` (прямое удаление файлов+записи, права manager/admin, нативный confirm). Работает для ЛЮБОГО документа (включая подписанные), как в карточке сделки.
4. **`7623df2` — контакт объекта в АО (Акт обследования).** В шаблон `templates/inspection-report.docx` добавлены `{contact.fio}`/`{contact.phone}` (контакт с карточки объекта). Правка `tools/build-templates.py::build_inspection_report` → регенерация .docx. Контакт объекта (`client_objects.contactPerson/contactPhone`) теперь во ВСЕХ трёх: АВР (`{act.responsibleName/Phone}`), мастер (`master/visits/[id]/page.tsx` «На месте: …»), АО.

## Прод-правки ДАННЫХ (в БД, НЕ в гите — уже применены)
- **Техникум `b369d927`** (договор `266/25-К`): 4 объекта ПРИВЯЗАНЫ к договору (были deal_id=NULL → акты не генерились, `ObjectActions.tsx:33` требует привязку) + ИМЕНА ПОЧИЩЕНЫ от дублирующего префикса учреждения («Общежитие №2/№3», «Столовая», «Техникум (общая площадь)»). Безопасно для АО/АВР: заказчик в шапку из `client.shortName`, имя объекта только в колонку «Объект».

## КЛЮЧЕВЫЕ РЕШЕНИЯ И НАХОДКИ (важно для продолжения)
- **⛔ «Чистка 58 дублей прайса» ОТМЕНЕНА — это НЕ дубли, а СЕТЕВЫЕ клиенты.** Гончаров = сеть магазинов «Хадыжи» (31 магазин по 31 адресу, одинаковое имя «Торговая точка «Хадыжи»») = 31 строка прайса по 5000 = 155000 (ВЕРНО). Аналогично Устименко 10/10, Сухарникова 10 точек/20 строк, Колисов 2/4, Свистунова/Ярошенко 2/2. **Удалять эти строки НЕЛЬЗЯ** — снесёт цену по реальным точкам. Урок: «одинаковые строки прайса» сверять с КОЛИЧЕСТВОМ ОБЪЕКТОВ клиента.
- **«Сумма договора» — ручная** (не авто-пересчёт из строк): у разных типов договоров строки прайса значат разное (НМТП — разовая, Хадыжи — итог по точке). Авто-пересчёт сломал бы и тех, и других.
- **Тип объекта** в АО/АВР НЕ выводится (проверено по плейсхолдерам) → переназначен под «Метку»-различитель.

## TODO / ОТКРЫТО для следующей сессии
- **Прокликать ВЖИВУЮ под Региной** (всё деплоилось автономно, Claude не кликал; боевых паролей у Claude нет): АО с контактом, удаление документов из списка, «Сумма договора» у НМТП, услуги в заказ-наряде, выпадашки объектов с меткой/адресом, каскад-удаление (на ТЕСТОВОМ клиенте, НЕ на КНГК!).
- **п.5/6 техникум** — должны быть сняты (привязка объектов + метка/адрес в выпадашках); если ещё проявятся — нужен точный симптом от Сани.
- **Хадыжи (31 объект)** — оставлены как есть; при желании Регина впишет короткие «Метки» магазинам.
- **Адреса техникума** — у всех 4 объектов один адрес (артефакт импорта), Регина правит сама. Прайс техникума весь на одном объекте — по желанию развести по корпусам.
- **Опц.:** прятать строку контакта в АО при пустом контакте (сейчас покажет пустую «Контактное лицо: , тел.»).

## ИНФРА / ГРАБЛИ (для деплоя под новым аккаунтом)
- **Деплой:** `ssh root@91.229.90.53 -i ~/.ssh/id_ed25519_nopass` → `cd /opt/deztech-crm && git fetch origin feature/crm && git reset --hard origin/feature/crm && docker compose -f docker-compose.prod.yml --env-file .env build app && docker compose ... up -d --force-recreate app` → smoke (login 200). Бэкап перед деплоем: `docker exec deztech-crm-postgres pg_dump -U deztech deztech_crm | gzip > /opt/deztech-crm/prod-db-YYYYMMDD-...sql.gz`.
- **Beget:** при ВНЕЗАПНОМ SSH+HTTPS timeout (оба порта) — ПЕРВЫМ делом проверить баланс/статус VPS в панели Beget, НЕ firewall (15.06 VPS останавливался сам, ожил перезапуском).
- **PowerShell→ssh:** кириллица в SQL — `$OutputEncoding = New-Object System.Text.UTF8Encoding $false` (без BOM) + SQL через **stdin-пайп** (`$sql | ssh ... 'docker exec -i ... psql ...'`); `{{...}}` в `docker --format` и `psql -c` через ssh ЛОМАЮТСЯ (брать `docker ps | grep` и stdin-пайп).
- **Генерация документов** Claude НЕ может (endpoint `/api/documents/generate` за `auth()`, боевых паролей нет) — вывод проверяется реконструкцией по плейсхолдерам+данным, либо Регина кликает.
- **Шаблоны:** активные на проде = seed (`document_templates.s3_key='seed:NAME.docx'`) → `get-template.ts` читает ФАЙЛ из репо `templates/`. Обновить базовый шаблон = править `tools/build-templates.py` → `python tools/build-templates.py <type>` → коммит .docx → деплой (rebuild запекает файл), БД не трогать.

---

## 🕸️ ГРАФ КОДА — ИСПОЛЬЗОВАТЬ для навигации по проекту
У проекта есть карта кода (graphify, AST по исходникам, **0 токенов**). **Перед ручным grep/Read для вопросов про архитектуру и зависимости — СНАЧАЛА спроси граф:** «что зависит от X», «что вызывает/тянет Y», «как связаны модули A и B», «где ядро».
- **Запрос:** `graphify query "<вопрос>"` (BFS по связям, без токенов). **Пересобрать** (граф стареет после правок): `/graph-code .` (скилл-обёртка; AST-кэш ускоряет).
- **Артефакты** в `graphify-out/` (gitignored, локальный — НЕ в репо): `graph.html` (открыть в браузере), `graph.json`, `GRAPH_REPORT.md`. ⚠️ Под новым аккаунтом папки нет → собрать заново через `/graph-code .`.
- **Ядро (god-nodes, 2026-06-17, 325 файлов / 1785 нод):** `cn()`, `DB` (Drizzle-пул), `requireRole()` (auth-гард), UI-кит (`CyberpunkButton`/`CyberpunkCard`/`PageTitle`), таблицы `users`/`clients`/`deals`/`services`. Import-цикл (мелочь): `lib/mailer/index.ts ↔ transports/{noop,smtp}.ts`.

**CRUD заявок (leads) для Регины ЗАДЕПЛОЕН на prod 2026-06-10** (коммит `e45e871`, ветка feature/crm, БЕЗ миграций). Бэкап `prod-db-20260610-0818-before-leads-crud.sql.gz`. Smoke ✅ (Ready 289ms, login 200, /manager/leads 307, рестартов 0). В модуле заявок были только Create (`NewLeadModal`) и Read — добавлены **U и D**. **UPDATE:** `updateLead` (server action) + `EditLeadModal` (правка имени/телефона/email/адреса/услуг/площади/заметки), кнопка «Редактировать» в карточке заявки `/manager/leads/[id]`; аудит `lead.update` пишет только изменённые поля; контакт гибкий (телефон ≥5 ЦИФР или email). **DELETE:** `deleteLead` + кнопка «Удалить» с подтверждением, только для ошибочных/спам/дубль; сконвертированную заявку (clientId≠null) удалить НЕЛЬЗЯ (серверный гард + недоступная кнопка — на ней история воронки/аналитика, CASCADE снёс бы `lead_status_history`); перед удалением полный снимок записи в `activity_log`. Роль-гард manager/admin в обоих. Прошло **adversarial-review** (5 ревьюеров+скептики, 18→9 находок): пофикшены дробная площадь (округление+step, иначе zod `.int()` ломал сохранение англо-ошибкой — заодно в `NewLeadModal`), неполный аудит-снимок, удаление converted, «телефон» без цифр, guard закрытия модалки. Файлы: `app/(crm)/manager/leads/{actions.ts,LeadActions.tsx,[id]/page.tsx,_components/EditLeadModal.tsx,_components/NewLeadModal.tsx}`. Подробности: `memory/leads_crud_deployed.md`. ⚠️ Деплой выверен smoke+tsc+build+ревью; вживую под Региной НЕ кликал (автономная сессия, Саня уехал).

**Спринт полировки заказ-нарядов P1-P4 ЗАДЕПЛОЕН на prod 2026-06-09** (коммит `b6db08d`, ветка feature/crm, БЕЗ миграций). Бэкап `prod-db-20260609-2133-before-polish-sprint.sql.gz`. Smoke ✅ (Ready 245ms, login 200, manager 307). **P1** заказ-наряды у мастера: был «Без услуги» + пустой объект на КАЖДОМ наряде (прайс-автомат отключён Релизом A → все выезды `priceItemId=null`) → теперь услуги из snapshot `dealWorkLogServices`, объект через `dealWorkLogs.objectId`, карточка «Услуги и препараты» (`/master`, `/master/visits/[id]`). **P2** дата наряда трактуется в Europe/Moscow (новый `lib/datetime/msk.ts::mskLocalToUtcISO`), показ дат выездов в МСК — флажок серии больше не уезжает при не-МСК браузере (на проде СПИТ, 0 услуг с частотой; unit-проверка границы суток ✓). **P3 (вариант A)** `na` на обязательном пункте требует заметку-обоснование (гейт в `finalizeVisit` + красная подсветка поля у мастера). **P4** push мастеру при создании наряда (+ push/`activity_log` при удалении `deleteWorkOrder`), дедуп пунктов при append, удалён мёртвый код прайс-автомата (`seedPlannedVisitsForDeal`/`createPlannedVisitForPriceItem`). Подробности: `memory/polish_sprint_deployed.md`.
⚠️ **НЕ проверено вживую** (деплой без preview — Docker выключен, машина Сани тормозит): P1 визуал у мастера, P3 finalize-гейт E2E, P4 push/дедуп/аудит. Деплой выверен smoke + tsc×4 + build + P2-unit. **Проверить Регине+мастером на проде** (открыть наряд у мастера → услуга/объект/препараты; пометить обяз. пункт «неприменимо» без заметки → блок).

**Чеклист для мастера в форме наряда + аудит-фиксы ЗАДЕПЛОЕНЫ на prod 2026-06-09** (коммиты `7250525`/`7089f64`/`eb69eba`, БЕЗ миграций). Автономная ночная сессия. ФИЧА: Регина собирает чеклист мастеру в `WorkOrderDialog` (автоподтяг из прошлого наряда/шаблонов услуг, ручные пункты, добавить-заменить, «обязательный»). АУДИТ 3 субагентами → 32 находки, пофикшено 10 (роль в getActor — master мог CRUD объекты!; bodySizeLimit 6mb — фото мастера было нерабочим; транзакции createWorkOrder/addObject; атомарный finalize; статус-гарды; дубль-защита наряда). Бэкап `prod-db-20260609-0407-before-night-fixes.sql.gz`. Подробности: `memory/checklist_and_audit_fixes.md`.

**Заказ-наряды Релиз B ЗАДЕПЛОЕН на prod 2026-06-08** (коммит `dd5b100`, ветка `feature/crm`). Миграция **0019** (`client_object_services ADD COLUMN IF NOT EXISTS frequency varchar(64)`) применена на **DEV и PROD**. Деплой: бэкап `prod-db-20260608-0220-before-release-b.sql.gz` (74K) → `git reset --hard origin/feature/crm` (→`e9e4429`) → 0019 `ALTER TABLE` ✓ → rebuild app (61.6s) → smoke ✅ (`Ready in 240ms`, login 200, /manager 307, manifest 200). ⚠️ На проде услуг с заданной частотой **0** — фича цикла «спит», включится когда Регина проставит периодичность услугам объектов. Подробности: `memory/work_orders_release_b.md`. Продолжение Релиза A (`77f90be`/`d676d35`).

**Релиз B — цикл заказ-нарядов + история + переделка таба + видимость + раскладка:**
- **Цикличность:** периодичность на КАЖДОЙ услуге объекта (`client_object_services.frequency`, миграция 0019, значения из `TREATMENT_FREQUENCIES`). Опорная дата цикла = `client_objects.planned_treatment_date` (не сдвигается).
- **Серия напоминаний:** `lib/calendar/object-reminders.ts::getObjectReminders` — виртуальные флажки «оформи наряд» из частоты услуг, серия вперёд 3 мес (окно [сегодня−14д … +3мес]), гашение по наличию work_log на дату (БД циклом НЕ мутируется, всё обратимо). Панель `app/(crm)/manager/calendar/ObjectRemindersPanel.tsx`.
- **Предзаполнение из прошлого наряда:** `getObjectWorkOrderDefaults(objectId)` (work-order-actions) — услуги(snapshot)+препараты+мастер из ПОСЛЕДНЕГО work_log объекта (fallback на `client_object_services`). Общий диалог `components/crm/WorkOrderDialog.tsx` (preset clientId/dealId/objectId/plannedAtLocal) переиспользуется: кнопка календаря, панель напоминаний, карточка объекта, таб сделки.
- **Дашборд-виджет** «По графику ждут наряда: N» (горящие overdue/today/soon) — `manager-stats.workOrdersDue` + `countDueReminders`.
- **Карточка объекта** `/manager/objects/[id]`: блок «Выезды по объекту» (`ObjectVisitsSection` — история work_logs+snapshot услуг+препараты+чеклист N/M+статус+ссылка) + кнопка «Создать выезд» + удаление planned. Периодичность услуг видна в плашках (карточка/таб договора/список клиента).
- **Таб «Выезды» сделки ПЕРЕПИСАН** под наряды: группировка по ОБЪЕКТАМ (был по прайсу → заказ-наряды с `price_item_id=null` НЕ показывались = баг Релиза A, починен). +кнопка «+Заказ-наряд», +удаление planned. Убрана кнопка «Новый выезд» по прайсу + осиротевший `createNextVisitForPriceItem`.
- **Удаление наряда:** `deleteWorkOrder(workLogId)` — только `status=planned`, каскад снимает `deal_work_log_services`+`deal_checklist_items` (FK cascade). Удалил наряд → флажок серии на эту дату возвращается.
- **⚠️ ПОВЕДЕНЧЕСКОЕ: менеджер видит ВСЁ.** Убран фильтр `assignedManagerId` в `getDealEvents` (календарь) и `getObjectReminders` (напоминания). Менеджер/admin видят ВСЕ выезды; мастер — только свои (фильтр masterId остался). Причина: менеджер по факту один (Регина), мастера общие → операционный календарь общий. Баг был: наряд по договору другого менеджера виден на карточке объекта, но не в календаре.
- **Раскладка `CalendarFull`:** список выездов СЛЕВА (широкий lg:w-[30rem] xl:w-[34rem], основная зона), календарь СПРАВА, РАВНОЙ высоты (aside `lg:relative` + внутренний `lg:absolute inset-0` → высоту колонки задаёт календарь, список скроллится). Поиск+фильтры компактной строкой сверху; блок «ВСЕГО/СЕГОДНЯ/...» (StatChip) убран. Карточки списка богатые: статус-бейдж/время/услуга/объект/клиент/договор/телефон/мастер.

**Dev-окружение:** порт зафиксирован **3007** (`.claude/launch.json` `autoPort:false` + `--port 3007`, т.к. 3000 занят сторонним проектом ProTEX). Логин Регина `deztexug@yandex.ru / welcome123`. NB: после логина редиректит на «/» (AUTH_URL на нестандартном порту) — на `/manager/*` переходить вручную. Тест-объект на dev: «Административное здание» НМТП (`b42e5433…`) с серией флажков 25.05–25.08. NB рендера: dev на машине Сани сильно тормозит (C: впритык) — preview_screenshot/eval часто таймаутят, проверка велась DOM-замерами + SQL.

**Осталось:** ✅ деплой выполнен (2026-06-08). Регине — проставить периодичность услугам объектов на проде, чтобы серия флажков «оформи наряд» ожила в календаре (сейчас 0 услуг с частотой). Опц.: докликать карточку объекта + таб «Выезды» вживую на не-тормозящем окружении.

> **NB для тестов:** React-формы/`<select>` в Claude Preview капризны — проверка велась через SQL к dev БД + DOM-замеры (`a[href*="tab=visits"]` для карточек). См. `memory/preview_form_testing_crm.md`, `memory/radix_dropdown_preview_testing.md`.

### Предыдущие вехи (свежие, до Релиза B)
- **Заказ-наряды Релиз A** (`77f90be`+`d676d35`, на prod 2026-06-07): миграция 0018 (`deal_work_logs` +object_id +preparations, таблица `deal_work_log_services`), кнопка «Заказ-наряд» в календаре, `seedPlannedVisitsForDeal` ОТКЛЮЧЁН. `memory/work_orders_release_a.md`.
- **Календарь редизайн** (`ec25e01`): список справа + подсветка дня по ховеру (Релиз B перенёс список влево). `memory/calendar_redesign_hover_list.md`.
- **Sprint 10** (`69194d0`, на prod): единицы+количество у услуг объекта → в АО/АВР (миграция 0017). `memory/sprint10_object_service_units.md`.
- **Sprint 9** (`23a9d9a`, на prod): объекты по договору, единицы м²/ед./м³, права Регины (миграции 0015/0016). `memory/sprint9_objects_units.md`.

---

## Предыдущий статус (для контекста)

**Адаптив панели менеджера под мобилу РАЗВЁРНУТ НА PROD (2026-05-26, коммит `dd10000`).** Ветка `feature/crm`, working tree чистый. UI-only (миграций нет, БД не трогалась). Все страницы менеджера теперь работают на телефоне. Подробности: `memory/manager_mobile_adaptive_committed.md`.
- **Канбаны (лиды/сделки):** на `<lg` вертикальные секции по статусам + кнопка «Переместить» (Radix dropdown) вместо drag; drag остаётся на desktop (`hidden lg:block`). Общая `requestStatusChange` для drag и dropdown; спец-переходы (КП/конверт/lost, расторжение/закрытие) переиспользуют существующие модалки. Файлы: `leads/_components/{LeadBoard,LeadCard,MobileLeadBoard}.tsx`, `deals/board/DealBoardClient.tsx`.
- **Таблицы → карточки** (паттерн `hidden md:table` + `md:hidden` карточки): списки сделок/клиентов/лидов, прайс-позиции (9 кол), история сделки. Таб-бары → `overflow-x-auto`, форма поиска `flex-col sm:flex-row`, диалог прайса `grid-cols-1 sm:grid-cols-N`.
- **Полировка:** дашборд/аналитика/календарь/отчёты/карточка клиента уже были адаптивны (оболочка `CrmShell` с гамбургером + drawer ещё с Sprint 6 + responsive-гриды).
- **Smoke prod:** /login 200, /manager/* 307 (auth-редирект), manifest 200, app «Ready in 214ms». Нюанс: app-порт 3000 НЕ на хосте (только Traefik) → smoke через внешний `https://crm.дезтехюг.рф`, не `localhost:3000`.
- **Осталось (опц.):** адаптив `/admin` тем же паттерном (в скоуп не входил, делали только manager).

**Sprint 7 (data) РАЗВЁРНУТ НА PROD (2026-05-23, коммит `b2826e8`).** Ветка `feature/crm`, working tree чистый. Допилены данные клиентов Регины (без миграций — только данные + tools). Подробности: `memory/sprint7_client_data_deployed.md`.
- **Директора:** было 7/33, стало 32/32 (.docx) + 2 новых. Парсер `tools/parse-regina-contracts.py` чинён (ООО заглавная роль, ИП ФИО+ОГРНИП, склонение по полу, отсечение Исполнителя, фильтр ОТМЕНА). Директор пишется в `clients.directorName/directorRole/actingBasis` (карточка + документы).
- **2 новых клиента:** АО «Флот НМТП» (со скана PDF зрением, ИНН/ОГРН ✓) + ГБПОУ КК «Славянский сельхозтехникум» (.doc через antiword). Данные были в `tmp/extra-clients.json` (удалён с прода после импорта).
- **Импортёр `tools/import-regina-clients.ts` + режим `--fill-blanks`:** безопасный (только пустые поля, не затирает правки, идемпотентный), тип ИП→individual, мердж extra-clients.json. Применялось docker cp в контейнер + `docker exec npx tsx ... --fill-blanks` (бекап `prod-db-20260523-1611-before-directors.sql.gz`).
- **Prod после:** 43 клиента, director_name 34, type=individual 19, login 200.
- **Осталось Регине (вручную):** прайсы Абрау/Аппетит по шпаргалке `tmp/cheatsheet/*.xlsx`; цены позиций Славянского; сверить р/с НМТП; директора у Аппетит/КРЕДО/Туапсе (не из .docx).

**Sprint 6 РАЗВЁРНУТ НА PROD (2026-05-12, коммит `40925ca`).** Ветка `feature/crm`, working tree чистый. Миграции 0011 (push_subscriptions) и 0012 (workLogs+checklists) применены на проде. VAPID keys сгенерены на dev/prod в `.env` обоих. App-контейнер пересобран и работает. Smoke: manifest.webmanifest 200, icons 200, sw.js 42KB, login 200, apple-touch 200.

**Sprint 6 эпики:**
- Эпик 1 PWA: next-pwa + web-push + sharp; иконки ДТЮ 192/512/maskable; manifest; гамбургер sidebar; адаптив /master; push-инфра (VAPID + lib/push/server+client + 2 API endpoints + UI в /profile + кастомный push-sw.js); 3 push-интеграции (assignMaster, requestDateChange, markDealCompleted); install banner для Android+iOS
- Эпик 2 Чеклисты: workLogs расширен (priceItemId, status enum planned/in_progress/completed, planned/started/finalized_at, description+performedAt nullable); таблицы service_checklists + deal_checklist_items + 3 enum; lib/visits/create (seedPlannedVisitsForDeal); Admin UI шаблонов в /admin/services (ChecklistDialog); Manager UI таб «Выезды» в /manager/deals/[id]; Master UI /master со списком выездов; /master/visits/[id] с чеклистом + фото-загрузка до 5×5МБ + finalize + read-only после; /api/storage/checklist/[...path] для раздачи фото

**Что осталось от Сани (вручную):**
- Установить PWA на телефоне Регины через Chrome (Android) или Safari → "На экран Домой" (iOS 16.4+)
- Включить push в `/profile` → секция «Push-уведомления»
- Проверить полный flow: менеджер назначает мастера → у master автоматически появляются planned-выезды → master начинает выезд → отмечает чеклист + фото → finalize → менеджер видит в табе «Выезды»

### Состояние ветки
- Sprint 6 закоммичен и развёрнут (`40925ca`). Working tree чистый.
- Не мерджим в `main` — `feature/crm` остаётся живой веткой разработки CRM, не трогаем `main` (там — публичный сайт).

### ✅ Что закрыто в Спринте 3 (всё на prod, миграция 0003 применена)

**A. Фундамент** — `lib/storage/{index,local}` с защитой от path-traversal (9/9 smoke), `lib/document-number` атомарная нумерация через INSERT ... ON CONFLICT (8/8 smoke, в т.ч. 10 параллельных без коллизий), `lib/render-pdf` через `child_process.spawn('soffice')`, `Dockerfile` переключён на `node:20-slim` + `apt install libreoffice-core libreoffice-writer` (~950МБ).

**B. Каталог услуг** — `/admin/services` с inline-toggle активности и create/edit dialog (`ServicesClient.tsx`).

**C. Сделки** — модуль на 5 actions (createDeal/updateDeal/status/priceItems/master), карточка с 5 табами (Реквизиты/Прайс/Документы/ДС/История), inline-edit реквизитов, прайс-таблица с автосчётом НДС. Кнопка «Создать сделку» в карточке клиента + DealsTab. Конвертация лида расширена чекбоксом «Сразу создать сделку» (default ON).

**D. Документы + шаблоны** — `lib/documents/generate.ts` экстракт-функция, `getActiveTemplate` с fallback на `templates/*.docx`, seed 6 базовых шаблонов через `npm run db:seed:templates`, `/admin/templates` с drag-n-drop upload + валидация через docxtemplater + версионирование, API `/api/documents/generate` переписан, download endpoint, DocumentsTab в карточке сделки с **delete-кнопкой**.

**E. ДС** — отдельный таб в карточке сделки, нумерация в рамках сделки (внутренняя 1/2/3), при генерации DOCX → официальный номер `ДС-2026-NNN` сквозной по году.

**F. Email** — `lib/mailer/{index,transports/smtp,transports/noop}` + `lib/mailer/templates.ts` с body-шаблонами для всех 6 типов документов (HTML+plain text, подпись с контактами компании). UI «Отправить клиенту» в DocumentsTab.

**G. Master UI** — `/master` со списком своих сделок без цен (group by status), `/master/deals/[id]` с контактами клиента, объектами (link на Я.Карты), планом работ, журналом + form `WorkLogForm` для записи работ + кнопка «Завершить выезд».

**H. Admin UI юзеров** — `/admin/users` с CRUD, одноразовый пароль (12 chars, bcrypt-хеш в БД, plaintext только в UI с copy-кнопкой), сброс пароля, защита от деактивации/смены роли самому себе.

**I. Playwright** — `playwright.config.ts` + `tests/e2e/happy-path.spec.ts` (3 теста: дашборд, создание сделки→прайс→DOCX, admin создание юзера). Все 3 зелёные. `npm run test:e2e`.

**K. КП-flow из канбана** — drop лида в колонку «КП отправлено» открывает `ProposalDialog` (тип клиента, название, email, прайс-позиции, срок). Server action `submitProposalForLead` атомарно создаёт черновик клиента (без реквизитов), draft-сделку, прайс, генерирует DOCX КП и отправляет email. При отмене — статус лида откатывается. Удаление документов через корзину в DocumentsTab (DOCX+PDF+signed scan из storage + запись из БД).

**Активные n8n CRM-нода** в workflow `DEzTechUg_bot` (id `SkUMV2EUN8hObo76`) продолжает работать с прошлого спринта.

### Ключевые решения, зафиксированные в Sprint 3

- LibreOffice — `apt install` в app-контейнере (изоляция > размер образа)
- Master без цен и сумм
- Admin показывает одноразовый пароль в UI (не шлёт email)
- Convert лида в сделку — чекбокс default ON
- DOCX-шаблоны через UI (с seed для 6 базовых)
- Нумерация документов сквозная по году+типу: `ДГ-2026-001`, `ДС-2026-001`
- Storage на prod — named volume `app-storage` → `/app/storage` в контейнере (НЕ bind-mount — изначально планировался bind, но есть существующий named volume)
- Mailer в prod = `noop` пока не получен SMTP Yandex 360
- При пустом email body — анти-спам ругается, поэтому body-шаблоны для всех типов документов

### Состояние dev-окружения
- Локальный Docker dev-стек: `deztech-crm-postgres-dev`, redis, mailhog (http://localhost:8025), minio.
- Next.js dev на `localhost:3000` через preview-сервер. Запуск: `mcp__Claude_Preview__preview_start({name:'next-dev'})`. После `npm run build` смешиваются prod/dev артефакты в `.next/` → перед dev-запуском **удалить `.next/` ПЕРЕД restart** (если удалить пока сервер бежит — webpack-runtime сломается с ENOENT).
- БД на dev: содержит данные после Sprint 3 (тестовые лиды, клиенты, сделки, документы, КП). Если нужно — почистить через миграции.
- 3 seed-юзера на `welcome123` (флаг must_change=true изначально, после первого логина в браузере становится false для тестируемых).
- Логин для тестов: `deztexug@yandex.ru / welcome123` (Регина, manager). admin: `sanctumizm@gmail.com`. master: `nrgy131@gmail.com`.
- Email на dev → MailHog (http://localhost:8025), `MAILER_TRANSPORT=smtp` в `.env.local`.

### Конфиги, которые НЕ в гите (gitignored, но критичны)
- `.env.local` — DB, AUTH_SECRET, REDIS, `N8N_INBOUND_SECRET`, `STORAGE_DRIVER=local`, `STORAGE_ROOT=./storage`, `MAILER_TRANSPORT=smtp`.
- `.mcp.json` — n8n MCP API key. API URL `https://n8n.lex1case.ru`. Health-check: `bash tools/check-mcp-health.sh`.
- `tmp/` — папка с образцами договоров (`tmp/source/`) и планами (`tmp/plans/`).
- `storage/` — локальные сгенерированные документы (на prod — named volume `app-storage`).
- `test-results/`, `playwright-report/` — артефакты Playwright.

### MCP инструменты
- **n8n MCP** — работает. Workflow `DEzTechUg_bot` ID = `SkUMV2EUN8hObo76`.
- **Claude Preview** — для запуска dev-сервера и E2E через браузер.
- **Playwright MCP** — будет использоваться в Эпике I для Sprint 3 тестов.
- **context7** и **Docling MCP** — не подключаются (не критично).

---

---

## Что это

CRM-система для **ИП Белавина О.В. (ДезТехЮг)** — компании санитарных услуг:
дезинсекция, дератизация, дезинфекция, фумигация, дезодорация, десерпентация,
гербицидная обработка, анализ воды.

CRM работает **в одном Next.js проекте** с публичным сайтом — разные роуты, общий код.
- Публичный сайт: текущий (на Netlify, домен `deztehug.netlify.app`, в коммитах `app/(public)`-частей)
- CRM-панель: на поддомене `crm.дезтехюг.рф`, роуты `/admin`, `/manager`, `/master`, `/login`

---

## Production-инфраструктура (РАБОТАЕТ 24/7)

| Параметр | Значение |
|---|---|
| **Production URL** | https://crm.дезтехюг.рф |
| **VPS** | Beget Cloud, СПб, `crm-deztechyug` (`91.229.90.53`) |
| **Hostname** | `dezteh-crm` |
| **Тариф** | 2 vCPU / 4 ГБ / 40 ГБ / 1140₽/мес |
| **ОС** | Ubuntu 24.04 LTS |
| **Доступ SSH** | `ssh root@91.229.90.53 -i ~/.ssh/id_ed25519_nopass` (только по ключу, пароль отключён) |
| **Регистратор домена** | REG.RU |
| **DNS** | Timeweb (NS: ns1-4.timeweb.ru) |
| **SSL** | Let's Encrypt через Traefik 3 (автопродление) |
| **Email домена** | Yandex 360 (MX/DKIM/SPF настроены — НЕ ТРОГАТЬ) |

### Стек на VPS (Docker Compose в `/opt/deztech-crm/`)

```
deztech-crm-traefik     traefik:v3      — HTTPS + Let's Encrypt
deztech-crm-app         deztech-crm-app:latest — Next.js standalone
deztech-crm-postgres    postgres:16-alpine
deztech-crm-redis       redis:7-alpine  — для BullMQ
deztech-crm-libreoffice linuxserver/libreoffice — для DOCX→PDF (Этап 6)
```

### Файлы на VPS
- `/opt/deztech-crm/.env` (chmod 600, секреты для prod) — НЕ В GIT
- `/opt/deztech-crm/docker-compose.prod.yml`
- `/opt/deztech-crm/Dockerfile`
- `/opt/deztech-crm/scripts/vps-bootstrap.sh` (первичная настройка VPS)
- `/root/.ssh/authorized_keys` — мой ключ (`tg cxembook@CXEMBOOK1097`) добавлен

---

## Технологический стек

```
Frontend:    Next.js 14 (App Router) + React 18 + TypeScript
UI:          Tailwind + shadcn/ui (на Radix), lucide-react, framer-motion
Backend:     Next.js API Routes + Server Actions
ORM:         Drizzle ORM 0.45 + drizzle-kit
Auth:        Auth.js v5 (NextAuth beta) — Credentials provider, JWT-сессии
БД:          PostgreSQL 16
Кеш/очереди: Redis 7 + BullMQ
Хранилище:   Yandex Object Storage (НЕ настроен — на Этап 6)
Email:       nodemailer + Beget SMTP (НЕ настроен)
Telegram:    grammy (НЕ настроен — на Этап 8)
Документы:   docxtemplater + pizzip (DOCX), LibreOffice headless (PDF)
Деплой:      Docker Compose + Traefik 3 + Let's Encrypt
```

---

## Структура проекта

```
DezTehUg.new-main/
├── app/
│   ├── (auth)/login/         # CRM логин-страница
│   ├── (crm)/                # ВСЕ CRM-роуты, общий layout с sidebar
│   │   ├── admin/            # для admin
│   │   ├── manager/          # для admin + manager
│   │   └── master/           # для admin + master
│   ├── api/auth/[...nextauth]/  # Auth.js handlers
│   └── ... (публичные страницы сайта оставались как были)
├── lib/
│   ├── db/
│   │   ├── index.ts          # Drizzle pool
│   │   ├── schema/           # ВСЕ схемы (13 таблиц)
│   │   └── seed.ts           # tsx скрипт для seed
│   └── auth/
│       ├── config.ts         # ⚠️ EDGE-SAFE (без БД/bcrypt!) для middleware
│       └── index.ts          # SERVER-ONLY полный конфиг с Credentials
├── components/
│   ├── crm/Sidebar.tsx       # навигация по ролям
│   └── layout/AppWrapper.tsx # ⚠️ условно скрывает публичный Header/Footer на /admin /manager /master /login
├── drizzle/migrations/       # 0000_initial_schema.sql применена
├── middleware.ts             # ⚠️ EDGE-runtime: только authConfig, host-aware redirect
├── docker-compose.dev.yml    # ЛОКАЛЬНАЯ разработка (postgres+redis+mailhog+minio)
├── docker-compose.prod.yml   # PROD (на VPS)
├── Dockerfile                # multi-stage Next.js standalone
├── drizzle.config.ts
├── .env.example              # шаблон для разработчиков
├── .env.production.example   # шаблон prod
└── tmp/plans/                # планы спринтов (gitignored)
```

### Критические нюансы

1. **Auth.js + Drizzle + Edge runtime:** `lib/auth/config.ts` ОБЯЗАН быть edge-safe (без импортов `db` или `bcryptjs`). Полный конфиг с Credentials — только в `lib/auth/index.ts`. Если импортировать `db` в middleware → 500 `Edge runtime does not support Node.js 'crypto' module`.

2. **Punycode домена:** `дезтехюг.рф` = `xn--c1abdaj0ewa6e.xn--p1ai`. Часто путается. Используй `IdnMapping` для проверки:
   ```powershell
   (New-Object System.Globalization.IdnMapping).GetAscii('дезтехюг.рф')
   ```

3. **Traefik версия:** Использовать `traefik:v3` (latest) — старые версии не работают с Docker API 1.40+ из Docker 29.

4. **AppWrapper.tsx:** Условно скрывает публичный Header/Footer на CRM-роутах через `usePathname()`. Если изменишь — могут полезть UI-баги.

5. **Standalone сборка:** `next.config.js` имеет `output: 'standalone'` — Dockerfile рассчитан на это. Не убирай.

6. **n8n:** Текущий webhook сайта летит куда-то в n8n (см. недавние коммиты `Switch n8n webhook to production URL`). На Этапе 5 надо подключить через `/api/leads/inbound`.

---

## База данных — текущее состояние

### Таблицы (13)
- `users`, `sessions` (+ enum `user_role`: admin/manager/master)
- `clients` (+ enums `client_type`, `client_status`, `client_source`)
- `client_objects` (объекты обслуживания)
- `leads` (заявки + enum `lead_status` для воронки)
- `services` (каталог)
- `deals`, `deal_price_items`, `deal_addendums` (договоры + позиции + ДС)
- `documents`, `document_templates` (+ enums `document_type`, `document_status`)
- `notification_log`, `activity_log`

### Seed-данные (применены на prod)
- 3 пользователя с временным паролем `welcome123`:
  - `sanctumizm@gmail.com` (admin, Саня)
  - `deztexug@yandex.ru` (manager, Регина)
  - `nrgy131@gmail.com` (master, Александр)
- 8 услуг: disinsection, deratization, disinfection, fumigation, deodorization, deserpentation, herbicide-treatment, water-analysis

---

## Что СДЕЛАНО (Спринты 1, 2, 3)

**Спринт 1 (2026-05-01 → 2026-05-02):** VPS, Docker stack, БД с миграцией+seed, Auth.js v5 с ролями (admin/manager/master), каркас CRM-панели, HTTPS+Let's Encrypt, host-aware middleware.

**Спринт 2 (2026-05-03):** редизайн CRM (light cyberpunk), смена пароля (миграция 0001), модуль клиентов с ИНН/ОГРН валидацией (23 unit-теста), модуль лидов + n8n integration + канбан на dnd-kit (миграция 0002), 6 DOCX-шаблонов с tools-builder, минимальная генерация контракта, активная n8n CRM-нода на проде. Закрыт коммитом `8c486ca`.

**Спринт 3 (2026-05-04):** Migration 0003. Полный цикл лид→клиент→сделка→документ→выезд→акт. КП-flow прямо из канбана. Удаление документов. Email body шаблоны для всех типов. Master/Admin UI наполнены. 3 Playwright теста. LibreOffice в app-контейнере вместо отдельного.

**Спринт 4 (2026-05-09 → 2026-05-10):** Аналитика воронки (4 виджета recharts), cron stuck-leads (SMTP Yandex 360 + Linux cron), 6 заглушенных страниц (документы/календарь×2/завершено мастера/admin settings), редизайн календаря (FullCalendar v6 + light-cyberpunk), канбан сделок (@dnd-kit). Все на проде.

**Спринт 5.0 (2026-05-10):** UX-фиксы календаря, time-of-day для сделок (миграция 0006), фикс body { zoom } ломал FullCalendar. Закоммичено `3ac3711`.

**Спринт 5 maxi (2026-05-11):** см. ниже секцию «Sprint 5 maxi эпики». Миграции 0007/0008/0009. 3 новых виджета на дашборде + 6 quick-links. Soft-delete документов с admin approval queue. Telegram-бот (grammy + webhook + polling-tools, привязка через одноразовый токен, fallback email→TG). UI порогов зависания. Канбан confirm для destructive статусов. Запрос переноса дат от мастера с TG-уведомлением менеджеру. 10 отчётов + CSV. CI/CD GitHub Actions (test+deploy workflows).

---

## Sprint 5 maxi эпики (2026-05-11) — что закрыто

**A. Дашборд менеджера v2** — `app/(crm)/manager/page.tsx` + `lib/dashboard/manager-stats.ts`. 10 виджетов (3 новых: Конверсия 30д, Ближайшие выезды 7д, Выручка 30д) + секция «Быстрые переходы» с 6 ссылками (Аналитика, Канбан воронки, Канбан сделок, Календарь, Документы, Клиенты). Старый `«в разработке»` текст удалён.

**B. Soft-delete документов с approval-flow (миграция 0007).** `documents.deletion_status` enum (none/pending/approved/rejected) + 5 нужных колонок. Server actions: `requestDocumentDeletion` / `cancelDeletionRequest` (manager+admin) + `approveDocumentDeletion` / `rejectDocumentDeletion` (admin only). UI: вместо корзины в DocumentsTab — кнопка «Запросить удаление» → modal с textarea причины. Pending показывается inline-badge в строке документа. Новая страница `/admin/deletions` с queue (карточки + кнопки Удалить/Отклонить). Sidebar admin — бейдж pending count. Helper `executeDocumentDeletion` в `lib/documents/deletion.ts` (внутренний, чистит storage + запись). E2E проверено локально: Регина → запрос → Саня → одобрение → файл удалён.

**C. Telegram-бот (миграция 0008).** Установлен grammy ^1.42.0. ENV `TELEGRAM_BOT_TOKEN=8591565062:...` (пока в .env.local), `TELEGRAM_BOT_USERNAME=DTUnvrsk_bot`. `lib/notifications/telegram.ts` — singleton Bot + sendTelegramMessage (с handling блокировок) + linkUserByToken. Schema users +5 колонок: telegram_username, telegram_linked_at, telegram_link_token, telegram_link_token_expires_at (telegram_chat_id уже был). Server actions в profile/actions.ts: `generateTelegramLinkToken` (срок жизни 30 мин), `unlinkTelegram`. UI: `/profile` → секция Telegram (привязать → deep-link → копировать/открыть → Сторе нажмёт Start в боте). `/api/telegram/webhook` (для prod) + `tools/telegram-polling.ts` (для dev) + `tools/telegram-set-webhook.ts` (для setup на проде). npm scripts: `telegram:dev`, `telegram:webhook:set/delete/info`. `runStuckLeadsCheck` расширен — если у юзера есть chatId, шлёт в TG (короткий формат «⚠️ Зависших: N» + список); fallback на email если TG заблокирован. Что осталось от Сани: открыть деплинк в TG, нажать Start → проверить что привязалось. На проде: добавить TELEGRAM_BOT_TOKEN/USERNAME в `/opt/deztech-crm/.env`, после деплоя — `npx tsx tools/telegram-set-webhook.ts https://crm.дезтехюг.рф` (опционально с TELEGRAM_WEBHOOK_SECRET).

**E. UI-настройка порогов «зависания» (миграция 0009).** Generic table `app_settings (key text PK, value jsonb, updated_at, updated_by_id)`. `lib/notifications/thresholds.ts`: getThresholds/saveThresholds/resetThresholds, fallback на STALE_THRESHOLDS из lead-stages. `stuck-leads.ts` SQL CASE WHEN теперь генерируется динамически из getThresholds. UI: новая секция «Пороги зависания лидов» в `/admin/settings` с inputs warn/stale на каждую стадию + кнопки «Сохранить» / «Сбросить к дефолту». Server actions в `app/(crm)/admin/settings/actions.ts`.

**F. Канбан подтверждение destructive переходов.** `DealBoardClient.tsx` — при drop сделки в `terminated` или `completed` показывается AlertDialog с информацией о сделке + кнопка подтверждения. Cancel — drop отменяется, состояние не меняется (optimistic update срабатывает только после confirm).

**G. Календарь мастера: запрос переноса дат.** Master уже не мог drag-n-drop (canDragDates=false для /master/calendar). Теперь на странице сделки `/master/deals/[id]` добавлена кнопка «Попросить перенести даты» → modal с date-pickers (start/end) + textarea reason. Server action `requestDateChange` в `app/(crm)/master/deals/[id]/actions.ts`: пишет в activity_log (entity=deal, action=`deal.master_date_request`) + если у менеджера привязан Telegram — пушит уведомление сразу.

**D. /manager/reports — 10 отчётов + CSV экспорт.** Sidebar убран `disabled: true`. `lib/reports/queries.ts` — 10 SQL-агрегатов (revenue by month, deals by master, conversion by source, manager activity, service usage, avg cheque, time-to-close, loss reasons, retention, master load). `lib/reports/csv.ts` — конвертер с UTF-8 BOM и `;` separator (для Excel в RU-локали). `app/(crm)/manager/reports/page.tsx` — server-rendered страница со всеми 10 секциями (KPI-чипами доход/сделок/средний чек сверху, период-switcher 30/90/365/all). `app/api/reports/[name]/csv/route.ts` — endpoint для CSV download.

**H. CI/CD GitHub Actions.** `.github/workflows/test.yml` (push/PR в feature/crm и main): job `type-check` (tsc --noEmit + next lint, lint warnings не блокируют) + job `build` (postgres service, миграции через psql -f, npm run db:seed, npm run build). `.github/workflows/deploy.yml` — workflow_dispatch (ручной запуск) с inputs: branch (default feature/crm) + run_migrations (boolean). SSH через webfactory/ssh-agent + `git fetch + reset --hard + docker compose build/up`. Health-check после деплоя. Secrets нужны: `VPS_SSH_KEY` (приват ключ) + `VPS_HOST` (91.229.90.53). Опц. `TELEGRAM_BOT_TOKEN_DEV` / `TELEGRAM_BOT_USERNAME_DEV` для test build.

---

## Блокеры для будущих спринтов (Sprint 4+)

❌ **SMTP Yandex 360** — настроены `SMTP_HOST=smtp.yandex.ru` в шаблонах, `MAILER_TRANSPORT=noop` на проде. Саня даст пароль приложения из `id.yandex.ru → Безопасность` → переключаем `MAILER_TRANSPORT=smtp` без передеплоя.

❌ **Yandex Object Storage** — не настроен. Storage abstraction готов: `lib/storage/{index,local}.ts`, переход — добавить `S3Storage` класс и `STORAGE_DRIVER=s3`. На prod пока named volume `app-storage` → `/app/storage`.

❌ **Telegram bot** — нет токена. Запланировано на Sprint 4.

❌ **CI/CD** — нет. Playwright тесты запускаются локально (`npm run test:e2e`).

❌ **PDF на проде** — DOCX→PDF через LibreOffice headless внутри app-контейнера, smoke ещё не делал на проде, нужно проверить после первой реальной генерации с PDF (флаг `format=both` или `format=pdf` в API).
- **F. Email** — nodemailer wrapper, в prod транспорт `noop` пока нет SMTP
- **G. Master UI** — список своих сделок (без цен), запись work_log, завершение выезда
- **H. Admin UI** — CRUD юзеров с одноразовым паролем
- **I. Playwright** — happy-path lead→client→deal→documents→work→complete, плюс admin тесты
- **J. Деплой** — миграция 0003 на prod, named-volume storage, rebuild с LibreOffice, smoke-test, обновление CLAUDE.md+MEMORY.md, один коммит
- **K. Bonus (по запросу Сани в процессе):** КП-flow из канбана при drop в «КП отправлено», email body шаблоны (анти-спам), удаление документов

---

## Команды-шпаргалки

```bash
# SSH на VPS
ssh root@91.229.90.53 -i ~/.ssh/id_ed25519_nopass

# Локальная разработка
npm run docker:dev:up      # Postgres+Redis+MailHog+MinIO
npm run dev                # Next.js на localhost:3000
npm run db:generate        # после изменения схемы (drizzle-kit generate)
npm run db:migrate         # ВНИМАНИЕ: drizzle-kit migrate НЕ используется на этом проекте.
                           # Миграции применяются вручную через psql -f. См. docker exec ниже.
npm run db:seed            # засеять локальную БД (3 юзера + 8 услуг)
npm run db:seed:templates  # засеять documentTemplates 6 базовыми шаблонами

# Тесты
npm run test:e2e           # Playwright happy-path
npm run test:e2e:ui        # Playwright с UI

# Применение миграции локально (вручную, не drizzle-kit)
docker cp drizzle/migrations/0003_xxx.sql deztech-crm-postgres-dev:/tmp/m.sql
MSYS_NO_PATHCONV=1 docker exec -i deztech-crm-postgres-dev psql -U deztech deztech_crm -f /tmp/m.sql

# На VPS — деплой нового кода через git
cd /opt/deztech-crm
git fetch origin feature/crm
git reset --hard origin/feature/crm
docker compose -f docker-compose.prod.yml --env-file .env build app
docker compose -f docker-compose.prod.yml --env-file .env up -d --force-recreate app

# Применение миграции на prod (вручную)
docker cp drizzle/migrations/0003_xxx.sql deztech-crm-postgres:/tmp/m.sql
docker exec -i deztech-crm-postgres psql -U deztech deztech_crm -f /tmp/m.sql

# Seed шаблонов на prod (one-shot контейнер)
docker compose -f docker-compose.prod.yml --env-file .env run --rm app node -e "import('./node_modules/tsx/dist/cli.mjs').then(t=>t.main(['lib/db/seed-templates.ts']))"
# или проще — собрать js из ts заранее, или сделать отдельный node-скрипт без tsx

# Бэкап БД
docker exec deztech-crm-postgres pg_dump -U deztech deztech_crm > backup-$(date +%Y%m%d).sql
```

---

## Контекст работы с этим проектом

- **Заказчик/владелец:** Саня (sanctumizm@gmail.com), общается неформально, любит подкалывать
- **Стиль:** короткие конкретные сообщения, без воды, по делу
- **Подход:** Plan → Do → Verify (план в `tmp/plans/`, потом код, потом проверка)
- **Перед крупными изменениями** — задавать 5-20 уточняющих вопросов
- **НЕ ВЫДУМЫВАТЬ:** если не знаешь — так и сказать, спросить
- **НЕ КОММИТИТЬ И НЕ ПУШИТЬ** без явного разрешения Сани

---

## История по сессиям

- **Сессия 1 (2026-05-01..02):** инициализация проекта, развёртывание MVP-инфры, доведение до production https://crm.дезтехюг.рф/login. 5 коммитов: `20d6195` (MVP infra) → `6fad23c` (prod-инфра) → `c1bee75` (Traefik) → `583bf0a` (Punycode) → `04e3ca7` (auth split) → `cc1fe6a` (host-aware redirect) → `0f1fb60` (CLAUDE.md).
- **Сессия 2 (2026-05-03):** Sprint 2 — клиенты, лиды (UI+канбан), n8n integration, 6 DOCX-шаблонов, дашборд, миграции 0001/0002, активация CRM-ноды на проде. 2 коммита: `8c486ca` (большой Sprint 2) + `802d5ec` (toggle-script).
- **Сессия 3 (2026-05-03 → 2026-05-04):** Sprint 3 целиком — все 10 эпиков (A-J) + бонус K (КП-flow из канбана + email body + удаление документов). Миграция 0003 применена на dev и prod, named volume `app-storage` подхвачен в `/app/storage`, LibreOffice ставится `apt install` в app-контейнер (~950МБ), отдельный `deztech-crm-libreoffice` сервис удалён, `MAILER_TRANSPORT=noop` на проде до получения SMTP Yandex. 3 Playwright-теста зелёные. Закрыт одним большим коммитом (см. `git log feature/crm`).
