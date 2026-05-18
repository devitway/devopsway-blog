---
title: "Docker Level 04: .dockerignore -- Образ 2GB, внутри .env с паролями"
date: 2026-05-18T13:00:00+03:00
draft: false
categories: ["Docker"]
tags: ["docker", "dockerignore", "security", "image-size", "devops"]
author: "DevOps Way"
series: "Docker Levels"
seriesTitle: "Docker Levels"
seriesWeight: 4
showToc: true
TocOpen: false
comments: true
description: "Level 04: почему образ весит 2GB и содержит .env с паролями. Как .dockerignore защищает от утечек и ускоряет сборку."
---

## БОЛЬ

Ревью Docker-образа перед деплоем. `docker images` показывает 2.1GB для простого Node.js-приложения. Запускаете `docker run --rm myapp ls -la` и видите: `node_modules` (800MB), `.git` (400MB), `test-data` (500MB). И самое страшное -- `.env` с `DB_PASSWORD`, `JWT_SECRET`, `AWS_SECRET_KEY`.

Образ уже в Docker Hub. Пароли в открытом доступе. Даже если удалить `.env` в следующем слое -- он останется в истории образа. `docker history` покажет всё.

Исправление: **`.dockerignore`** -- файл-фильтр, который не пускает лишнее в контекст сборки.

## КАК УСТРОЕНО

Когда вы запускаете `docker build .`, Docker отправляет в daemon весь текущий каталог -- это **build context**. Всё, что в контексте -- доступно для `COPY` и `ADD`. Всё, что не нужно -- замедляет сборку и раздувает образ.

`.dockerignore` работает как `.gitignore`: указывает файлы и директории, которые НЕ попадут в build context.

Что должно быть в `.dockerignore` почти всегда:

| Паттерн | Зачем |
|---------|-------|
| `.git` | История репозитория, сотни мегабайт |
| `node_modules` | Зависимости -- ставятся при сборке через `npm ci` |
| `.env` | Секреты, пароли, токены |
| `*.log` | Логи -- не нужны в образе |
| `Dockerfile` | Сам Dockerfile не нужен внутри |
| `.dockerignore` | Мета-файл |
| `tests/` / `__tests__/` | Тесты -- не нужны в production |
| `*.md` | Документация |
| `.vscode` / `.idea` | Настройки редактора |

## ПРАКТИКА

Составьте правильный `.dockerignore` для Node.js-проекта. Расставьте строки в логичном порядке: сначала VCS и среда, затем зависимости, секреты, тесты и документация.

{{< docker-sort id="level04-quiz" title="Расставьте .dockerignore в правильном порядке" >}}
*.md
.env
.env.*
node_modules
.git
.gitignore
Dockerfile
.dockerignore
tests/
coverage/
*.log
.vscode
.idea
---correct---
.git
.gitignore
.vscode
.idea
node_modules
.env
.env.*
Dockerfile
.dockerignore
tests/
coverage/
*.log
*.md
---explain---
Логичная группировка: (1) VCS и редактор -- `.git`, `.gitignore`, `.vscode`, `.idea`; (2) зависимости -- `node_modules`; (3) секреты -- `.env`, `.env.*`; (4) мета-файлы Docker -- `Dockerfile`, `.dockerignore`; (5) тесты и артефакты -- `tests/`, `coverage/`, `*.log`; (6) документация -- `*.md`. Порядок внутри `.dockerignore` технически не важен, но группировка помогает при ревью.
{{< /docker-sort >}}

## РАЗБОР

```gitignore
# .dockerignore

# VCS и настройки редактора
.git
.gitignore
.vscode
.idea

# Зависимости (ставятся при сборке)
node_modules

# Секреты — НИКОГДА не должны попасть в образ
.env
.env.*

# Docker мета-файлы
Dockerfile
.dockerignore

# Тесты и покрытие
tests/
coverage/

# Логи и документация
*.log
*.md
```

Эффект:

- **Размер**: контекст сборки уменьшается с 2GB до десятков мегабайт
- **Скорость**: `docker build` не копирует гигабайты в daemon
- **Безопасность**: `.env` физически не попадает в образ, даже случайный `COPY . .` не утянет секреты

Проверить что попадает в контекст:

```bash
# Размер контекста видно в первой строке docker build
docker build . 2>&1 | head -1
# => Sending build context to Docker daemon  45.2MB
```

## ВОПРОС НА СОБЕСЕ

**Вопрос:** Секрет попал в Docker-образ через `COPY`. Удаление файла в следующем слое решает проблему?

{{< expand "Показать ответ" >}}
Нет. Docker-образ состоит из слоёв, и каждый слой иммутабелен. Если в слое 3 скопировали `.env`, а в слое 4 удалили -- файл всё ещё есть в слое 3. Любой, кто скачает образ, может извлечь его:

```bash
# Посмотреть историю слоёв
docker history myapp

# Извлечь файловую систему конкретного слоя
docker save myapp | tar -xf - --include='*/layer.tar'
```

Правильные способы работы с секретами:

1. **`.dockerignore`** -- секреты не попадают в контекст сборки
2. **BuildKit secrets** -- `docker build --secret id=mysecret,src=.env` + `RUN --mount=type=secret,id=mysecret`
3. **Переменные окружения** -- передаются при `docker run -e`, не запекаются в образ
4. **Vault / Secrets Manager** -- приложение получает секреты в runtime

Если секрет уже попал в образ -- пересоберите с нуля (`docker build --no-cache`) и отзовите скомпрометированные credentials.
{{< /expand >}}
