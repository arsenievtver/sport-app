# Auth API

Логин — **номер телефона** в формате `79106492742` (11 цифр, начинается с `7`).  
Пароль — **PIN из 6 цифр**.

Также принимается ввод с `8` или `+7` — нормализуется автоматически.

## Эндпоинты

| Method | Path | Auth | Описание |
|--------|------|------|----------|
| POST | `/api/v1/auth/register` | — | Регистрация athlete или coach |
| POST | `/api/v1/auth/login` | — | Вход по phone + pin |
| POST | `/api/v1/auth/refresh` | — | Обновление access token |
| GET | `/api/v1/auth/me` | Bearer | Текущий пользователь |

## Примеры

### Регистрация спортсмена

```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "79106492742",
    "pin": "123456",
    "role": "athlete",
    "display_name": "Иван"
  }'
```

### Вход

```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone": "79106492742", "pin": "123456"}'
```

### Текущий пользователь

```bash
curl http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer <access_token>"
```

## Идентичность: один телефон = один пользователь

**Телефон — единственный ключ человека в системе.** Не создаём второго user на тот же номер.

| Ситуация | Как устроено |
|----------|----------------|
| Ты тренер + админ + тестируешь как атлет | **Один** `User`, `roles: ["admin","coach","athlete"]`, один PIN |
| Реальный атлет и реальный тренер — разные люди | **Два** `User` (два телефона), связь через `CoachAthleteLink` (invite-код) |

### Сценарий «я один, несколько ролей»

```bash
# 1. Атлет зарегистрировался сам (или ты создал себе athlete)
# POST /auth/register → roles: ["athlete"]

# 2. Добавить тренера и админа на тот же телефон:
./scripts/create-admin.sh 79106492742 123456 "Иван" --coach --athlete
# → roles: ["admin","coach","athlete"], профили coach + athlete
```

Повторный запуск скрипта **не дублирует** user — только добавляет недостающие роли.

### Сценарий «атлет уже есть, выдать тренера»

```bash
./scripts/grant-roles.sh 79106492742 "Мария" --coach
```

### Самoregистрация

Если телефон уже в системе — `409` и подсказка войти или обратиться к админу. Второй аккаунт на тот же номер не создаётся.

## RBAC

Роли: `athlete`, `coach`, `admin`. У пользователя **может быть несколько ролей** одновременно (`roles: ["coach", "admin", "athlete"]`).

В коде используйте зависимости:

```python
from app.core.deps import CurrentUser, CoachUser, AthleteUser, AdminUser
```

- `CurrentUser` — любой авторизованный
- `CoachUser` / `AthleteUser` / `AdminUser` — у пользователя есть нужная роль (403 иначе)

Admin **не регистрируется через API** — создаётся скриптом:

```bash
# только admin
./scripts/create-admin.sh 79106492742 123456 "Admin"

# admin + тренер + атлет (для тестов одним аккаунтом)
./scripts/create-admin.sh 79106492742 123456 "Иван" --coach --athlete
```

## Токены

- **Access token** — JWT, 15 мин (настраивается `ACCESS_TOKEN_EXPIRE_MINUTES`)
- **Refresh token** — JWT, 30 дней (`REFRESH_TOKEN_EXPIRE_DAYS`)
- PIN хранится как bcrypt-хеш
