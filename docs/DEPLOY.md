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

## 3. Первичная настройка сервера

Подключитесь по SSH и выполните (один раз):

```bash
curl -fsSL https://raw.githubusercontent.com/arsenievtver/sport-app/main/scripts/server-setup.sh | sudo bash
```

Или вручную после `git clone`:

```bash
sudo ./scripts/server-setup.sh
```

---

## 4. Конфигурация

```bash
sudo su - deploy
cd /opt/sport-app
cp infra/prod/.env.example infra/prod/.env
nano infra/prod/.env
```

Обязательно замените:

```env
DOMAIN=athlete-app.ru
LETSENCRYPT_EMAIL=you@athlete-app.ru
SECRET_KEY=<случайная строка 48+ символов>
POSTGRES_PASSWORD=<сильный пароль>
DATABASE_URL=postgresql+asyncpg://sport:<тот же пароль>@postgres:5432/sport_app
CORS_ALLOW_ORIGIN_REGEX=^https://([a-z0-9-]+\.)?athlete-app\.ru$
S3_SECRET_KEY=<случайная строка>
```

Сгенерировать секрет:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(48))"
```

---

## 5. Деплой

```bash
./scripts/deploy.sh
```

Скрипт:
1. Собирает frontend-приложения в Docker
2. Копирует статику и лендинг
3. Поднимает Postgres, Redis, MinIO, API, Caddy
4. Применяет миграции Alembic

После деплоя проверьте:

- `https://athlete-app.ru` — лендинг
- `https://my.athlete-app.ru` — Athlete
- `https://coach.athlete-app.ru` — Coach PWA
- `https://coach-web.athlete-app.ru` — Coach Web
- `https://admin.athlete-app.ru` — Admin

---

## 6. Автодеплой (GitHub Actions)

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

## 7. Полезные команды

```bash
cd /opt/sport-app/infra/prod

# Логи
docker compose logs -f caddy
docker compose logs -f api

# Перезапуск
docker compose restart api caddy

# Обновление вручную
cd /opt/sport-app && git pull && ./scripts/deploy.sh
```

Создать admin-пользователя:

```bash
docker compose -f infra/prod/docker-compose.yml exec api python -m scripts.create_admin
```

(если скрипт добавлен в образ — иначе через `docker compose exec api` + alembic/ручной SQL)

---

## Порты на сервере

| Порт | Назначение |
|------|------------|
| 80 | HTTP → редирект на HTTPS (Caddy) |
| 443 | HTTPS (Caddy) |
| 22 | SSH |

Postgres, Redis, MinIO — только внутри Docker-сети, наружу не проброшены.
