# Production deployment (Yandex Cloud VM + Caddy + Docker)

## Архитектура

| Поддомен | Приложение |
|----------|------------|
| `@`, `www` | Лендинг |
| `my` | Athlete PWA |
| `coach` | Coach PWA (мобильный) |
| `coach-web` | Coach Web (desktop) |
| `admin` | Admin panel |

Домен: **athlete-app.ru**

API доступен на каждом поддомене через `/api/v1` (reverse proxy → FastAPI).

Стек на сервере: **Docker Compose** + **Caddy** (HTTPS через Let's Encrypt).

---

## 1. GitHub

Репозиторий: [github.com/arsenievtver/sport-app](https://github.com/arsenievtver/sport-app)

Локально (первый раз):

```bash
git remote add origin https://github.com/arsenievtver/sport-app.git
git branch -M main
git push -u origin main
```

---

## 2. DNS

Все A-записи → IP сервера (`51.250.9.170`):

| Запись | Тип | Значение |
|--------|-----|----------|
| `@` | A | 51.250.9.170 |
| `www` | A | 51.250.9.170 |
| `my` | A | 51.250.9.170 |
| `coach` | A | 51.250.9.170 |
| `coach-web` | A | 51.250.9.170 |
| `admin` | A | 51.250.9.170 |

Дождитесь распространения DNS (обычно 5–30 минут).

---

## 3. Первичная настройка сервера (один раз)

Подключитесь по SSH:

```bash
ssh root@51.250.9.170
```

Установите Docker, пользователя `deploy`, firewall, клонируйте репозиторий:

```bash
curl -fsSL https://raw.githubusercontent.com/arsenievtver/sport-app/main/scripts/server-setup.sh | bash
```

---

## 4. Конфигурация (один раз)

```bash
su - deploy
cd /opt/sport-app
cp infra/prod/.env.example infra/prod/.env
./scripts/gen-secrets.sh    # скопируйте вывод в .env
nano infra/prod/.env
```

Минимум в `.env`:

```env
DOMAIN=athlete-app.ru
LETSENCRYPT_EMAIL=you@athlete-app.ru
SECRET_KEY=<из gen-secrets.sh>
POSTGRES_PASSWORD=<из gen-secrets.sh>
DATABASE_URL=postgresql+asyncpg://sport:<тот же пароль>@postgres:5432/sport_app
CORS_ALLOW_ORIGIN_REGEX=^https://([a-z0-9-]+\.)?athlete-app\.ru$
S3_SECRET_KEY=<из gen-secrets.sh>
```

---

## 5. Первый деплой

```bash
cd /opt/sport-app
./scripts/deploy.sh
```

Первый запуск займёт 10–20 минут (сборка Docker-образов).

---

## 6. Обновления (каждый раз после push на GitHub)

**Вариант A — одна команда на сервере (рекомендуется для старта):**

```bash
ssh deploy@51.250.9.170
cd /opt/sport-app && ./scripts/deploy.sh
```

Скрипт сам делает `git pull` с GitHub → сборка → перезапуск.

**Вариант B — автоматически при push (без SSH):**

Настройте GitHub Actions secrets (см. ниже) — после каждого `git push` деплой запускается сам.

---

## 7. Автодеплой (GitHub Actions, опционально)

В настройках репозитория → **Secrets and variables → Actions**:

| Secret | Значение |
|--------|----------|
| `DEPLOY_HOST` | `51.250.9.170` |
| `DEPLOY_USER` | `deploy` |
| `DEPLOY_SSH_KEY` | приватный SSH-ключ |

На сервере для пользователя `deploy`:

```bash
mkdir -p ~/.ssh && chmod 700 ~/.ssh
# добавьте публичный ключ GitHub Actions в ~/.ssh/authorized_keys
```

После этого каждый `git push` в `main` запускает деплой.

---

## 8. Полезные команды

```bash
cd /opt/sport-app/infra/prod

# Логи
docker compose logs -f caddy
docker compose logs -f api

# Перезапуск
docker compose restart api caddy

# Обновление вручную (pull уже внутри deploy.sh)
cd /opt/sport-app && ./scripts/deploy.sh
```

Создать admin-пользователя (суперюзер, **не через API**):

```bash
# Локально или на сервере (если prod API в Docker уже запущен)
./scripts/create-admin.sh 79106492742 123456 "Admin"
```

Скрипт сам выберет: prod-контейнер `api` или локальный venv.
Подробнее: [docs/AUTH.md](../AUTH.md).

---

## Порты на сервере

| Порт | Назначение |
|------|------------|
| 80 | HTTP → редирект на HTTPS (Caddy) |
| 443 | HTTPS (Caddy) |
| 22 | SSH |

Postgres, Redis, MinIO — только внутри Docker-сети, наружу не проброшены.
