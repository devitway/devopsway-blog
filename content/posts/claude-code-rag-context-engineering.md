---
title: "Claude Code CLI + RAG + Context Engineering: полный гайд"
date: 2026-02-05T12:00:00+03:00
lastmod: 2026-02-05T12:00:00+03:00
draft: false
weight: 1
categories: ["AI", "DevOps", "Tutorial"]
tags: ["claude-code", "rag", "ollama", "qdrant", "mcp", "context-engineering", "devops", "llm", "vector-database", "litellm"]
author: "DevOps Way"
series: ""
description: "Как настроить Claude Code CLI с локальным RAG и почему context engineering важнее prompt engineering. Полный стек: Ollama, LiteLLM, Qdrant, MCP."
canonical: ""
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
    alt: "Claude Code + RAG + Context Engineering"
    caption: "Локальный AI-ассистент с базой знаний"
    relative: false
    hidden: false
editPost:
    URL: ""
    Text: "Предложить изменения"
    appendFilePath: true

---

## TL;DR

**Prompt engineering — это 5% успеха. Context engineering — остальные 95%.**

Мы построим AI-ассистента, который:
- Знает вашу документацию (759 файлов → 16,548 чанков)
- Выполняет команды (tool calling)
- Работает локально (RTX 3090, никаких облаков)
- Отвечает за 10-15 секунд

---

## Установка Claude Code CLI

```bash
# Требования: Node.js 18+
node --version  # v18.x или выше

# Установка через npm
npm install -g @anthropic-ai/claude-code

# Или через npx (без установки)
npx @anthropic-ai/claude-code

# Проверка
claude --version
```

**Первый запуск:**

```bash
# Запуск (потребует API ключ Anthropic)
claude

# Или с указанием модели
claude --model claude-sonnet-4-20250514
```

При первом запуске Claude Code попросит ввести `ANTHROPIC_API_KEY`. Получить ключ: [console.anthropic.com](https://console.anthropic.com)

> 💡 В этом гайде мы настроим **локальную модель через LiteLLM**, чтобы не платить за API.

---

## Часть 0: Что такое Context Engineering

> *"The hottest new programming paradigm is English — but the context window is your real IDE"*
>
> *"Самая горячая новая парадигма программирования — это английский язык. Но контекстное окно — вот твоя настоящая IDE"*
>
> — Andrej Karpathy

### Prompt vs Context

```
┌─────────────────────────────────────────────────────────────────┐
│                      PROMPT ENGINEERING                          │
│                                                                  │
│  "Ты эксперт по nginx. Отвечай кратко. Используй примеры."      │
│                                                                  │
│  ❌ Модель всё равно галлюцинирует                              │
│  ❌ Не знает ВАШУ документацию                                  │
│  ❌ Не может проверить реальные файлы                           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     CONTEXT ENGINEERING                          │
│                                                                  │
│  System Prompt (поведение)                                       │
│       +                                                          │
│  RAG Results (знания из ВАШЕЙ документации)                     │
│       +                                                          │
│  Tool Results (реальные файлы, вывод команд)                    │
│       +                                                          │
│  Conversation History (контекст диалога)                        │
│       =                                                          │
│  Качественный ответ                                              │
│                                                                  │
│  ✅ Отвечает на основе реальных данных                          │
│  ✅ Ссылается на конкретные файлы и строки                      │
│  ✅ Может проверить и исправить                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Анатомия контекста в нашей системе

```
┌─────────────────────────────────────────────────────────────────┐
│                    CONTEXT WINDOW (~16K tokens)                  │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 1. SYSTEM PROMPT (~500 tokens)                          │    │
│  │                                                          │    │
│  │ "You are DevOps mentor. ALWAYS use tools first.         │    │
│  │  Use Socratic method. Speak Russian."                   │    │
│  │                                                          │    │
│  │ → Определяет ПОВЕДЕНИЕ                                  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              +                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 2. RAG RESULTS (~2000 tokens)                           │    │
│  │                                                          │    │
│  │ [search_knowledge("nginx reverse proxy")]               │    │
│  │                                                          │    │
│  │ Result 1: nginx-guide.md:45-89 (score: 0.92)           │    │
│  │ "## Reverse Proxy                                       │    │
│  │  location /api/ { proxy_pass http://backend:8000; }"   │    │
│  │                                                          │    │
│  │ Result 2: troubleshooting.md:12-34 (score: 0.85)       │    │
│  │ "### Ошибка 502 Bad Gateway..."                         │    │
│  │                                                          │    │
│  │ → Определяет ЗНАНИЯ                                     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              +                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 3. TOOL RESULTS (~1000 tokens)                          │    │
│  │                                                          │    │
│  │ [Read /etc/nginx/nginx.conf]                            │    │
│  │ "server { listen 80; location / { ... } }"             │    │
│  │                                                          │    │
│  │ [Bash: nginx -t]                                        │    │
│  │ "nginx: configuration file syntax is ok"                │    │
│  │                                                          │    │
│  │ → Определяет ФАКТЫ (ground truth)                       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              +                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 4. CONVERSATION HISTORY (~2000 tokens)                  │    │
│  │                                                          │    │
│  │ User: "nginx не запускается"                            │    │
│  │ Assistant: "Давай посмотрим конфиг..."                  │    │
│  │ User: "вот ошибка: ..."                                 │    │
│  │                                                          │    │
│  │ → Определяет КОНТЕКСТ ДИАЛОГА                           │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              =                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 5. LLM RESPONSE                                         │    │
│  │                                                          │    │
│  │ "Вижу в nginx.conf:45 пропущена точка с запятой.       │    │
│  │  Согласно нашей документации (nginx-guide.md),         │    │
│  │  каждая директива должна заканчиваться на ';'          │    │
│  │                                                          │    │
│  │  Что будет если добавить ';' в конец строки 45?"       │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### Где мы инженерим контекст

| Слой | Что делаем | Зачем |
|------|------------|-------|
| **Chunking** | `CHUNK_SIZE=800`, overlap=150 | Оптимальный размер "порции знаний" |
| **Metadata** | file_path, start_line, end_line | Модель может сослаться на источник |
| **Retrieval** | top-5 по cosine similarity | Релевантные знания, не шум |
| **Score** | Передаём score в результатах | Модель видит уверенность |
| **System Prompt** | Tools first, Socratic method | Поведение агента |
| **Tool Design** | JSON output, truncation | Предсказуемый формат |

---

## Часть 1: Архитектура

```
┌─────────────────────────────────────────────────────────────────┐
│                        Ваш терминал                             │
│                             │                                   │
│                    claude "вопрос"                              │
│                             │                                   │
│                             ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  Claude Code CLI                         │   │
│  │                         │                                │   │
│  │         ┌───────────────┼───────────────┐               │   │
│  │         ▼               ▼               ▼               │   │
│  │    LiteLLM         MCP Server       Built-in            │   │
│  │    :4000            :4002           tools               │   │
│  │      │                │              (Bash,Read,...)    │   │
│  │      ▼                ▼                                 │   │
│  │   Ollama           Qdrant                               │   │
│  │   :11434           :6333                                │   │
│  │   (LLM)            (vectors)                            │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

**Компоненты:**

| Сервис | Роль в Context Engineering |
|--------|---------------------------|
| **Ollama** | LLM с tool calling (qwen3:30b-a3b) |
| **LiteLLM** | Прокси, переводит Anthropic API → Ollama |
| **Qdrant** | Векторная БД, хранит чанки документации |
| **MCP Server** | Даёт модели инструмент `search_knowledge` |
| **Claude Code** | Оркестрирует всё, управляет контекстом |

---

## Часть 2: Установка компонентов

### 2.1 Claude Code CLI

```bash
npm install -g @anthropic-ai/claude-code
claude --version
```

### 2.2 Ollama + модель

```bash
# Установка
curl -fsSL https://ollama.ai/install.sh | sh

# MoE модель (30B параметров, 3B активных)
ollama pull qwen3:30b-a3b

# Embedding модель
ollama pull mxbai-embed-large
```

**Почему qwen3:30b-a3b:**
- MoE архитектура: качество 30B, скорость 3B
- 18GB VRAM (влезает в RTX 3090)
- Отличный tool calling
- Thinking mode работает корректно

### 2.3 Кастомная модель (System Prompt)

```bash
cat > /tmp/Modelfile << 'EOF'
FROM qwen3:30b-a3b

PARAMETER num_ctx 16384
PARAMETER temperature 0.6

SYSTEM """
You are a DevOps assistant with access to tools and a knowledge base.

CRITICAL BEHAVIOR:
1. ALWAYS use search_knowledge FIRST when user asks about concepts
2. ALWAYS use Read tool when user mentions specific files
3. ALWAYS use Bash tool to verify (nginx -t, docker ps, etc.)
4. NEVER hallucinate file contents — READ them

RESPONSE PATTERN:
1. Search/Read relevant context
2. Analyze what you found
3. Answer based on ACTUAL data
4. If documentation exists, cite it: "According to nginx-guide.md:45..."

MENTORING STYLE:
- Use Socratic method: ask guiding questions
- Don't give full solutions immediately
- If student is stuck long, give more hints

LANGUAGE: Russian for explanations, English for technical terms.
"""
EOF

ollama create devops-assistant -f /tmp/Modelfile
```

**Это Context Engineering:** system prompt определяет как модель будет использовать остальной контекст.

### 2.4 LiteLLM (прокси)

```yaml
# litellm-config.yaml
model_list:
  - model_name: devops-assistant
    litellm_params:
      model: ollama_chat/devops-assistant:latest
      api_base: http://localhost:11434

general_settings:
  master_key: sk-ant-api03-local-ollama-proxy
```

```bash
docker run -d \
  --name litellm \
  -p 4000:4000 \
  -v $(pwd)/litellm-config.yaml:/app/config.yaml \
  ghcr.io/berriai/litellm:main-latest \
  --config /app/config.yaml
```

### 2.5 Qdrant (векторная БД)

```bash
docker run -d \
  --name qdrant \
  -p 6333:6333 \
  -v qdrant_data:/qdrant/storage \
  qdrant/qdrant
```

---

## Часть 3: RAG — инженерим знания

### 3.1 Параметры чанкинга

```python
# Реальные параметры из продакшена
CHUNK_SIZE = 800       # ~20-30 строк markdown
CHUNK_OVERLAP = 150    # ~15-20% overlap
MAX_EMBED_CHARS = 8000 # Лимит embedding модели
VECTOR_SIZE = 1024     # mxbai-embed-large

# Индексируем только нужные директории
ALLOWED_DIRS = ["weeks", "bookstack", "application"]
```

**Почему эти значения:**

```
759 файлов → 16,548 чанков
≈ 21.8 чанков на файл
≈ 800 символов = 20-30 строк markdown = 1 логический блок
```

### 3.2 Формула подбора CHUNK_SIZE

```
CHUNK_SIZE = Средняя_длина_файла / Желаемое_кол-во_чанков

Наш случай:
- Средний файл: ~17,500 символов
- Хотим ~20 чанков на файл
- 17,500 / 20 ≈ 875 → округляем до 800
```

**Эмпирические правила:**

| Тип контента | CHUNK_SIZE | CHUNK_OVERLAP | Почему |
|--------------|------------|---------------|--------|
| Код | 500-800 | 100-150 | Функции короткие |
| Markdown docs | 800-1200 | 150-200 | Секции средние |
| Длинные статьи | 1500-2000 | 200-300 | Параграфы большие |

### 3.3 Metadata — ключ к цитированию

```python
def chunk_text(text, file_path):
    """Чанкуем с metadata для цитирования"""
    chunks = []
    lines = text.split("\n")
    # ...
    chunks.append({
        "content": chunk_text_str,
        "file_path": file_path,      # ← Откуда
        "start_line": start_line,    # ← Где начало
        "end_line": i - 1            # ← Где конец
    })
    return chunks
```

**Зачем metadata:**

```
БЕЗ metadata:
  "Для reverse proxy используйте proxy_pass..."
  → Откуда это? Можно верить?

С metadata:
  "Согласно nginx-guide.md:45-89, для reverse proxy..."
  → Можно проверить, можно открыть файл
```

### 3.4 Скрипт индексации

```python
#!/usr/bin/env python3
"""index_knowledge.py — Context Engineering: слой знаний"""

import httpx
import hashlib
from pathlib import Path

QDRANT_URL = "http://localhost:6333"
OLLAMA_URL = "http://localhost:11434"
EMBED_MODEL = "mxbai-embed-large"
COLLECTION = "knowledge_base"
CHUNK_SIZE = 800
CHUNK_OVERLAP = 150
MAX_EMBED_CHARS = 8000
ALLOWED_DIRS = ["weeks", "bookstack", "application"]


def get_embedding(text: str) -> list[float]:
    """Embedding с truncation"""
    if len(text) > MAX_EMBED_CHARS:
        text = text[:MAX_EMBED_CHARS]

    response = httpx.post(
        f"{OLLAMA_URL}/api/embeddings",
        json={"model": EMBED_MODEL, "prompt": text},
        timeout=60.0
    )
    return response.json()["embedding"]


def chunk_file(text: str, file_path: str) -> list[dict]:
    """Чанкинг с overlap и metadata"""
    chunks = []
    lines = text.split("\n")
    current_chunk = []
    current_size = 0
    start_line = 1

    for i, line in enumerate(lines, 1):
        line_size = len(line) + 1

        if current_size + line_size > CHUNK_SIZE and current_chunk:
            chunk_text = "\n".join(current_chunk)
            if chunk_text.strip():
                chunks.append({
                    "content": chunk_text,
                    "file_path": file_path,
                    "start_line": start_line,
                    "end_line": i - 1
                })

            # Overlap
            overlap_lines = []
            overlap_size = 0
            for ln in reversed(current_chunk):
                if overlap_size + len(ln) > CHUNK_OVERLAP:
                    break
                overlap_lines.insert(0, ln)
                overlap_size += len(ln)

            current_chunk = overlap_lines
            current_size = overlap_size
            start_line = i - len(overlap_lines)

        current_chunk.append(line)
        current_size += line_size

    # Последний чанк
    if current_chunk:
        chunk_text = "\n".join(current_chunk)
        if chunk_text.strip():
            chunks.append({
                "content": chunk_text,
                "file_path": file_path,
                "start_line": start_line,
                "end_line": len(lines)
            })

    return chunks


def is_allowed(file_path: Path, base: Path) -> bool:
    """Фильтр директорий"""
    rel = str(file_path.relative_to(base))
    return any(rel.startswith(d + "/") for d in ALLOWED_DIRS)


def create_collection():
    """Создать коллекцию с правильным размером вектора"""
    httpx.delete(f"{QDRANT_URL}/collections/{COLLECTION}")
    httpx.put(
        f"{QDRANT_URL}/collections/{COLLECTION}",
        json={"vectors": {"size": 1024, "distance": "Cosine"}}
    )


def index_all(docs_path: str):
    """Индексация с batch upload"""
    base = Path(docs_path)
    all_files = list(base.rglob("*.md"))
    md_files = [f for f in all_files if is_allowed(f, base)]

    print(f"Total: {len(all_files)}, Filtered: {len(md_files)}")

    all_chunks = []
    for f in md_files:
        text = f.read_text(encoding="utf-8", errors="ignore")
        rel_path = str(f.relative_to(base))
        all_chunks.extend(chunk_file(text, rel_path))

    print(f"Chunks: {len(all_chunks)}")

    # Batch upload
    batch = []
    for chunk in all_chunks:
        emb = get_embedding(chunk["content"])
        batch.append({
            "id": int(hashlib.md5(chunk["content"].encode()).hexdigest()[:15], 16),
            "vector": emb,
            "payload": {
                "document": chunk["content"],
                "metadata": {
                    "file_path": chunk["file_path"],
                    "start_line": chunk["start_line"],
                    "end_line": chunk["end_line"]
                }
            }
        })

        if len(batch) >= 20:
            httpx.put(
                f"{QDRANT_URL}/collections/{COLLECTION}/points",
                json={"points": batch},
                timeout=120.0
            )
            print(f"Uploaded {len(batch)} points")
            batch = []

    if batch:
        httpx.put(
            f"{QDRANT_URL}/collections/{COLLECTION}/points",
            json={"points": batch}
        )


if __name__ == "__main__":
    import sys
    create_collection()
    index_all(sys.argv[1] if len(sys.argv) > 1 else ".")
```

---

## Часть 4: MCP Server — инженерим инструменты

### 4.1 Зачем свой MCP Server

MCP (Model Context Protocol) — способ дать модели инструменты. Мы создаём `search_knowledge` — инструмент поиска по базе знаний.

**Context Engineering здесь:**
- Формат ответа (JSON с metadata)
- Truncation (не переполняем контекст)
- Score (модель видит уверенность)

### 4.2 Реализация

```python
#!/usr/bin/env python3
"""mcp_server.py — Context Engineering: слой инструментов"""

from fastmcp import FastMCP  # Сторонняя библиотека от Prefect (не Anthropic)
import httpx
import json

QDRANT_URL = "http://localhost:6333"
OLLAMA_URL = "http://localhost:11434"
EMBED_MODEL = "mxbai-embed-large"
COLLECTION = "knowledge_base"

mcp = FastMCP("Knowledge Base")


def get_embedding(text: str) -> list[float]:
    with httpx.Client(timeout=30.0) as client:
        response = client.post(
            f"{OLLAMA_URL}/api/embeddings",
            json={"model": EMBED_MODEL, "prompt": text}
        )
        return response.json()["embedding"]


@mcp.tool()
def search_knowledge(query: str, limit: int = 5) -> str:
    """
    Search the knowledge base for relevant documentation.

    Args:
        query: Natural language search query
        limit: Max results (default: 5)

    Returns:
        JSON array of matching documents with source and relevance score
    """
    embedding = get_embedding(query)

    with httpx.Client(timeout=30.0) as client:
        response = client.post(
            f"{QDRANT_URL}/collections/{COLLECTION}/points/search",
            json={
                "vector": embedding,
                "limit": limit,
                "with_payload": True
            }
        )
        results = response.json().get("result", [])

    # Context Engineering: структурированный output
    output = []
    for r in results:
        payload = r.get("payload", {})
        metadata = payload.get("metadata", {})
        output.append({
            "content": payload.get("document", "")[:2000],  # Truncate!
            "source": metadata.get("file_path", "unknown"),
            "lines": f"{metadata.get('start_line', '?')}-{metadata.get('end_line', '?')}",
            "score": round(r.get("score", 0), 3)  # Модель видит уверенность
        })

    return json.dumps(output, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    mcp.run(transport="sse", host="0.0.0.0", port=4002)
```

### 4.3 Почему важен формат output

```json
// ❌ Плохо: просто текст
"Для настройки reverse proxy используйте proxy_pass директиву..."

// ✅ Хорошо: структура + metadata + score
{
  "content": "## Reverse Proxy\n\nlocation /api/ {\n    proxy_pass http://backend:8000;\n}",
  "source": "nginx-guide.md",
  "lines": "45-89",
  "score": 0.92
}
```

**Модель теперь может:**
- Сослаться: "Согласно nginx-guide.md:45-89..."
- Оценить релевантность: score 0.92 — высокая уверенность
- Предложить открыть файл: "Посмотри строку 45"

---

## Часть 5: Собираем всё вместе

### 5.1 Docker Compose

```yaml
version: "3.9"

services:
  ollama:
    image: ollama/ollama
    deploy:
      resources:
        reservations:
          devices:
            - capabilities: [gpu]
    volumes:
      - ollama_data:/root/.ollama
    ports:
      - "11434:11434"

  qdrant:
    image: qdrant/qdrant
    volumes:
      - qdrant_data:/qdrant/storage
    ports:
      - "6333:6333"

  litellm:
    image: ghcr.io/berriai/litellm:main-latest
    command: --config /app/config.yaml
    volumes:
      - ./litellm-config.yaml:/app/config.yaml:ro
    ports:
      - "4000:4000"
    depends_on:
      - ollama

  mcp-rag:
    build: ./mcp-server
    ports:
      - "4002:4002"
    depends_on:
      - qdrant
      - ollama

volumes:
  ollama_data:
  qdrant_data:
```

> ⚠️ **Внимание: Security!**
>
> Все порты (11434, 6333, 4000, 4002) открыты **без аутентификации**.
> Это приемлемо для локальной разработки, но **НЕ для production**!
>
> Для production:
> - Qdrant: включить [API key auth](https://qdrant.tech/documentation/guides/security/)
> - LiteLLM: настроить [API keys](https://docs.litellm.ai/docs/proxy/virtual_keys)
> - Firewall: ограничить доступ к портам (iptables/ufw)
> - VPN: использовать WireGuard для доступа к сервисам

### 5.2 Подключение

```bash
# Переменные
export ANTHROPIC_API_KEY="sk-ant-api03-local-ollama-proxy"
export ANTHROPIC_BASE_URL="http://localhost:4000"

# MCP сервер
claude mcp add --transport sse knowledge-base http://localhost:4002/sse

# Запуск
claude --model devops-assistant
```

### 5.3 Проверка Context Engineering в действии

```
Вы: как настроить nginx reverse proxy?

Claude: [search_knowledge("nginx reverse proxy configuration")]

        Нашёл в базе знаний:

        1. nginx-guide.md:45-89 (score: 0.92)
           "## Reverse Proxy
            location /api/ {
                proxy_pass http://backend:8000;
            }"

        2. troubleshooting.md:12-34 (score: 0.85)
           "### Ошибка 502 Bad Gateway..."

        Вижу, что у тебя есть документация по nginx.
        Какой backend ты хочешь проксировать?
```

**Что произошло:**
1. System prompt → модель знает что нужно искать сначала
2. search_knowledge → получила релевантные чанки с metadata
3. Score 0.92 → высокая уверенность, можно доверять
4. Source nginx-guide.md:45-89 → можно проверить

---

## Часть 6: Метрики и отладка

### 6.1 Время отклика

| Этап | Время |
|------|-------|
| Embedding запроса | 50-100ms |
| Qdrant search | 10-50ms |
| LLM inference (30B MoE) | 8-15 сек |
| **Полный цикл** | **10-20 сек** |

### 6.2 Качество RAG

```bash
# Проверить количество чанков
curl -s http://localhost:6333/collections/knowledge_base | jq '.result.points_count'
# 16548

# Тест поиска
curl -X POST http://localhost:6333/collections/knowledge_base/points/search \
  -H "Content-Type: application/json" \
  -d '{"vector": [...], "limit": 3}' | jq '.result[].score'
# 0.92, 0.85, 0.78
```

### 6.3 Типичные проблемы

| Проблема | Причина | Решение |
|----------|---------|---------|
| Модель не ищет в RAG | System prompt не настаивает | Добавить "ALWAYS search first" |
| Низкие scores (<0.7) | Плохие embeddings | Проверить EMBED_MODEL |
| Ответы обрезаются | Контекст переполнен | Уменьшить limit, truncate |
| Галлюцинации | Модель не использует tools | Проверить tool calling модели |

---

## Часть 7: Context Engineering Best Practices

### 7.1 Чеклист

```
[ ] System Prompt определяет поведение (tools first, style)
[ ] RAG чанки оптимального размера (800-1200 для docs)
[ ] Metadata позволяет цитировать (file_path, lines)
[ ] Score передаётся модели (уверенность)
[ ] Tool output структурирован (JSON, не plain text)
[ ] Truncation на всех уровнях (не переполнять контекст)
[ ] Conversation history ограничена (последние N сообщений)
```

### 7.2 Антипаттерны

```
❌ "Будь умным ассистентом" — бесполезный prompt
✅ "ALWAYS use search_knowledge before answering" — конкретное поведение

❌ Чанки по 5000 символов — потеря precision
✅ Чанки по 800 символов — один логический блок

❌ Возвращать весь документ из RAG — переполнение контекста
✅ Truncate до 2000 символов + metadata для навигации

❌ Игнорировать score — модель не знает уверенность
✅ Передавать score — "score 0.92 means high confidence"
```

### 7.3 Эволюция контекста

```
v1: Просто промпт
    "Ты эксперт по nginx"
    → Галлюцинации

v2: Промпт + RAG
    System + search_knowledge
    → Отвечает по документации, но без источников

v3: Промпт + RAG + Metadata
    System + search + file_path + lines + score
    → Цитирует источники, можно проверить

v4: Полный Context Engineering
    System + RAG + Tools + History + Truncation
    → Надёжный ассистент с верифицируемыми ответами
```

---

## Альтернативы по железу

**Нет RTX 4090?** Есть варианты:

| Вариант | Модель | Скорость | Стоимость |
|---------|--------|----------|-----------|
| **Groq Free Tier** | Llama 3.1 70B | ~200 tok/s | Бесплатно (rate limits) |
| **RTX 3060 12GB** | qwen2.5:14b | ~15 tok/s | Работает |
| **RTX 3080 10GB** | qwen2.5:14b | ~25 tok/s | Работает |
| **CPU (32GB RAM)** | qwen2.5:7b | ~3-5 tok/s | Медленно, но работает |

**Groq — бесплатная альтернатива:**

```yaml
# litellm_config.yaml
model_list:
  - model_name: devops-assistant
    litellm_params:
      model: groq/llama-3.1-70b-versatile
      api_key: os.environ/GROQ_API_KEY
```

Получить ключ: [console.groq.com](https://console.groq.com)

**Меньшие модели для слабого железа:**

```bash
# 7B модель — работает на любом железе с 8GB RAM
ollama pull qwen2.5:7b

# 14B модель — для 12-16GB VRAM
ollama pull qwen2.5:14b-instruct
```

Качество будет ниже чем у 30B, но для многих задач достаточно.

---

## Итого

**Context Engineering > Prompt Engineering**

| Аспект | Prompt Engineering | Context Engineering |
|--------|-------------------|---------------------|
| Фокус | Формулировка запроса | Весь контекст |
| Инструменты | Текст | RAG, Tools, Metadata |
| Верифицируемость | Нет | Да (источники, scores) |
| Галлюцинации | Частые | Редкие |
| Масштабируемость | Нет | Да (добавляй документы) |

**Наш стек:**

```
┌─────────────────────────────────────────────────────────────────┐
│  Context Engineering Stack                                       │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │  Ollama  │  │ LiteLLM  │  │  Qdrant  │  │   MCP    │        │
│  │  :11434  │◄─┤  :4000   │  │  :6333   │◄─┤  :4002   │        │
│  │          │  │          │  │          │  │          │        │
│  │ qwen3:   │  │ API      │  │ 16,548   │  │ search_  │        │
│  │ 30b-a3b  │  │ proxy    │  │ chunks   │  │ knowledge│        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
│                                                                  │
│  Context = System + RAG + Tools + History                       │
│  Response = f(Context) — не f(Prompt)                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Ссылки

- [Andrej Karpathy on Context Engineering](https://twitter.com/karpathy)
- [Anthropic: Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)
- [Claude Code Documentation](https://docs.anthropic.com/claude-code)
- [MCP Protocol Specification](https://modelcontextprotocol.io)
- [FastMCP Framework](https://gofastmcp.com)
- [Qdrant Vector Database](https://qdrant.tech)

---

*DevOps Way — Context Engineering на практике*
