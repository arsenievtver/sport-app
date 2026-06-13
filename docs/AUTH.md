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

## RBAC

Роли: `athlete`, `coach`, `admin`.

В коде используйте зависимости:

```python
from app.core.deps import CurrentUser, CoachUser, AthleteUser, AdminUser
```

- `CurrentUser` — любой авторизованный
- `CoachUser` / `AthleteUser` / `AdminUser` — только указанная роль (403 иначе)

Admin **не регистрируется через API** — создаётся скриптом:

```bash
cd backend && source .venv/bin/activate
python ../scripts/create_admin.py 79106492742 123456 "Admin"
```

## Токены

- **Access token** — JWT, 15 мин (настраивается `ACCESS_TOKEN_EXPIRE_MINUTES`)
- **Refresh token** — JWT, 30 дней (`REFRESH_TOKEN_EXPIRE_DAYS`)
- PIN хранится как bcrypt-хеш
