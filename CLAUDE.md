# DezTehYug CRM — память проекта

> Файл читается Claude автоматически в начале каждой сессии в этом проекте.
> Обновляй при больших изменениях. Последнее обновление: **2026-05-03 (середина Спринта 2, прервано на лимите Claude).**

---

## ⚡ ВНИМАНИЕ: где сейчас стоит работа (читать перед стартом!)

**Спринт 2 в работе**, локальная ветка `feature/crm`, **ничего не закоммичено и не пушено** — копим до конца спринта.

### ✅ Закрыто в Спринте 2 (локально, на dev):
- **Задача 0** — редизайн CRM под стиль публичного сайта (light cyberpunk: bg-bg-primary, neon-orange, poison-green, font-orbitron, CyberpunkButton/CyberpunkCard/NeonInput, LogoText в Sidebar и Login). Файлы: `app/(crm)/layout.tsx`, `components/crm/Sidebar.tsx`, `components/crm/CrmProviders.tsx` (новый, SessionProvider+Toaster), `app/(auth)/login/{page,login-form}.tsx`, `app/(crm)/profile/{page,PasswordForm}.tsx`, `app/(crm)/{admin,manager,master}/page.tsx`, `components/layout/AppWrapper.tsx` (+`/profile` в isCrmPath).
- **Задача 3** — UI смены пароля. Миграция `0001_stiff_pepper_potts.sql` (колонка `users.password_must_change boolean default false`). JWT-флаг через `useSession().update()`. Edge-safe middleware: `lib/auth/config.ts` + `middleware.ts` (matcher включает `/profile`). Server Action `app/(crm)/profile/actions.ts` (bcrypt+activity_log). E2E 11/11 в preview.
- **Задача 2** — модуль клиентов. Утилита валидации `lib/validation/inn.ts` (ИНН/ОГРН/ОГРНИП/КПП/БИК/р.с./корсчёт по алгоритмам ФНС/ЦБ — 23/23 unit-теста). Zod discriminated union (legal/individual). Server Actions в `app/(crm)/manager/clients/actions.ts` (CRUD + status change + objects + activity_log). UI: список с фильтрами (тип/статус/mine/q)+пагинацией, форма create/edit (одна длинная), карточка с 4 табами (Реквизиты/Объекты/Договоры/История), CRUD объектов, dropdown смены статуса. E2E 7/7 в preview.

### 🔄 В процессе: Задача 4 (n8n + UI лидов)

**Готово (код написан, частично протестировано):**
- `app/api/leads/inbound/route.ts` — endpoint POST с проверкой `X-N8N-Secret`. Гибкий парсинг payload (`message.content` n8n-формат, ключи `customer_phone`/`phone`/`tel` и т.д.). Phone обязателен. Создаёт `lead` с `rawPayload` (jsonb) + activity_log `lead.create_from_n8n`. **Curl-тесты 4/4 прошли** (401/401/422/201).
- Секрет `N8N_INBOUND_SECRET` лежит в `.env.local` (gitignored). **На prod надо тот же положить в `/opt/deztech-crm/.env` + в header `X-N8N-Secret` в n8n-ноде.** Реальное значение в локальном `.env.local`, в репо не коммитим.
- UI: `app/(crm)/manager/leads/page.tsx` (список+таб-фильтры по статусу+поиск+mine), `[id]/page.tsx` (карточка с rawPayload в `<details>`), `LeadStatusControl.tsx` (dropdown), `LeadActions.tsx` (TakeLeadButton + ConvertLeadButton с модалкой), `actions.ts` (Server Actions: updateLeadStatus, takeLead, convertLeadToClient).
- `components/crm/LeadStatusBadge.tsx` (6 статусов).

**Не доделано (новая сессия должна продолжить):**
1. **E2E тест в preview**: рефреш `/manager/leads` после curl-заявки → видно lead → клик «Взять в работу» → клик «Конвертировать в клиента» (тип legal/individual + shortName) → создаётся client, lead.status=won, lead.client_id заполнен, редирект на `/manager/clients/<id>`. Локальный curl-тест на endpoint уже сделан, **проверить визуально и через сеанс Регины**.
2. **Добавить ноду в n8n workflow `DEzTechUg_bot` (id `SkUMV2EUN8hObo76`).** Текущая структура: Webhook(/DTU_zayavki, headerAuth) → AGENT Diagnose (OpenAI) → Insert row1 (n8n dataTable DezTechUg_Client) → fan-out: Telegram + Gmail. **Нужно добавить третью ветку из `Insert row1` → HTTP Request → `https://crm.дезтехюг.рф/api/leads/inbound`** с заголовком `X-N8N-Secret: <prod_secret>` и body = `{{$json.message.content}}` (или весь `$json` — endpoint оба формата ест). MCP `n8n_update_partial_workflow` с операцией `addNode` + `addConnection`. Не забыть **deactivate→activate** workflow после правки (см. правило в Sanctum memory).
3. **Не забыть улучшить текущий workflow** — Саня просил по ходу глянуть что можно подправить. Сейчас не успел.

### ⏳ Pending в Спринте 2:
- **Задача 5** — канбан воронки (drag-n-drop по статусам через `@dnd-kit/core` — НЕ установлен) + конвертация уже частично есть (`convertLeadToClient`).
- **Задача 1** — DOCX-болванки (6 шаблонов docxtemplater). Образцы скопированы в `tmp/source/` (gitignored): 2 PDF (договор Аппетит + ДС№4) + 2 DOCX (акт обследования + акт работ). Требует docxtemplater + pizzip — **уже стоят**.
- **Финальный деплой Спринта 2 на prod** (по договорённости — пакетом в конце спринта). После применения миграции 0001 на prod не забыть:
  ```sql
  UPDATE users SET password_must_change = true
  WHERE email IN ('sanctumizm@gmail.com','deztexug@yandex.ru','nrgy131@gmail.com');
  ```
  Также `N8N_INBOUND_SECRET` положить в prod env.

### Состояние dev-окружения
- Локальный Docker dev-стек крутится: `deztech-crm-postgres-dev`, redis, mailhog, minio.
- Next.js dev на `localhost:3000` через preview-сервер. Запуск: `mcp__Claude_Preview__preview_start({name:'next-dev'})`. Если порт занят — `Get-NetTCPConnection -LocalPort 3000` → Stop-Process. После `npm run build` смешиваются prod/dev артефакты в `.next/` → перед dev-запуском **удалить `.next/`** (`rm -rf .next`).
- БД на 03.05.2026: 3 seed-юзера на `welcome123` (флаг должен быть `true`, но возможно у Регины `false` — проверь `SELECT password_must_change FROM users`). 0 клиентов, 0 лидов (всё чистил после E2E).
- Логин для тестов: `deztexug@yandex.ru / welcome123` (Регина, manager).

### Конфиги, которые НЕ в гите (gitignored, но критичны)
- `.env.local` — DB, AUTH_SECRET, REDIS, **N8N_INBOUND_SECRET**.
- `.mcp.json` — n8n MCP API key (подтянут из санктум-проекта `D:\Projects_GitHub\n8n_JSON\n8n_Cc_Sanctum\.mcp.json`). API URL `https://n8n.lex1case.ru`. Health-check: `bash tools/check-mcp-health.sh`.
- `tmp/` — папка с образцами договоров и плановыми документами.

### MCP инструменты в этой сессии
- **n8n MCP** — работает (после релоуда Claude Code 03.05). 63 workflow видно. Workflow `DEzTechUg_bot` ID = `SkUMV2EUN8hObo76`.
- **context7** и **Docling MCP** — не подключаются после релоуда (не критично, не использую).

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

## Что СДЕЛАНО (Спринт 1, 2026-05-01 → 2026-05-02)

✅ Этапы 0-3 из плана:
- VPS развёрнут и защищён
- Docker stack работает
- БД с миграцией и seed
- Auth.js v5 с ролями (admin/manager/master)
- Каркас CRM-панели (sidebar, дашборды-заглушки)
- HTTPS + Let's Encrypt
- Host-aware middleware (корень `/` на crm-поддомене → редирект)
- Ветка `feature/crm` запушена в GitHub: https://github.com/nrgy13/DezTehUg.new-main/tree/feature/crm

---

## Что НЕ сделано / БЛОКЕРЫ для следующих спринтов

❌ **Yandex Object Storage** — не настроен (нужен для Этапа 6).
   Действия: создать bucket `deztechyug-crm`, сервисный ключ, заполнить S3_* в `/opt/deztech-crm/.env`

❌ **DOCX-шаблоны** от заказчика — пока нет. Договорились **сверстать болванки** по PDF-образцу.

❌ **Telegram bot** — нет токена (нужен для Этапа 8).
   Действия: создать через @BotFather, токен в `TELEGRAM_BOT_TOKEN` в .env

❌ **SMTP Beget** — данные не заполнены (нужен для Этапа 6 — отправка документов).
   Действия: получить SMTP-доступ от Beget, заполнить SMTP_USER, SMTP_PASS в .env

❌ **UI смены пароля** — все юзеры на `welcome123`. Сделать в Спринте 2.

❌ **Test coverage** — тестов нет. Добавим Playwright в Спринте 5-6.

---

## План Спринта 2 (следующая сессия)

Длительность: 2 недели. Цель: **клиенты + интеграция с сайтом + смена пароля**.

### Задачи

1. **DOCX-болванки** (1-2 дня)
   - Сверстать 6 шаблонов по образцу `tmp/plans/` (есть PDF-образец договора `ДОГОВОР ООО Аппетит.pdf`):
     договор, доп.соглашение, акт работ, акт обследования, КП, счёт
   - Использовать `docxtemplater` синтаксис: `{{client.short_name}}`, `{#objects}{...}{/objects}`
   - Сохранить в `templates/` папке проекта (пока локально, потом в S3)

2. **Этап 4: модуль клиентов** (3-4 дня)
   - Список клиентов с фильтром по типу (физ/юр), статусу, менеджеру
   - Форма создания/редактирования юрлица с реквизитами
   - Карточка клиента с табами (реквизиты, объекты, история)
   - CRUD объектов обслуживания
   - Server Actions для операций

3. **UI смены пароля** (0.5 дня)
   - Страница `/profile` или модалка
   - Server Action change-password (старый + новый, проверка bcrypt, обновление в БД)
   - При первом входе с `welcome123` принудительно редиректить на смену

4. **Этап 5: интеграция с n8n** (2 дня)
   - Endpoint `POST /api/leads/inbound` с проверкой `N8N_INBOUND_SECRET`
   - В n8n настроить отправку формы сайта на новый endpoint
   - Создание lead в БД при входящем webhook
   - Уведомление менеджера (email пока через MailHog в dev)

5. **Воронка лидов** (3 дня)
   - Канбан с колонками по статусам lead_status
   - Drag-n-drop для смены статуса
   - Конвертация lead → client + deal

### Open questions перед стартом
- Получены ли DOCX-шаблоны от заказчика?
- Готов ли Yandex Cloud аккаунт?
- Где сейчас принимает форму с сайта n8n? Куда подключаемся?

---

## Команды-шпаргалки

```bash
# SSH на VPS
ssh root@91.229.90.53 -i ~/.ssh/id_ed25519_nopass

# Локальная разработка
npm run docker:dev:up      # Postgres+Redis+MailHog+MinIO
npm run dev                # Next.js на localhost:3000
npm run db:generate        # после изменения схемы
npm run db:migrate         # применить миграции локально
npm run db:seed            # засеять локальную БД

# На VPS
cd /opt/deztech-crm
docker compose -f docker-compose.prod.yml ps                    # статус
docker logs deztech-crm-app --tail 50                           # логи app
docker compose -f docker-compose.prod.yml --env-file .env up -d --force-recreate app  # перезапуск
docker compose -f docker-compose.prod.yml --env-file .env build app                   # ребилд

# Деплой нового кода (после git pull или rsync)
docker compose -f docker-compose.prod.yml --env-file .env build app
docker compose -f docker-compose.prod.yml --env-file .env up -d --force-recreate app

# Миграция на prod
docker compose -f docker-compose.prod.yml --env-file .env exec -T app npx drizzle-kit migrate

# Бэкап БД (TODO: автоматизировать)
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

- **Сессия 1 (2026-05-01..02):** инициализация проекта, развёртывание MVP-инфры, доведение до production https://crm.дезтехюг.рф/login. 9 коммитов в feature/crm.
