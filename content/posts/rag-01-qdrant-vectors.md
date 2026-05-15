---
title: "RAG Pipeline 1/N: Qdrant — векторная база данных для AI"
date: 2026-05-07T12:00:00+03:00
lastmod: 2026-05-07T12:00:00+03:00
draft: false
weight: 1
categories: ["AI и MLOps"]
tags: ["rag", "qdrant", "vector-database", "ai", "devops"]
author: "DevOps Way"
series: "RAG Pipeline"
description: "Зачем AI нужна векторная база данных, как работает Qdrant, косинусная близость на пальцах. Практика: запускаем Qdrant в Docker, создаём коллекцию, делаем семантический поиск за 15 минут."
showToc: true
TocOpen: true
hidemeta: false
comments: true
disableHLJS: false
disableShare: false
hideSummary: false
searchHidden: false
ShowReadingTime: true
ShowBreadCrumbs: true
ShowPostNavLinks: true
ShowWordCount: true
ShowRssButtonInSectionTermList: true
UseHugoToc: true
cover:
    image: ""
    alt: "Qdrant — векторная БД для RAG"
    caption: "RAG Pipeline: от проблемы к решению"
    relative: false
    hidden: false
editPost:
    URL: ""
    Text: "Предложить изменения"
    appendFilePath: true

---

| Параметр | Значение |
|----------|----------|
| Bloom | L3–L4 (Применение → Анализ) |
| SFIA | Уровень 2–3 |
| Dreyfus | Advanced Beginner → Competent |
| Артефакт | docker-compose.yml + скрипт проверки |
| Проверка | `curl localhost:6333/healthz` → `ok`, семантический поиск работает |

---

## TL;DR

AI-модель забывает всё после каждой сессии. Векторная база данных решает эту проблему -- хранит знания в виде чисел и находит похожее по смыслу, а не по ключевым словам.

---

## Проблема: AI без памяти

Каждая сессия с LLM начинается с чистого листа:

```
БЕЗ RAG:                          С RAG:
┌──────────┐                      ┌──────────┐
│   LLM    │──→ Ollama            │   LLM    │──→ Ollama
│          │                      │   + RAG  │
└──────────┘                      └────┬─────┘
     │                                 │
  закрыл                            закрыл
  сессию                            сессию
     │                                 │
     ▼                                 ▼
┌──────────┐                      ┌──────────┐
│   LLM    │  "Я ничего не        │   LLM    │  "Да, в прошлый
│          │   помню"             │   + RAG  │   раз мы делали X"
└──────────┘                      └────┬─────┘
                                       │
                                  ┌────▼─────┐
                                  │  Qdrant  │ ← вектора
                                  └──────────┘
```

Вы потратили час объясняя модели архитектуру проекта. Закрыли терминал. Открыли снова -- всё с нуля.

Обычный SQL здесь не поможет: он ищет по точному совпадению или LIKE-паттернам. Запрос "как настроить reverse proxy" не найдёт документ, в котором написано "проксирование запросов через nginx". **Разные слова, один смысл** -- это задача для векторного поиска.

---

## Что такое Qdrant

Qdrant (произносится "квадрант") -- векторная база данных. Хранит данные не как строки таблицы, а как точки в многомерном пространстве.

### Три ключевых концепции

**1. Коллекция** -- аналог таблицы в PostgreSQL. Но вместо колонок и строк -- набор точек (points) с векторами.

**2. Вектор** -- координаты смысла в цифровом пространстве. Модель-эмбеддер превращает текст в массив чисел фиксированной длины. Тексты с похожим значением получают близкие координаты, даже если написаны разными словами:

```
"Docker container"  → [0.12, -0.34, 0.56, ..., 0.78]   # 384 числа
"containerization"  → [0.11, -0.31, 0.54, ..., 0.76]   # похожий вектор
"borsch recipe"     → [-0.89, 0.45, -0.12, ..., 0.03]  # совсем другой
```

**3. Косинусная близость (cosine similarity)** -- мера похожести двух векторов. Не сравнивает длину, только направление:

```
cosine("Docker container", "containerization") = 0.94  ← похожи
cosine("Docker container", "borsch recipe")    = 0.12  ← не похожи
```

Чем ближе к единице -- тем больше общего в значении, даже если сами слова разные. 0 -- ничего общего, 1 -- одно и то же. На практике score выше 0.8 -- хорошее совпадение.

> **Важно:** score 0.94 -- это на английском тексте. С русским всё сложнее: embedding-модели обучены преимущественно на английском, и русские фразы получают более низкие score. Подробнее -- в [RAG Pipeline 2/N: Embeddings](/posts/rag-02-embeddings/).

### Payload -- метаданные к вектору

Каждая точка в Qdrant хранит не только вектор, но и произвольные данные:

```json
{
  "id": "abc-123",
  "vector": [0.12, -0.34, ...],
  "payload": {
    "text": "Для reverse proxy используйте proxy_pass...",
    "file_path": "nginx-guide.md",
    "start_line": 45,
    "end_line": 89,
    "tags": "nginx, proxy"
  }
}
```

Payload позволяет модели не только найти релевантный кусок, но и **сослаться на источник**: "Согласно nginx-guide.md, строки 45-89..."

---

## Практика: Qdrant за 15 минут

### Шаг 1. Запускаем Qdrant

```bash
docker run -d \
  --name qdrant \
  -p 6333:6333 \
  -v qdrant-data:/qdrant/storage \
  qdrant/qdrant:latest
```

Проверяем:

```bash
curl -s http://localhost:6333/healthz
# healthz check passed
```

Dashboard доступен в браузере: `http://localhost:6333/dashboard`

### Шаг 2. Создаём коллекцию

```bash
curl -X PUT http://localhost:6333/collections/demo \
  -H "Content-Type: application/json" \
  -d '{
    "vectors": {
      "size": 384,
      "distance": "Cosine"
    }
  }'
```

Параметры:
- `size: 384` -- размерность вектора (зависит от модели эмбеддинга, all-MiniLM = 384)
- `distance: "Cosine"` -- метрика сравнения (косинусная близость)

Проверяем:

```bash
curl -s http://localhost:6333/collections/demo | python3 -m json.tool
```

### Шаг 3. Добавляем данные (upsert)

384 числа вручную писать не нужно -- используем Python-скрипт, который генерирует демо-вектора (в реальности их создаёт модель эмбеддинга):

```python
#!/usr/bin/env python3
# demo-upsert.py — добавляем точки в Qdrant
import requests, random

QDRANT = "http://localhost:6333"

random.seed(42)
points = [
    {
        "id": 1,
        "vector": [random.uniform(-1, 1) for _ in range(384)],
        "payload": {
            "text": "Для reverse proxy в nginx используйте proxy_pass",
            "source": "nginx-guide.md",
            "topic": "nginx"
        }
    },
    {
        "id": 2,
        "vector": [random.uniform(-1, 1) for _ in range(384)],
        "payload": {
            "text": "Docker Compose описывает многоконтейнерное приложение в YAML",
            "source": "docker-guide.md",
            "topic": "docker"
        }
    }
]

resp = requests.put(f"{QDRANT}/collections/demo/points",
                    json={"points": points})
print(resp.json())
# {"result":{"operation_id":0,"status":"acknowledged"},...}
```

```bash
pip install requests
python3 demo-upsert.py
```

`upsert` -- если точка с таким ID существует, обновит; если нет -- создаст. Идемпотентная операция.

### Шаг 4. Семантический поиск

Ищем точку, ближайшую к нашему запросу:

```python
#!/usr/bin/env python3
# demo-search.py — семантический поиск в Qdrant
import requests, random

QDRANT = "http://localhost:6333"

# Для демо: используем вектор, идентичный точке 1 (nginx)
# В реальности вектор запроса создаёт модель эмбеддинга
random.seed(42)
query_vector = [random.uniform(-1, 1) for _ in range(384)]

resp = requests.post(f"{QDRANT}/collections/demo/points/search",
                     json={
                         "vector": query_vector,
                         "limit": 2,
                         "with_payload": True
                     })

for hit in resp.json()["result"]:
    score = hit["score"]
    text = hit["payload"]["text"]
    source = hit["payload"]["source"]
    print(f"  [{score:.4f}] {source}: {text}")
```

```bash
python3 demo-search.py
#   [1.0000] nginx-guide.md: Для reverse proxy в nginx используйте proxy_pass
#   [0.0353] docker-guide.md: Docker Compose описывает многоконтейнерное...
```

Точка с nginx получила score 1.0 (идеальное совпадение -- мы искали тем же вектором). Docker получил почти 0 -- совсем другой смысл.

### Шаг 5. Реальный семантический поиск (с Ollama)

В реальном pipeline вектора создаёт модель эмбеддинга. Вот как это работает с Ollama:

```bash
# Скачиваем модель эмбеддинга
ollama pull all-minilm

# Получаем вектор запроса
curl -s http://localhost:11434/api/embed \
  -d '{"model":"all-minilm","input":"как настроить reverse proxy"}' \
  | python3 -c "
import sys, json
emb = json.load(sys.stdin)['embeddings'][0]
print(f'Размерность: {len(emb)}')
print(f'Первые 5 чисел: {[round(x,4) for x in emb[:5]]}')
"
# Размерность: 384
# Первые 5 чисел: [-0.0312, 0.0891, -0.0456, 0.1234, -0.0678]
```

Тот же текст всегда даёт тот же вектор. Похожие тексты дают похожие вектора. На этом и строится семантический поиск.

---

## Под капотом: как работает RAG-поиск

```
Запрос пользователя          База знаний (Qdrant)
"как настроить proxy"         ┌──────────────────┐
        │                     │ nginx-guide.md   │→ [0.12, -0.34, ...]
        ▼                     │ docker-guide.md  │→ [0.89, 0.45, ...]
 Embedding Model              │ ssh-guide.md     │→ [-0.56, 0.23, ...]
 (all-MiniLM)                 └──────────────────┘
        │                              │
        ▼                              │
 [0.11, -0.31, ...]       косинусная близость
        │                              │
        └──────────────────────────────┘
                    │
                    ▼
            Ранжирование:
            1. nginx-guide.md  → 0.94
            2. docker-guide.md → 0.67
            3. ssh-guide.md    → 0.23
                    │
                    ▼
            Top-K результатов → в контекст LLM
```

Ключевые этапы:

1. **Векторизация (embedding)** -- текст запроса превращается в вектор той же моделью, которой индексировалась база
2. **Векторный поиск (vector search)** -- Qdrant ищет ближайшие точки по косинусной близости (алгоритм HNSW, логарифмическая сложность)
3. **Ранжирование (ranking)** -- результаты сортируются по оценке релевантности (score)
4. **Подстановка контекста (context injection)** -- лучшие K результатов вставляются в промпт LLM вместе с метаданными

Важное правило: **одна модель эмбеддинга для индексации и поиска**. Если индексировали через `all-minilm`, искать тоже через `all-minilm`. Разные модели дают несовместимые вектора.

---

## Мини-тест

**1. Почему PostgreSQL с `LIKE '%proxy%'` не заменяет векторный поиск?**

<details>
<summary>Ответ</summary>

`LIKE` ищет по точному совпадению подстроки. Запрос "настройка проксирования" не найдёт документ со словом "proxy". Векторный поиск сравнивает смысл, а не буквы -- косинусная близость между семантически похожими текстами будет высокой независимо от конкретных слов.

</details>

**2. Коллекция создана с `size: 384`. Можно ли добавить вектор длиной 768?**

<details>
<summary>Ответ</summary>

Нет. Размерность задаётся при создании коллекции и должна совпадать с выходом модели эмбеддинга. all-MiniLM даёт 384, mxbai-embed-large -- 1024, nomic-embed-text -- 768. Несовпадение = ошибка при upsert.

</details>

**3. Score = 0.95. Score = 0.45. Что это значит для качества поиска?**

<details>
<summary>Ответ</summary>

При косинусной близости (cosine similarity) 0.95 -- высокая семантическая схожесть, фрагмент почти наверняка релевантен запросу. 0.45 -- слабое совпадение, фрагмент скорее всего не о том. На практике порог отсечения обычно 0.7-0.8.

</details>

**4. Что такое payload в Qdrant и зачем он нужен в RAG?**

<details>
<summary>Ответ</summary>

Payload -- произвольные данные, прикреплённые к вектору (текст, путь к файлу, номера строк, теги). В RAG payload позволяет LLM не только найти релевантный кусок, но и сослаться на источник: "Согласно файлу nginx-guide.md, строки 45-89..."

</details>

---

## Артефакт: docker-compose.yml

Готовый файл для запуска Qdrant с персистентным хранилищем:

```yaml
# docker-compose.yml — Qdrant для RAG Pipeline
services:
  qdrant:
    image: qdrant/qdrant:latest
    container_name: qdrant
    ports:
      - "6333:6333"   # REST API + Dashboard
      - "6334:6334"   # gRPC (для Python SDK)
    volumes:
      - qdrant-data:/qdrant/storage
    environment:
      - QDRANT__SERVICE__GRPC_PORT=6334
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:6333/healthz"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

volumes:
  qdrant-data:
```

Скрипт проверки:

```bash
#!/bin/bash
# check-qdrant.sh — проверка что Qdrant работает

set -euo pipefail

QDRANT_URL="${QDRANT_URL:-http://localhost:6333}"

echo "=== Qdrant Health Check ==="

# 1. Health
HEALTH=$(curl -sf "$QDRANT_URL/healthz" 2>/dev/null || echo "FAIL")
if echo "$HEALTH" | grep -q "passed"; then
    echo "[OK] Qdrant is healthy"
else
    echo "[FAIL] Qdrant is not responding at $QDRANT_URL"
    exit 1
fi

# 2. Collections
curl -sf "$QDRANT_URL/collections" | python3 -c "
import sys, json
data = json.load(sys.stdin)
cols = data.get('result', {}).get('collections', [])
if cols:
    for c in cols:
        print(f\"  {c['name']}\")
    print(f'Total collections: {len(cols)}')
else:
    print('[INFO] No collections yet')
"

echo "=== Done ==="
```

Запуск:

```bash
docker compose up -d
chmod +x check-qdrant.sh
./check-qdrant.sh
```

---

## Продакшен-параметры

Для справки -- параметры нашего рабочего RAG pipeline:

| Параметр | Значение | Почему |
|----------|----------|--------|
| Коллекция | `student_knowledge` | Отдельная от тестовой |
| Размерность | 384 (all-MiniLM) | Быстрый embed, достаточное качество |
| Distance | Cosine | Стандарт для текстового поиска |
| Чанкинг | 20 строк, split по def/class | Один логический блок |
| Truncate | 250 символов перед embed | all-MiniLM не обрабатывает длинный текст |
| Объём | 16,446 фрагментов текста (чанков), 16 недель | Полная база знаний курса |
| Синхронизация | systemd timer, каждые 10 мин | Git diff → re-index только изменённые |

---

## Что дальше

Это первый пост серии **RAG Pipeline**. Qdrant -- хранилище. Но чтобы pipeline заработал, нужны ещё два компонента:

- **[RAG Pipeline 2/N -- Embeddings: как текст превращается в числа](/posts/rag-02-embeddings/)** -- как превращать текст в вектора, выбор модели, batch vs single, подводные камни с русским текстом
- **RAG Pipeline 3/N -- Chunking** -- размер чанка, overlap, split по границам функций, metadata для цитирования

---

Telegram: [@DevITWay](https://t.me/DevITWay)
Сайт: [devopsway.ru](https://devopsway.ru/)
