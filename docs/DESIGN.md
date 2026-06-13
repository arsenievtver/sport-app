# Дизайн-система sport-app

> Тема: **Midnight Vitality** · dark-first · единый источник: `packages/ui/src/tokens.css`

## Концепция

Продукт строится на SDT (компетентность, автономия, связанность) — дизайн должен передавать **прогресс и поддержку**, а не агрессивное соревнование.

| Аудитория | Что важно в UI |
|-----------|----------------|
| Спортсменки | Чистота, прогресс без давления, тёплый feedback |
| Спортсмены | Энергия, ясные цифры, быстрые действия в зале |
| Тренеры | Плотность информации (web), статус клиентов, профессиональный вид |

**Решение:** тёмная база + **teal** (primary) + **warm amber** (accent). Не «bro-HIIT красный», не «wellness-пастель» — нейтрально-современный premium-fitness.

## Тренды 2026 (что учли)

1. **Dark-first** — глубина через слои surface, не тени ([Muzli 2026](https://muz.li/blog/whats-changing-in-mobile-app-design-ui-patterns-that-matter-in-2026/))
2. **4+ уровня surface** — bg → elevated → surface → overlay
3. **Luminance borders** — `rgba(255,255,255,0.08)` вместо drop-shadow
4. **Touch 48px** — навигация одним пальцем в зале
5. **Микро-градиенты** — subtle radial на фоне, не кричащие 2018-gradients
6. **Plus Jakarta Sans** — геометричный, дружелюбный, хорошо в RU/EN

## Палитра

```
Фон и поверхности          Акценты
─────────────────          ─────────────────────────────
#0c0f14  bg                #2dd4bf  primary (teal)
#151a22  elevated           #fb923c  accent (amber) — награды, streak
#1c2430  surface            #34d399  success
#243040  hover              #f87171  danger (мягкий)
                           #60a5fa  info
```

### Почему эти цвета

| Цвет | Роль | Психология |
|------|------|------------|
| **Teal** | Primary, CTA, links | Энергия + wellness + доверие; gender-neutral |
| **Amber** | Прогресс, бейджи, «+15% к прошлой неделе» | Тепло, достижение (SDT feedback) |
| **Warm dark bg** | Фон | Premium, не «клинический» cold grey |
| **Soft red** | Ошибки | Не агрессивный «стоп-сигнал» |

Избегаем: пастель (пассивность), чистый grey UI (скука), neon-red/black (только «качки»), розовый/фиолетовый wellness-клише.

## Градиенты

| Token | Использование |
|-------|---------------|
| `--gradient-app-bg` | Фон приложения (subtle teal + amber glow) |
| `--gradient-primary` | Кнопки CTA |
| `--gradient-progress` | Progress bars, charts |
| `--gradient-achievement` | Челленджи, бейджи (amber → rose) |

## Типографика

**Plus Jakarta Sans** (Google Fonts, уже подключён в tokens.css)

| Token | Size | Use |
|-------|------|-----|
| `--text-xs` | 12px | Badges, captions |
| `--text-sm` | 14px | Secondary text |
| `--text-base` | 16px | Body |
| `--text-xl` | 20px | Screen titles |
| `--text-3xl` | 30px | Hero numbers (вес, PR) |

## Где менять дизайн

```
packages/ui/src/tokens.css   ← CSS (все приложения)
packages/ui/src/theme.ts     ← TS (Recharts, inline)
```

После изменения tokens.css — перезапуск dev-сервера. `theme.ts` синхронизируй вручную (или позже — codegen).

### Light mode (заготовка)

На `<html data-theme="light">` — базовые override в tokens.css. Полная light-тема — позже.

## Компоненты (scaffold)

| Class / export | Назначение |
|----------------|------------|
| `.card` | Карточка с subtle shine |
| `.btn-primary` | Основная кнопка |
| `.badge-*` | Статусы |
| `AppShell` | Layout mobile |
| `theme` | TS constants |

## Auth screens

Компонент `AuthScreen` в `@sport-app/ui` — login + register в одном экране.

**Опциональное hero-изображение:** положи `public/auth-hero.webp` и передай `heroImageUrl="/auth-hero.webp"`.

Рекомендации для фото:
- **Athlete:** силуэт спортсмена/спортсменки в движении, контрастный, без лица крупным планом (универсально)
- **Coach:** тренер с планшетом/в зале, мягкий bokeh, тёмный фон
- Формат: WebP, ~800×1200px, низкая opacity (UI накладывает 15%)

Без картинки работают CSS-orbs + grid — уже достаточно выразительно.

## Следующие шаги

- [ ] Подключить shadcn/ui поверх tokens (CSS variables mapping)
- [ ] Bottom navigation (athlete, coach PWA)
- [ ] Coach-web: sidebar + `--content-max-width-desktop`
- [ ] Storybook или `/design` preview page

## Референсы

- [Fitness design trends 2026](https://canvasbuilder.co/blog/fitness-website-design-trends-2026)
- [Mobile UI patterns 2026](https://muz.li/blog/whats-changing-in-mobile-app-design-ui-patterns-that-matter-in-2026/)
- [Fitness color psychology](https://nuvex.design/use-cases/fitness)
