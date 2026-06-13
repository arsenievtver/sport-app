# Архитектура sport-app

> Версия: 13 июня 2026  
> Статус: решение для MVP → v2, согласовано с [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) и feature backlog

---

## 1. Цели архитектуры

| Требование | Как закрываем |
|------------|---------------|
| Быстрый старт и итерации | Monorepo, один API, общий UI-kit, OpenAPI-контракт |
| Масштабирование | Stateless API, PostgreSQL, Redis, очереди, S3-хранилище |
| PWA сейчас → native позже | Vite PWA (athlete, coach); Capacitor позже при необходимости |
| Современный UI | shadcn/ui + Tailwind, design tokens, dark mode |
| AI / нейросети | Python-бэкенд, отдельный AI-сервис, pgvector |
| B2B (тренеры) + B2C (спортсмены) | RBAC, multi-tenant по тренерам, подписки |

---

## 2. Блоки системы (высокий уровень)

```
                         ┌─────────────────────────────────────┐
                         │           CDN + reverse proxy        │
                         │         (Cloudflare / nginx)         │
                         └──────────────────┬──────────────────┘
                                            │
        ┌───────────────────┬───────────────┼───────────────┬───────────────────┐
        │                   │               │               │                   │
   ┌────▼─────┐       ┌─────▼─────┐   ┌─────▼─────┐   ┌─────▼─────┐      ┌──────▼──────┐
   │ Athlete  │       │   Coach   │   │   Coach   │   │   Admin   │      │  Marketing  │
   │   PWA    │       │    PWA    │   │ Web Desk  │   │   Panel   │      │  landing    │
   │ (mobile) │       │  (mobile) │   │  (desktop)│   │(superuser)│      │  (optional) │
   └────┬─────┘       └─────┬─────┘   └─────┬─────┘   └─────┬─────┘      └─────────────┘
        │                   │               │               │
        └───────────────────┴───────────────┴───────────────┘
                                    │
                         ┌──────────▼──────────┐
                         │     API Gateway      │
                         │   FastAPI (REST)     │
                         │   + WebSocket        │
                         └──────────┬──────────┘
                                    │
     ┌──────────────┬───────────────┼───────────────┬──────────────┬─────────────┐
     │              │               │               │              │             │
┌────▼────┐   ┌─────▼─────┐   ┌──────▼──────┐  ┌─────▼─────┐  ┌────▼────┐  ┌─────▼─────┐
│PostgreSQL│   │   Redis   │   │  Object     │  │  Worker   │  │Analytics│  │ AI Service│
│ +pgvector│   │ cache/pub │   │  Storage    │  │ (Celery/  │  │PostHog/ │  │ (Python,  │
│          │   │  sub      │   │  (S3/MinIO) │  │  ARQ)     │  │ Mixpanel│  │  optional)│
└──────────┘   └───────────┘   └─────────────┘  └───────────┘  └─────────┘  └───────────┘
```

### 2.1. Клиентские приложения

| Блок | Аудитория | Формат | Основные функции (из backlog) |
|------|-----------|--------|-------------------------------|
| **Athlete App** | Спортсмен | PWA (mobile-first) | B-01 логирование, P-02 прогресс, A-01/A-02 автономия, C-01/C-04 связь с тренером, push |
| **Coach App (mobile)** | Тренер в зале | PWA | T-01 статус клиентов, C-02/C-03 сообщения, быстрые правки программы |
| **Coach Web Desk** | Тренер за столом | Responsive web | T-02/T-03 программы и библиотека, T-04/T-05 алерты, drag-and-drop конструктор |
| **Admin Panel** | Суперюзер / ops | Web only | Подключение тренеров, модерация, тарифы, метрики платформы, support |
| **Landing** | Маркетинг | Static / Next.js | Onboarding M-01, SEO, регистрация тренеров (B2B) |

**Решение (13.06.2026):** четыре отдельных клиента в monorepo — `athlete`, `coach`, `coach-web`, `admin`. Coach Web Desk — **отдельное приложение** (другой UX: конструктор программ, drag-and-drop, desktop-first). Общие: UI-kit, API-клиент, типы. Платежи — отложены.

### 2.2. Backend

| Блок | Назначение |
|------|------------|
| **API (FastAPI)** | REST + OpenAPI, auth, бизнес-логика, WebSocket для чата |
| **Worker** | Push-расписание, расчёт прогресса/челленджей, email, AI-задачи |
| **PostgreSQL** | Основные данные, транзакции, pgvector для рекомендаций |
| **Redis** | Сессии, кэш, rate limit, pub/sub для realtime |
| **Object Storage** | Видео упражнений, аватары, экспорт отчётов |
| **AI Service** | Отдельный модуль/микросервис — не блокирует MVP |

### 2.3. Инфраструктура (MVP → prod)

| Среда | Рекомендация |
|-------|--------------|
| Dev | Docker Compose: api + postgres + redis + minio |
| Staging/Prod | Fly.io / Railway / Hetzner + managed Postgres |
| CI/CD | GitHub Actions: lint, test, deploy |
| Secrets | env + Doppler / GitHub Secrets |

---

## 3. Стек технологий

### 3.1. Backend — Python + FastAPI

**Почему FastAPI, а не Node/Django:**

- **Python** — естественная среда для AI/ML (OpenAI, LangChain, локальные модели, аналитика).
- **FastAPI** — async, автогенерация OpenAPI → типизированный клиент на фронте.
- **Pydantic v2** — строгие контракты, меньше багов между ролями athlete/coach/admin.
- Скорость разработки MVP сопоставима с Node; производительность достаточна до десятков тысяч DAU.

```
backend/
├── app/
│   ├── api/v1/          # роуты по доменам
│   ├── core/            # config, security, deps
│   ├── models/          # SQLAlchemy 2.0
│   ├── schemas/         # Pydantic DTO
│   ├── services/        # бизнес-логика
│   ├── workers/         # фоновые задачи
│   └── ai/              # AI-адаптеры (feature-flagged)
├── alembic/             # миграции
└── tests/
```

**Ключевые библиотеки:**

| Область | Библиотека |
|---------|------------|
| ORM | SQLAlchemy 2.0 + Alembic |
| Auth | python-jose / PyJWT, passlib, OAuth2 password flow |
| Realtime | FastAPI WebSocket + Redis pub/sub |
| Tasks | ARQ (легче Celery для старта) или Celery |
| Storage | boto3 / aioboto3 (S3-compatible) |
| Push | Firebase Admin SDK (FCM) + APNs через FCM |
| AI (v1.5+) | openai SDK, pgvector, optional LangGraph |

### 3.2. Frontend — React monorepo (Turborepo + pnpm)

**Почему не Flutter / чистый RN с нуля:**

- PWA и web для тренера — **первоклассные** граждане (Coach Web Desk).
- Один язык TypeScript на все клиенты + общий UI-kit.
- Путь в native: **Expo** (предпочтительно) или **Capacitor** поверх готового React-кода.

```
apps/
├── athlete/          # Vite PWA или Expo
├── coach/            # Vite PWA + desktop routes
├── admin/            # Vite / Next.js
└── web/              # landing (optional)

packages/
├── ui/               # shadcn/ui + design tokens
├── api-client/       # generated from OpenAPI
├── shared/           # types, utils, i18n
└── analytics/        # PostHog wrapper
```

**UI / дизайн:**

| Компонент | Выбор |
|-----------|-------|
| Design system | shadcn/ui (Radix) — копируемые компоненты, не vendor lock-in |
| Styling | Tailwind CSS v4 |
| Charts | Recharts / Tremor (прогресс P-02, P-04) |
| Forms | React Hook Form + Zod |
| State (server) | TanStack Query |
| State (client) | Zustand (минимально) |
| i18n | next-intl или i18next (RU → EN позже) |

**PWA:**

- Service Worker: Workbox (via Vite PWA plugin)
- Offline: кэш последней программы + очередь логов тренировки (sync when online)
- Push: Web Push + FCM; при переходе в native — те же токены через Expo Notifications

### 3.3. Путь в native-приложения

```
Фаза 1 (MVP)     PWA athlete + PWA coach + web admin
       ↓
Фаза 2 (scale)   Expo prebuild → App Store / Google Play
                 (90% кода переиспользуется)
       ↓
Фаза 3 (opt.)    Native modules: HealthKit, Google Fit, live activities
```

**Рекомендация:** сразу писать UI на **React Native Web-compatible** паттернах (Expo Router), даже если первый деплой — PWA. Альтернатива для ещё более быстрого MVP: Vite PWA + Capacitor через 3–6 месяцев.

### 3.4. Admin Panel

| Вариант | Плюсы | Минусы |
|---------|-------|--------|
| **Refine + shadcn** | CRUD из коробки, RBAC | Кастомный UX сложнее |
| **Custom Vite + TanStack Table** | Полный контроль | Больше кода |
| **Retool (internal)** | Очень быстро для ops | Vendor, не для end-users |

**Рекомендация:** Refine или лёгкий custom admin на том же `packages/ui` — визуальная согласованность, отдельный deploy.

---

## 4. Доменная модель (ядро данных)

Сущности напрямую из backlog и Sprint 1:

```
User
├── role: athlete | coach | admin
├── profile, settings, subscription_tier
│
CoachProfile (1:1 User)
├── invite_code, verified, business_info
│
CoachAthleteLink
├── coach_id, athlete_id, status, started_at
│
Exercise (T-03)
├── name, muscle_groups, media_url, coach_id (null = global)
│
Program (T-02)
├── coach_id, athlete_id?, template?, weeks[]
│
Workout → WorkoutExercise → sets/reps/load
│
WorkoutLog (B-01)
├── athlete_id, workout_id, completed_at, notes, substitutions[]
│
ProgressSnapshot (P-02)
├── metrics JSON, period
│
Challenge (P-05)
├── type, difficulty_curve, participants[]
│
Message (C-01, C-02)
├── thread_id, sender, body, context_ref (workout/log)
│
Notification
├── user_id, channel, payload, sent_at
│
AnalyticsEvent
├── user_id, event_name, properties (DoD: engagement metrics)
```

**Multi-tenancy:** данные тренера изолированы через `coach_id`; спортсмен видит только свои программы и своего тренера; admin — read/write через отдельные admin-эндпоинты с audit log.

---

## 5. API и интеграции

### 5.1. REST API (версионирование `/api/v1`)

| Модуль | Эндпоинты (примерно) | Роли |
|--------|----------------------|------|
| Auth | register, login, refresh, invite/accept | all |
| Users | profile, settings | own |
| Exercises | CRUD, search, media upload | coach, admin |
| Programs | CRUD, assign, clone template | coach |
| Workouts | today, log, substitute (A-01), reschedule (A-02) | athlete, coach read |
| Progress | snapshots, charts | athlete, coach |
| Messages | threads, send, ws | athlete ↔ coach |
| Challenges | list, join, progress | athlete, coach |
| Coach dashboard | clients status (T-01), alerts (T-04) | coach |
| Admin | coaches, bans, platform stats | admin |
| Webhooks | Stripe/YooKassa, FCM | system |

**Контракт:** OpenAPI 3.1 → codegen `packages/api-client` (orval / openapi-typescript).

### 5.2. Realtime

- WebSocket `/ws/chat/{thread_id}` — сообщения тренер ↔ спортсмен.
- SSE или WS для live-обновления dashboard тренера (опционально v1.5).
- Push через worker (≤ 1/день по DoD).

### 5.3. Аналитика (DoD)

- Клиент: обёртка над PostHog (self-host или cloud).
- События: `workout_logged`, `exercise_substituted`, `message_sent`, `challenge_completed`, `onboarding_step`.
- Backend: дублирование критичных бизнес-событий в `analytics_events` для отчётов тренера.

---

## 6. AI-слой (roadmap, не MVP)

AI не блокирует Sprint 1, но архитектура закладывает место:

| Функция | Epic | Реализация |
|---------|------|------------|
| Аффективный feedback («Отлично! +15% к прошлой неделе») | P-02, B-02 | Шаблоны + LLM polish (feature flag) |
| Подсказки замены упражнений | A-01 | pgvector similarity по muscle_groups + constraints |
| Резюме недели для тренера | T-05 | LLM over structured logs |
| Генерация черновика программы | T-02 v2 | LLM + validation rules |
| Анализ формы по видео | v2+ | Отдельный CV-сервис, on-device позже |

**Принципы:**

- AI вызывается **только из worker**, не из sync API (latency, rate limits).
- PII минимизируется; prompt — агрегаты, не сырые мед. данные.
- Всегда есть **fallback на rule-based** текст (антипаттерн: сухие цифры без оценки).

```
┌─────────┐     ┌──────────────┐     ┌─────────────┐
│ Worker  │────▶│  AI Adapter  │────▶│ OpenAI API  │
│  task   │     │  (interface) │     │ or local    │
└─────────┘     └──────────────┘     └─────────────┘
                       │
                       ▼
                 ┌───────────┐
                 │ pgvector  │
                 │ (Postgres)│
                 └───────────┘
```

---

## 7. Безопасность и compliance

| Тема | Решение |
|------|---------|
| Auth | JWT access (15 min) + refresh (30 d), httpOnly cookie для web |
| RBAC | athlete / coach / admin + policy checks на уровне service |
| Coach–athlete link | Invite code + explicit accept |
| Privacy (DoD) | Opt-in для social; GDPR-style export/delete |
| Media | Signed URLs, TTL |
| Rate limiting | Redis, per IP + per user |
| Audit | Admin actions → audit_log table |

---

## 8. Монетизация (технически)

| Сегмент | Механика |
|---------|----------|
| B2B Coach | Subscription (Stripe/YooKassa), лимит клиентов по тарифу |
| B2C Athlete | Premium tier (M-04): расширенная автономия, аналитика |
| Feature flags | Unleash / PostHog flags / simple DB flags |

---

## 9. Структура репозитория

```
sport-app/
├── apps/
│   ├── athlete/              # PWA спортсмена (:5173)
│   ├── coach/                # PWA тренера (:5174)
│   ├── coach-web/            # Web desk тренера (:5175) — отдельное приложение
│   └── admin/                # панель суперюзера (:5176)
├── packages/
│   ├── ui/
│   ├── api-client/
│   ├── shared/
│   └── analytics/
├── backend/                  # FastAPI
├── infra/
│   ├── docker-compose.yml
│   └── github/workflows/
├── docs/
│   ├── PROJECT_CONTEXT.md
│   ├── ARCHITECTURE.md       # этот файл
│   └── adr/                  # Architecture Decision Records
└── turbo.json
```

---

## 10. Фазы реализации

### Phase 0 — Foundation (1–2 недели)

- [ ] Monorepo scaffold (Turborepo)
- [ ] Docker Compose: Postgres, Redis, MinIO
- [ ] FastAPI skeleton: auth, users, RBAC
- [ ] CI: ruff, mypy, pytest, eslint, tsc
- [ ] Design tokens + базовые компоненты UI

### Phase 1 — MVP Sprint 1 (backlog)

Согласно [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md):

```
T-03 → T-02 → B-01 → P-02 → M-01
```

| Deliverable | App |
|-------------|-----|
| Библиотека упражнений + media | coach web |
| Конструктор программ | coach web |
| Логирование тренировки | athlete PWA |
| Прогресс-бар | athlete PWA |
| Onboarding | athlete + coach |

### Phase 2 — Связь тренер ↔ спортсмен

- T-01, C-02, C-03, messaging + push
- Coach mobile PWA

### Phase 3 — Scale prep

- Expo native builds
- AI feedback (rule-based → LLM)
- Admin panel full
- Performance, caching, read replicas при росте

---

## 11. ADR: ключевые решения

| # | Решение | Альтернативы | Почему выбрали |
|---|---------|--------------|----------------|
| ADR-001 | FastAPI + PostgreSQL | Node/Nest, Django | Python/AI, OpenAPI, async |
| ADR-002 | React monorepo + PWA | Flutter, pure RN | Web desk тренера, PWA, shared UI |
| ADR-003 | Expo для native path | Capacitor, native Swift/Kotlin | Максимальное переиспользование |
| ADR-004 | shadcn/ui + Tailwind | MUI, Chakra | Современный look, контроль, без lock-in |
| ADR-005 | PostHog analytics | Amplitude, custom only | Self-host opt, flags + analytics |
| ADR-006 | Single API (modular monolith) | Microservices day 1 | Скорость MVP; split AI/worker позже |

---

## 12. Риски и митигация

| Риск | Митигация |
|------|-----------|
| PWA ограничения iOS (push, background) | Ранний план Expo native; не строить критичный UX только на background sync |
| Scope creep (51 story) | Жёсткий MVP по PROJECT_CONTEXT; feature flags |
| AI costs | Rule-based default; LLM opt-in per tier |
| Coach web vs mobile duplication | Один coach app, responsive + route guards |

---

## 13. Следующие шаги

1. **Утвердить** этот документ (или зафиксировать изменения в `docs/adr/`).
2. **Scaffold** monorepo + backend skeleton.
3. **ERD** — детальная схема БД для T-03, T-02, B-01.
4. **Wireframes** athlete onboarding + coach program builder.
5. **OpenAPI v0** — auth + exercises + programs.

---

## Связанные документы

- [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) — продукт, epic, MVP stories
- [Feature Backlog](word/Фитнес-приложение_Feature_Backlog.docx) — 51 user story
- [README.md](../README.md) — обзор проекта
