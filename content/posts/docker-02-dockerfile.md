---
title: "Docker Level 02: Dockerfile -- Работает у меня, а у коллеги нет"
date: 2026-05-18T11:00:00+03:00
draft: false
categories: ["Docker"]
tags: ["docker", "dockerfile", "build", "image", "devops"]
author: "DevOps Way"
series: "Docker Levels"
seriesTitle: "Docker Levels"
seriesWeight: 2
showToc: true
TocOpen: false
comments: true
description: "Level 02: от 'работает у меня' до воспроизводимой сборки через Dockerfile. Квиз по порядку инструкций и вопрос на собеседование."
---

## БОЛЬ

Джуниор присылает в чат: "У меня всё работает". Вы клонируете репозиторий, запускаете `npm install` -- ошибка. У него Node 18, у вас Node 22. У него Ubuntu, у вас macOS. У него `python3` указывает на 3.10, у вас -- на 3.12.

"Работает у меня" -- это не баг, это отсутствие воспроизводимой среды. Dockerfile решает проблему: он описывает среду декларативно. Кто бы ни собрал образ -- результат будет одинаковый.

## КАК УСТРОЕНО

Dockerfile -- это текстовый файл с инструкциями для сборки образа. Каждая инструкция создаёт слой (layer) в образе.

Основные инструкции:

| Инструкция | Назначение | Пример |
|-----------|-----------|--------|
| `FROM` | Базовый образ | `FROM node:22-alpine` |
| `WORKDIR` | Рабочая директория | `WORKDIR /app` |
| `COPY` | Копировать файлы из контекста | `COPY . .` |
| `RUN` | Выполнить команду при сборке | `RUN npm install` |
| `ENV` | Переменная окружения | `ENV NODE_ENV=production` |
| `EXPOSE` | Документация порта | `EXPOSE 3000` |
| `CMD` | Команда запуска контейнера | `CMD ["node", "app.js"]` |

Порядок инструкций важен: Docker кеширует слои, и если слой не менялся -- он берётся из кеша. Об этом подробнее в Level 03.

## ПРАКТИКА

Вам нужно собрать образ для Node.js-приложения: взять базовый образ, задать рабочую директорию, скопировать исходники, установить зависимости, указать порт и команду запуска.

{{< docker-sort id="level02-quiz" title="Расставьте Dockerfile в правильном порядке" >}}
CMD ["node", "app.js"]
COPY . .
RUN npm install
EXPOSE 3000
FROM node:22-alpine
WORKDIR /app
---correct---
FROM node:22-alpine
WORKDIR /app
COPY . .
RUN npm install
EXPOSE 3000
CMD ["node", "app.js"]
---explain---
`FROM` всегда первая инструкция -- определяет базовый образ. `WORKDIR` задаёт директорию для всех последующих команд. `COPY` копирует исходники, `RUN` устанавливает зависимости. `EXPOSE` документирует порт (не открывает его!). `CMD` -- команда при запуске контейнера, всегда последняя.
{{< /docker-sort >}}

## РАЗБОР

```dockerfile
# Базовый образ: Node.js 22 на Alpine Linux (маленький)
FROM node:22-alpine

# Все команды выполняются в /app
WORKDIR /app

# Копируем всё из текущей директории в /app контейнера
COPY . .

# Устанавливаем зависимости
RUN npm install

# Документируем порт (для docker run -P)
EXPOSE 3000

# Команда запуска -- выполнится при docker run
CMD ["node", "app.js"]
```

Этот Dockerfile работает, но не оптимален. Каждое изменение кода инвалидирует кеш `npm install`. Как это исправить -- в Level 03.

Сборка и запуск:

```bash
docker build -t myapp .
docker run -d -p 3000:3000 myapp
```

## ВОПРОС НА СОБЕСЕ

**Вопрос:** В чём разница между `CMD` и `ENTRYPOINT`?

{{< expand "Показать ответ" >}}
`CMD` задаёт команду по умолчанию, которую можно полностью переопределить при `docker run`:

```dockerfile
CMD ["node", "app.js"]
# docker run myapp           -> node app.js
# docker run myapp bash      -> bash (CMD заменён)
```

`ENTRYPOINT` задаёт фиксированную команду, а аргументы из `docker run` дописываются к ней:

```dockerfile
ENTRYPOINT ["node"]
CMD ["app.js"]
# docker run myapp           -> node app.js
# docker run myapp server.js -> node server.js (CMD заменён, ENTRYPOINT нет)
```

На практике: `CMD` -- для приложений, где пользователь может захотеть запустить shell. `ENTRYPOINT` -- для утилит, где команда фиксирована (например, `curl`, `psql`). Комбинация `ENTRYPOINT` + `CMD` даёт фиксированную команду с дефолтными аргументами.
{{< /expand >}}
