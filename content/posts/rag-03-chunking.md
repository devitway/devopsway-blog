---
title: "RAG Pipeline 3/N: Чанки – как резать текст, чтобы модель не получала мусор"
date: 2026-05-20T12:00:00+03:00
lastmod: 2026-05-20T12:00:00+03:00
draft: false
weight: 3
categories: ["AI и MLOps"]
tags: ["rag", "chunking", "nlp", "ai", "devops", "python"]
author: "DevOps Way"
series: "RAG Pipeline"
description: "Почему 800 символов, а не 1500. Семантическая нарезка по заголовкам, overlap, санитизация, метаданные. Реальный код и продакшен-параметры из pipeline на 3 010 фрагментов."
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
    alt: "Чанки – как резать текст для RAG"
    caption: "RAG Pipeline: от файла к фрагментам"
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
| Артефакт | Скрипт нарезки markdown + stats |
| Проверка | 180+ файлов → 3 010 чанков, 0 ошибок Ollama |

---

## TL;DR

Нарезка текста на фрагменты (chunking) – этап, который влияет на качество RAG не меньше, чем выбор модели. Режем по заголовкам H2/H3, дорезаем с перекрытием 150 символов, чистим мусор. 800 символов – потолок для русского текста при 512-токенном лимите модели.

---

## Проблема: модель видит не файл, а огрызок

В [прошлом посте](/posts/rag-02-embeddings/) мы выбрали модель эмбеддинга (mxbai-embed-large) и научились превращать текст в вектора. Но модель не индексирует файл целиком – она получает фрагменты. И если фрагмент обрезан посередине мысли, вектор будет описывать бессмыслицу.

```
ПЛОХАЯ НАРЕЗКА (по 1500 символов):

Файл nginx-guide.md:
┌──────────────────────────────────────────────────────────┐
│  ## Reverse Proxy                                         │
│  Для настройки reverse proxy используйте proxy_pass.      │
│  Основные параметры:                                      │
│  - proxy_set_header Host $host;                           │
│  - proxy_set_header X-Real-IP $remote_addr;               │
│  ...                                                      │
│  ## SSL/TLS                                               │  ← граница чанка
│  Для включения HTTPS добавьте в секцию server: ──────────►│    прошла посередине
│  ssl_certificate /etc/nginx/ssl/cert.pem;                 │    новой темы
│  ssl_certificate_key /etc/nginx/ssl/key.pem;              │
└──────────────────────────────────────────────────────────┘
Чанк 1: Reverse Proxy + начало SSL → вектор описывает "что-то про nginx"
Чанк 2: Остаток SSL без контекста → "cert.pem и key.pem" без объяснения зачем

ХОРОШАЯ НАРЕЗКА (по H2/H3):

Чанк 1: [## Reverse Proxy] — полная секция про proxy_pass
Чанк 2: [## SSL/TLS] — полная секция про сертификаты
```

Первая версия моего pipeline резала по 1500 символов. Ollama падала с HTTP 500. Binary search показал: worst-case русский markdown с ссылками укладывает 512 токенов модели в 912 символов. 1500 символов – это ~840 токенов, на 60% больше лимита. Уменьшил до 800 – ошибки ушли.

Но размер – полдела. Фрагмент `"…настройка Cad"` без продолжения `"dy reverse proxy"` бесполезен. Нужна стратегия нарезки.

---

## Стратегия: два уровня нарезки

### Уровень 1. Семантическая нарезка по заголовкам

Markdown-файлы уже содержат структуру – заголовки H2 (`##`) и H3 (`###`). Каждый заголовок начинает логически завершённую мысль. Режем по ним:

```python
def chunk_by_sections(content: str, file_path: str) -> list[dict]:
    """Режем markdown по H2/H3 заголовкам."""
    chunks = []
    lines = content.split('\n')
    current_section = file_path  # имя файла как fallback
    current_lines = []

    for line in lines:
        heading_match = re.match(r'^(#{2,3})\s+(.+)', line)
        if heading_match and current_lines:
            # Предыдущая секция завершена -- сохраняем
            text = '\n'.join(current_lines).strip()
            if text and len(text) >= 20:
                chunks.extend(_split_large_chunk(text, current_section))
            current_lines = [line]
            current_section = heading_match.group(2).strip()
        else:
            current_lines.append(line)

    # Последняя секция
    if current_lines:
        text = '\n'.join(current_lines).strip()
        if text and len(text) >= 20:
            chunks.extend(_split_large_chunk(text, current_section))

    return chunks
```

Почему H2/H3, а не H1? В markdown-файлах H1 (`#`) обычно один – заголовок документа. Смысловые блоки начинаются с H2 и H3. H4 и глубже слишком мелкие – нарезка по ним даст фрагменты в 2-3 строки.

### Уровень 2. Дорезка с перекрытием (overlap)

Если секция длиннее 800 символов – дорезаем на куски с перекрытием:

```python
CHUNK_SIZE = 800   # символов
CHUNK_OVERLAP = 150  # символов

def _split_large_chunk(text: str, section: str) -> list[dict]:
    """Дорезка больших секций с overlap."""
    if len(text) <= CHUNK_SIZE:
        return [{'text': text, 'section': section}]

    pieces = []
    start = 0
    idx = 0
    while start < len(text):
        end = start + CHUNK_SIZE
        piece = text[start:end]
        pieces.append({
            'text': piece.strip(),
            'section': f"{section} (part {idx + 1})"
        })
        start = end - CHUNK_OVERLAP  # сдвиг с перекрытием
        idx += 1
    return pieces
```

**Зачем overlap?** Без него контекст на стыке теряется. Предложение, начатое в конце чанка 1, продолжается в начале чанка 2 – но каждый чанк индексируется отдельно. Перекрытие 150 символов дублирует границу в обоих фрагментах.

```
Без overlap:
  Чанк 1: [───────────────────]
  Чанк 2:                      [───────────────────]
  Потеря:                      ↑ контекст разорван

С overlap 150:
  Чанк 1: [───────────────────]
  Чанк 2:              [───────────────────]
  Перекрытие:          ^^^^^^^^ 150 символов дублируются
```

800/150 – соотношение, к которому я пришёл после трёх итераций. Overlap меньше 100 – контекст всё ещё рвётся. Больше 200 – слишком много дублирования, Qdrant раздувается.

---

## Почему 800 символов

Это не магическое число. Это результат binary search на реальных данных.

**Ограничение модели:** mxbai-embed-large принимает максимум 512 токенов. При превышении Ollama возвращает HTTP 500 с `"context length exceeded"`.

**Русский текст дороже английского.** Как мы показали в [посте 2/N](/posts/rag-02-embeddings/), одно русское слово в связном тексте занимает ~5 токенов (кириллица дробится на byte-level фрагменты BPE-токенизатором). Английское – ~1-2 токена. 512 токенов вмещают ~700-760 символов русского текста vs ~2100-2500 английского (~3x разница). При этом URL и markdown-разметка тоже не сжимаются. Worst-case: 912 символов русского markdown с ссылками = 512 токенов. Значит 800 символов – это ~530 токенов, на грани лимита.

**Binary search:**

| Размер чанка | Токены (worst-case) | Результат |
|---|---|---|
| 1500 chars | ~840 tokens | HTTP 500, Ollama падает |
| 1200 chars | ~670 tokens | HTTP 500 на длинных ссылках |
| 912 chars | ~512 tokens | Граница: проходит впритык |
| 800 chars | ~530 tokens | Стабильно, близко к лимиту |

"Worst-case русский markdown с ссылками" – это текст с URL, markdown-форматированием и русским текстом одновременно. URL не сжимаются токенизатором (каждый символ = токен), поэтому worst-case хуже, чем чистый текст.

**800 – компромисс:** достаточно длинный, чтобы секция несла смысл. Достаточно короткий, чтобы не превысить лимит модели.

---

## Санитизация: чистим мусор до embedding

В [посте 2/N](/posts/rag-02-embeddings/) мы показали базовую `sanitize_for_embedding()`. Вот расширенная версия для chunking-pipeline с дополнительными фильтрами. Грязный текст = шумный вектор. Шумный вектор "притягивает" нерелевантные результаты при поиске.

```python
CHUNK_SIZE = 800

def sanitize_for_embedding(text: str) -> str:
    """Чистим текст перед отправкой в модель."""
    if not text:
        return ""

    # 1. Unicode replacement characters (\ufffd)
    #    Появляются при чтении файлов с errors='replace'
    #    Невидимы глазу, но ломают Ollama
    text = text.replace('\ufffd', '')

    # 2. Управляющие символы (C0/C1)
    text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]', '', text)

    # 3. Перекодировка: убираем невалидный UTF-8
    text = text.encode('utf-8', errors='ignore').decode('utf-8', errors='ignore')

    # 4. Длинные строки без пробелов (base64, хеши, URL)
    #    Обрезаем до 200 символов -- дальше бесполезно для поиска
    text = re.sub(r'\S{200,}', lambda m: m.group(0)[:200] + '...', text)

    # 5. Множественные пробелы и пустые строки
    text = re.sub(r'[ \t]{10,}', '  ', text)
    text = re.sub(r'\n{5,}', '\n\n\n', text)

    # 6. Обрезаем до CHUNK_SIZE
    text = text[:CHUNK_SIZE].strip()

    # 7. Quality gate: слишком короткий = мусор
    if len(text) < 20:
        return ""

    return text
```

### Что именно чистим и почему

| Мусор | Пример | Проблема |
|---|---|---|
| `\ufffd` | Повреждённый файл с `errors='replace'` | Невидим, но Ollama возвращает 500 |
| Control chars | `\x00`-`\x1f` | Ломают HTTP-запрос к Ollama |
| Длинные строки | base64-блобы, SHA-хеши | Занимают токены без смысла |
| Пустые строки | 10+ `\n` подряд | Раздувают чанк, вытесняя контент |

**Quality gate (< 20 символов):** фрагмент "## Заголовок" без тела – это 12 символов. Он не несёт достаточно смысла для embedding. Отбрасываем.

---

## Метаданные: зачем чанку знать, откуда он

Каждый фрагмент в Qdrant хранит не только вектор, но и payload:

```python
payload = {
    'file_path': 'nora-sprint-status.md',     # откуда
    'section': 'v0.9.0 RELEASED (18.05.2026)', # какая секция
    'zone': 'warm',                             # hot/warm/cold
    'project': 'nora',                          # какой проект
    'mtime': 1747584000.0,                      # когда изменён
    'content_hash': 'a1b2c3d4...',              # md5 для change detection
    'text_preview': 'ARM64 binary + multi...',  # первые 500 символов
}
```

### Три зоны памяти

```
hot   = MEMORY.md         — главный файл, ядро контекста
warm  = memory/*.md       — активные файлы проектов
cold  = memory/_archive/  — завершённые проекты
```

Зоны позволяют фильтровать поиск. Запрос "текущий статус NORA" ищет в hot + warm. Запрос "как мы решали баг X в марте" – в cold. Без зон модель возвращает устаревший контекст наравне с актуальным.

### Проект из имени файла

```python
PROJECT_PATTERNS = {
    'nora': r'^nora[-_]',
    'pusk': r'^pusk[-_]',
    'kmb': r'^(kmb[-_]|curriculum[-_]|kokon)',
    'jarvis': r'^(jarvis|JARVIS)',
    'infra': r'^(infrastructure|bastion|pve|vault)',
    # ...
}
```

Файл `nora-sprint-status.md` автоматически получает `project: 'nora'`. Это позволяет искать "circuit breaker" только в контексте NORA, а не во всех 180 файлах.

### Change detection

```python
content_hash = hashlib.md5(text.encode()).hexdigest()
if content_hash in existing_hashes:
    skipped_chunks += 1  # не переиндексируем
    continue
```

md5 от текста чанка – если текст не изменился, пропускаем. Инкрементальная переиндексация: systemd timer запускается каждые 10 минут, но переиндексирует только изменённые файлы. Полный проход по 180 файлам занимает секунды.

---

## Progressive truncation: fallback при переполнении

В [посте 2/N](/posts/rag-02-embeddings/) мы показали базовый `safe_embed()` с цепочкой 800→600→400. Здесь полная версия с retry и обработкой ошибок. Даже с лимитом 800 символов модель иногда не справляется – markdown со ссылками и таблицами может генерировать больше токенов, чем ожидалось:

```python
def get_embedding(text: str, retries: int = 2):
    """Embedding с progressive truncation."""
    text = sanitize_for_embedding(text)
    if len(text) < 10:
        return None

    # Пробуем полный текст, потом короче
    for text_len in [len(text), 600, 400]:
        prompt = text[:text_len]
        if len(prompt) < 20:
            return None
        for attempt in range(retries + 1):
            try:
                resp = requests.post(f"http://{OLLAMA_HOST}:{OLLAMA_PORT}/api/embed", json={
                    "model": "mxbai-embed-large",
                    "input": prompt
                }, timeout=75)
                if resp.status_code == 200:
                    return resp.json().get('embeddings', [None])[0]
                elif resp.status_code == 500 and "context length" in resp.text:
                    break  # обрезаем и пробуем короче
            except Exception:
                if attempt < retries:
                    time.sleep(2 ** attempt)
        else:
            return None
    return None
```

Цепочка: 800 → 600 → 400 символов. На каждом уровне – retry с экспоненциальным backoff. В продакшене progressive truncation срабатывает на единицах чанков из тысяч. Обычно это таблицы с длинными URL.

---

## Мини-тест

**1. Файл 2000 символов, CHUNK_SIZE=800, CHUNK_OVERLAP=150. Сколько чанков получится?**

<details>
<summary>Ответ</summary>

Четыре чанка. Шаг сдвига = CHUNK_SIZE - CHUNK_OVERLAP = 650:
- Чанк 1: символы 0–800 (800 символов)
- Чанк 2: символы 650–1450 (800 символов)
- Чанк 3: символы 1300–2000 (700 символов)
- Чанк 4: символы 1950–2000 (50 символов – хвост overlap)

Почему не 3? Код вычисляет следующий `start = end - CHUNK_OVERLAP`, где `end = start + CHUNK_SIZE` – даже если `end > len(text)`. После чанка 3 `start = 2100 - 150 = 1950`, что меньше 2000, поэтому цикл делает ещё один проход. Это нюанс реализации: последний фрагмент может быть очень коротким.

</details>

**2. Фрагмент после санитизации: `"## Заголовок"` (12 символов). Что с ним произойдёт?**

<details>
<summary>Ответ</summary>

Будет отброшен. Quality gate отсекает фрагменты короче 20 символов – они не несут достаточно смысла для embedding. Заголовок без тела бесполезен для поиска.

</details>

**3. Overlap = 0 (без перекрытия). Какой баг это вызовет?**

<details>
<summary>Ответ</summary>

Предложения на границе чанков будут разорваны. Фрагмент `"...настройка Cad"` потеряет продолжение `"dy reverse proxy"`. Вектор будет описывать бессмыслицу, и поиск по запросу "Caddy reverse proxy" не найдёт этот фрагмент. Overlap дублирует границу в обоих чанках, сохраняя контекст.

</details>

**4. В Qdrant 3 010 чанков. Файл изменился (1 строка). Сколько чанков переиндексируется?**

<details>
<summary>Ответ</summary>

Только чанки из изменённого файла, в которых content_hash (md5) изменился. Если строка добавлена в одну H2-секцию – переиндексируется 1-3 чанка (секция + возможные соседние при дорезке). Остальные 3 000+ чанков пропускаются за миллисекунды (hash lookup).

</details>

---

## Артефакт: скрипт нарезки markdown

Полный скрипт, который можно запустить на своих файлах. Отличие от продакшен-кода выше: `sanitize()` здесь не обрезает текст до CHUNK_SIZE – этим занимается `split_large()`, потому что sanitize вызывается **до** нарезки, а не после (как `sanitize_for_embedding` в продакшене).

```python
#!/usr/bin/env python3
"""
chunk-markdown.py -- нарезка markdown-файлов для RAG pipeline.
Режет по H2/H3, дорезает с overlap, чистит мусор.

Запуск:
  python3 chunk-markdown.py /path/to/docs/
  python3 chunk-markdown.py /path/to/docs/ --stats
"""
import argparse
import re
import sys
from pathlib import Path

CHUNK_SIZE = 800
CHUNK_OVERLAP = 150
MIN_CHUNK_LEN = 20


def sanitize(text: str) -> str:
    """Чистим текст от мусора. Не обрезает по CHUNK_SIZE — этим занимается split_large."""
    if not text:
        return ""
    text = text.replace('\ufffd', '')
    text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]', '', text)
    text = text.encode('utf-8', errors='ignore').decode('utf-8', errors='ignore')
    text = re.sub(r'\S{200,}', lambda m: m.group(0)[:200] + '...', text)
    text = re.sub(r'[ \t]{10,}', '  ', text)
    text = re.sub(r'\n{5,}', '\n\n\n', text)
    text = text.strip()
    if len(text) < MIN_CHUNK_LEN:
        return ""
    return text


def split_large(text: str, section: str) -> list[dict]:
    """Дорезка больших секций с overlap."""
    if len(text) <= CHUNK_SIZE:
        return [{'text': text, 'section': section, 'chars': len(text)}]
    pieces = []
    start = 0
    idx = 0
    while start < len(text):
        end = start + CHUNK_SIZE
        piece = text[start:end].strip()
        if piece:
            pieces.append({
                'text': piece,
                'section': f"{section} (part {idx + 1})",
                'chars': len(piece),
            })
        start = end - CHUNK_OVERLAP
        idx += 1
    return pieces


def chunk_file(filepath: Path) -> list[dict]:
    """Нарезка одного markdown-файла."""
    content = filepath.read_text(encoding='utf-8', errors='replace')
    chunks = []
    lines = content.split('\n')
    current_section = filepath.name
    current_lines = []

    for line in lines:
        heading = re.match(r'^(#{2,3})\s+(.+)', line)
        if heading and current_lines:
            text = sanitize('\n'.join(current_lines))
            if text:
                chunks.extend(split_large(text, current_section))
            current_lines = [line]
            current_section = heading.group(2).strip()
        else:
            current_lines.append(line)

    if current_lines:
        text = sanitize('\n'.join(current_lines))
        if text:
            chunks.extend(split_large(text, current_section))

    return chunks


def main():
    parser = argparse.ArgumentParser(description="Chunk markdown files for RAG")
    parser.add_argument("path", help="Directory with .md files")
    parser.add_argument("--stats", action="store_true", help="Show stats only")
    args = parser.parse_args()

    path = Path(args.path)
    if not path.is_dir():
        print(f"Not a directory: {path}", file=sys.stderr)
        sys.exit(1)

    total_files = 0
    total_chunks = 0
    total_chars = 0

    for md in sorted(path.rglob('*.md')):
        chunks = chunk_file(md)
        total_files += 1
        total_chunks += len(chunks)

        if args.stats:
            total_chars += sum(c['chars'] for c in chunks)
            continue

        for i, chunk in enumerate(chunks):
            print(f"--- {md.name} | {chunk['section']} | {chunk['chars']} chars ---")
            print(chunk['text'][:200])
            if chunk['chars'] > 200:
                print(f"  ... ({chunk['chars'] - 200} more chars)")
            print()

    if args.stats:
        avg = total_chars / total_chunks if total_chunks else 0
        print(f"Files:  {total_files}")
        print(f"Chunks: {total_chunks}")
        print(f"Avg:    {avg:.0f} chars/chunk")
        print(f"Total:  {total_chars:,} chars")


if __name__ == "__main__":
    main()
```

Запуск:

```bash
# Посмотреть нарезку
python3 chunk-markdown.py ~/docs/

# Только статистика
python3 chunk-markdown.py ~/docs/ --stats
# Files:  <N>
# Chunks: <N>
# Avg:    <N> chars/chunk
# Total:  <N> chars
```

---

## Продакшен-параметры

В [посте 2/N](/posts/rag-02-embeddings/) мы показывали общий объём pipeline: 206K+ векторов (документация + рабочие сессии). Здесь фокус на markdown-файлах базы знаний – это подмножество, для которого chunking критичен. Параметры (3 010 чанков из 180+ файлов):

| Параметр | Значение | Почему |
|----------|----------|--------|
| Модель | mxbai-embed-large | Лучшее качество на русском из Ollama ([пост 2/N](/posts/rag-02-embeddings/)) |
| Размерность | 1024 | Определяется моделью |
| CHUNK_SIZE | 800 chars | Binary search: 912 = worst-case лимит для 512 tokens, 800 = запас |
| CHUNK_OVERLAP | 150 chars | Контекст на границах, overlap < 200 не раздувает базу |
| Семантическая нарезка | H2/H3 headings | Логические блоки, не произвольные |
| Санитизация | \ufffd, control chars, long strings | Чистые вектора = чистый поиск |
| Quality gate | min 20 chars | Слишком короткие → шум |
| Progressive truncation | 800→600→400 | Fallback при "context length exceeded" |
| Change detection | md5(content) | Инкрементальная переиндексация |
| Sync | systemd timer, каждые 10 мин | Re-index только изменённые |
| Payload | file, section, zone, project, mtime, hash | Фильтрация + change detection |
| Объём | 180+ файлов → 3 010 чанков | Markdown база знаний |

### Эволюция параметров

| Версия | CHUNK_SIZE | Модель | Объём | Проблема |
|---|---|---|---|---|
| v1 (до мая 2026) | 1500 | mxbai-embed-large | 2 028 | HTTP 500, ~140 failures/run |
| v2 (май 2026) | 800 | mxbai-embed-large | 3 010 | 0 failures |

Разница: 1500→800 chars, добавлена sanitize + progressive truncation. Больше чанков (меньше размер = больше фрагментов), но ноль ошибок.

---

## Что дальше

Текст нарезан, вектора созданы, метаданные на месте. Но поиск по одним только векторам не всегда находит то, что нужно – косинусная близость теряет точные совпадения терминов:

- **RAG Pipeline 4/N – Гибридный поиск** – BM25 (текстовый) + dense vectors (семантический), почему оба нужны одновременно, Qdrant sparse vectors, ранжирование

---

Telegram: [@DevITWay](https://t.me/DevITWay)
Сайт: [devopsway.ru](https://devopsway.ru/)
