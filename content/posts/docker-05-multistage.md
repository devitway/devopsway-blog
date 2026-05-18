---
title: "Docker Level 05: Multi-stage -- Go binary 10MB, образ 900MB"
date: 2026-05-18T14:00:00+03:00
draft: false
categories: ["Docker"]
tags: ["docker", "multistage", "golang", "optimization", "production"]
author: "DevOps Way"
series: "Docker Levels"
seriesTitle: "Docker Levels"
seriesWeight: 5
showToc: true
TocOpen: false
comments: true
description: "Level 05: от 900MB до 15MB. Multi-stage build: билдер для компиляции, scratch/distroless для production. Квиз и вопрос на собеседование."
---

## БОЛЬ

Go-приложение. Бинарник -- 10MB, статически слинкован, без зависимостей. `docker images` показывает 900MB. Внутри образа: весь Go SDK (500MB), git, gcc, make, исходники, кеш сборки. Ничего из этого не нужно в production.

900MB на каждый микросервис, 12 сервисов -- это 10.8GB на ноду. При деплое скачивается 900MB на каждый pod restart. Rollout занимает минуты вместо секунд.

Multi-stage build решает проблему: один этап для сборки, другой -- для запуска. В финальный образ попадает только бинарник.

## КАК УСТРОЕНО

Multi-stage build -- это несколько `FROM` в одном Dockerfile. Каждый `FROM` начинает новый этап (stage). Из предыдущего этапа можно скопировать артефакты через `COPY --from=`.

```dockerfile
# Этап 1: builder -- полная среда сборки
FROM golang:1.23 AS builder
# ... компиляция ...

# Этап 2: production -- минимальный образ
FROM alpine:3.20
COPY --from=builder /app/main /app/main
```

Финальный образ содержит только то, что есть в последнем `FROM` + что вы скопировали из предыдущих этапов.

Варианты базовых образов для production:

| Базовый образ | Размер | Когда использовать |
|--------------|--------|--------------------|
| `scratch` | 0MB | Статические бинарники (Go с CGO_ENABLED=0) |
| `alpine` | 7MB | Нужен shell, CA-сертификаты, glibc |
| `distroless` | 2--20MB | Безопасность без shell |
| `debian-slim` | 80MB | Нужны системные пакеты |

## ПРАКТИКА

Соберите multi-stage Dockerfile для Go-приложения: этап сборки с Go SDK и финальный этап на alpine с одним бинарником.

{{< docker-sort id="level05-quiz" title="Расставьте multi-stage Dockerfile в правильном порядке" >}}
CMD ["/app/main"]
COPY --from=builder /app/main /app/main
RUN go build -o main .
FROM alpine:3.20
COPY go.mod go.sum ./
WORKDIR /app
RUN go mod download
FROM golang:1.23 AS builder
COPY . .
WORKDIR /app
---correct---
FROM golang:1.23 AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -o main .
FROM alpine:3.20
WORKDIR /app
COPY --from=builder /app/main /app/main
CMD ["/app/main"]
---explain---
Два этапа: (1) `builder` -- Go SDK, скачивание зависимостей (кешируется через `go.mod`/`go.sum`), компиляция; (2) production -- чистый alpine, копируем только бинарник через `COPY --from=builder`. Финальный образ не содержит Go SDK, исходников и кеша сборки.
{{< /docker-sort >}}

## РАЗБОР

```dockerfile
# ===== Этап 1: Builder =====
# Полный Go SDK для компиляции
FROM golang:1.23 AS builder
WORKDIR /app

# Сначала зависимости (кешируются)
COPY go.mod go.sum ./
RUN go mod download

# Затем исходники
COPY . .

# Компиляция статического бинарника
RUN go build -o main .

# ===== Этап 2: Production =====
# Минимальный образ -- только для запуска
FROM alpine:3.20
WORKDIR /app

# Копируем ТОЛЬКО бинарник из builder
COPY --from=builder /app/main /app/main

# Запуск
CMD ["/app/main"]
```

Результат:

```bash
docker images
# REPOSITORY  TAG     SIZE
# myapp       latest  17MB    # <- вместо 900MB
```

900MB -> 17MB. Разница в 50 раз. Rollout быстрее, registry меньше, attack surface минимален.

Для ещё меньшего образа -- `scratch` вместо `alpine`:

```dockerfile
FROM scratch
COPY --from=builder /app/main /app/main
CMD ["/app/main"]
```

Это даст ~12MB, но без shell -- нельзя зайти внутрь для отладки.

## ВОПРОС НА СОБЕСЕ

**Вопрос:** Как уменьшить размер Docker-образа? Назовите 3--5 способов.

{{< expand "Показать ответ" >}}
1. **Multi-stage build** -- отделить среду сборки от runtime. Самый значительный эффект: сотни мегабайт -> десятки.

2. **Маленький базовый образ** -- `alpine` (7MB) вместо `ubuntu` (78MB), `distroless` (2--20MB) вместо `debian`, `scratch` (0MB) для статических бинарников.

3. **`.dockerignore`** -- исключить `.git`, `node_modules`, тесты, документацию. Уменьшает и контекст, и образ.

4. **Объединение RUN-инструкций** -- каждый `RUN` создаёт слой. `RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*` -- установка и очистка в одном слое.

5. **Минимальные зависимости** -- `apt-get install --no-install-recommends`, `npm ci --production`, `go build` с `-ldflags="-s -w"` (strip debug info).

Бонус: `docker-slim` / `docker scout` для анализа и автоматического уменьшения образов.
{{< /expand >}}
