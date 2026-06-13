# sport-app

Мобильное фитнес-приложение для **тренеров** и **спортсменов**, построенное на научных исследованиях (SDT, геймификация, BCT).

## Статус

**Scaffold готов** — monorepo, FastAPI backend, схема БД, 4 клиентских приложения.

## Структура

```
sport-app/
├── apps/
│   ├── athlete/       # PWA спортсмена      → :5173
│   ├── coach/         # PWA тренера         → :5174
│   ├── coach-web/     # Web desk тренера    → :5175
│   └── admin/         # Панель суперюзера   → :5176
├── packages/
│   ├── shared/        # Общие TypeScript-типы
│   ├── ui/            # UI-kit (AppShell, tokens)
│   └── api-client/    # HTTP-клиент к API
├── backend/           # FastAPI + SQLAlchemy + Alembic → :8000
└── infra/             # docker-compose (Postgres, Redis, MinIO)
```

## Быстрый старт

### Запустить всё одной командой

```bash
./scripts/start.sh
# или
pnpm start
```

Скрипт поднимает Docker → миграции → API → все 4 frontend-приложения и выводит **LAN-адреса** для доступа с телефона (та же Wi‑Fi сеть).

### Остановить и освободить порты

```bash
./scripts/stop.sh
# с остановкой Docker:
./scripts/stop.sh --docker
# или
pnpm stop
```

### Статус

```bash
./scripts/dev.sh status
```

### Порты

| Сервис | Порт |
|--------|------|
| API | 8000 |
| Athlete PWA | 5173 |
| Coach PWA | 5174 |
| Coach Web | 5175 |
| Admin | 5176 |
| Postgres (Docker) | **5433** (не 5432 — часто занят локальным PostgreSQL) |

Логи dev-процессов: `.dev/logs/`

### HTTPS (dev)

Frontend-приложения (Vite) стартуют по **HTTPS** — нужно для PWA (service worker, «Добавить на экран»).

При `./scripts/start.sh` сертификаты генерируются в `.dev/certs/` для `localhost` и текущего LAN IP. Если IP Wi‑Fi изменился — перезапустите стек.

**Рекомендуется — mkcert** (доверенный сертификат на Mac и телефоне):

```bash
brew install mkcert
mkcert -install
./scripts/certs.sh   # или просто ./scripts/start.sh
```

**Телефон (iOS):** AirDrop файла `$(mkcert -CAROOT)/rootCA.pem` → Настройки → Профиль → установить → Настройки → Основные → О программе → Доверие сертификатам.

**Без mkcert:** используется self-signed сертификат (openssl) — на Mac браузер покажет предупреждение, на телефоне нужно принять исключение вручную.

API остаётся на `http://localhost:8000`; запросы с фронта идут через Vite proxy (`/api/v1`).

### Ручной запуск (отдельные части)

```bash
./scripts/dev.sh up        # только Docker
./scripts/dev.sh migrate   # только миграции
./scripts/dev.sh api       # только API
```

## Документы

| Файл | Описание |
|------|----------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Техническая архитектура |
| [docs/DEPLOY.md](docs/DEPLOY.md) | Деплой на сервер (Docker + Caddy) |
| [docs/DATABASE.md](docs/DATABASE.md) | Схема БД, ER-диаграмма |
| [docs/DESIGN.md](docs/DESIGN.md) | Дизайн-система, токены, палитра |
| [docs/PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md) | Продуктовый контекст, epic, MVP |
| [docs/word/Фитнес-приложение_Feature_Backlog.docx](docs/word/Фитнес-приложение_Feature_Backlog.docx) | 51 user story |

## Продуктовая формула

> Тренер задаёт направление → спортсмен выбирает путь → приложение показывает прогресс → сообщество и тренер признают усилия → мотивация становится внутренней, а не принудительной.

## Следующие шаги

- [x] Архитектура
- [x] Scaffold monorepo + FastAPI
- [x] ERD и модели БД
- [x] Auth (JWT + RBAC, phone + 6-digit PIN)
- [ ] API: exercises, programs (Sprint 1)
- [ ] Wireframes ключевых экранов
