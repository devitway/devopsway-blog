---
title: "RAG Pipeline 5/N: Cross-encoder reranking – когда порядок важнее полноты"
date: 2026-06-02T12:00:00+03:00
lastmod: 2026-06-02T12:00:00+03:00
draft: false
weight: 5
categories: ["AI и MLOps"]
tags: ["rag", "reranking", "cross-encoder", "retrieval", "bge-reranker", "ai", "devops", "python"]
author: "DevOps Way"
series: "RAG Pipeline"
description: "RRF голосует за порядок результатов, но ни один из голосующих не читал документ вместе с запросом. Cross-encoder читает пару целиком – как человек. 67% top-1 результатов стали другими. Реальный код, бенчмарк, архитектура каскада."
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
    alt: "Cross-encoder reranking – каскад дешёвый фильтр + дорогой scorer"
    caption: "RAG Pipeline: cross-encoder переставляет top-K после поиска"
    relative: false
    hidden: false
editPost:
    URL: "https://github.com/devitway/devopsway-blog/tree/main/content"
    Text: "Предложить изменения"
    appendFilePath: true
---

В предыдущих сериях: [Qdrant (1/N)](/posts/rag-01-qdrant-vectors/), [эмбеддинги (2/N)](/posts/rag-02-embeddings/), [нарезка на чанки (3/N)](/posts/rag-03-chunking/), [гибридный поиск (4/N)](/posts/rag-04-hybrid-search/). Нужный чанк стабильно залетает в top-15. Но порядок внутри этих 15 результатов определяет, какой чанк окажется в top-1. А top-1 – это то, что видит пользователь (или LLM при генерации ответа).

Этот пост о том, как заставить систему вчитываться в результаты. Переранжирование: дешёвый двухступенчатый каскад, который не меняет recall, но переставляет результаты так, чтобы лучший оказывался первым.

## Проблема: RRF не читает документы

Гибридный поиск ([пост 4/N](/posts/rag-04-hybrid-search/)) работает так:

1. Dense search (векторный поиск; mxbai-embed-large, 1024d) – находит семантически похожие чанки
2. BM25 – караулит точные совпадения
3. RRF (Reciprocal Rank Fusion) – сливает два списка по рангам

RRF формула: `score = 0.7 / (60 + rank_dense) + 0.3 / (60 + rank_sparse)`

Это голосование. BM25 ставит чанк вторым, dense – пятым, итоговый балл – среднее. Ни один из "голосующих" не читал документ вместе с запросом. Они кодировали запрос и документы **независимо** и сравнивали вектора.

Конкретный пример. Запрос: "XSS vulnerability in NORA UI". В top-15 после RRF:

- Позиция 1: случайный файл с json-содержимым (score 0.011)
- Позиция 4: описание pipeline fix/521-ui-xss-install-cmd (score 0.010)

Scores различаются на 0.001 – шум. RRF поставил json-файл первым, потому что dense search дал ему чуть более высокий ранг. Но для человека очевидно, что "pipeline fix/521-ui-xss" – правильный ответ на "XSS vulnerability in NORA UI".

## Bi-encoder vs Cross-encoder

### Bi-encoder (то, что уже есть)

```
Query  → [Encoder] → vec_q ─┐
                              ├─ cosine(vec_q, vec_d) → score
Doc    → [Encoder] → vec_d ─┘
```

Запрос и документ кодируются **отдельно**. Можно предвычислить все doc-векторы и искать по индексу за O(log N). Быстро: embedding + поиск по индексу ~70ms на сотнях тысяч чанков.

Проблема: encoder не видит запрос, когда кодирует документ. Он не может понять, что "3 real failures: circuit breaker got 000000" релевантно запросу "circuit breaker bug" **больше**, чем "Found a bug in NORA. Let me look at the code."

### Cross-encoder

```
(Query, Doc) → [Encoder] → score
```

Запрос и документ подаются в трансформер **как единый текст**. Модель видит оба одновременно, может сопоставить слова, понять контекст, выявить парафраз.

Проблема: нельзя предвычислить. Для каждой пары (query, doc) – отдельный forward pass. На корпусе в сотни тысяч чанков это нереально. Но для 30 кандидатов из top-K – 30 forward passes – терпимо.

### Каскад

Архитектурный паттерн: дешёвый фильтр → дорогой scorer.

```
360K чанков  → [Bi-encoder: ~70ms]  → top-30
top-30       → [Cross-encoder: ~3s] → top-10 (переставленные)
```

Тот же принцип, что:
- Bloom filter → disk lookup в базах данных
- L1/L2/L3 кэш в CPU
- DNS cache → recursive resolver
- Compilation: lexer (быстрый, грубый) → parser (медленный, точный)

Дешёвый слой отсеивает 99.99%, дорогой – уточняет оставшийся 0.01%.

## Реализация

### Модель: BAAI/bge-reranker-v2-m3

Выбор модели:

| Модель | Параметры | Языки | Latency (15 pairs, CPU) |
|--------|-----------|-------|-------------------------|
| ms-marco-MiniLM-L-6 | 22M | EN | ~200ms |
| bge-reranker-base | 278M | EN+ZH | ~1.5s |
| **bge-reranker-v2-m3** | **568M** | **100+ (вкл. RU)** | **~3.3s** |
| bge-reranker-v2-gemma | 2B | 100+ | ~15s |

Критерий: мультиязычность (данные на русском + английском). `bge-reranker-v2-m3` – наименьшая модель с полноценной поддержкой русского, которая не падает от кириллицы.

### Код

```python
# reranker.py — 150 строк, ключевая часть:

from sentence_transformers import CrossEncoder

# Lazy load: модель грузится при первом вызове, не при старте сервера
_cross_encoder = None

def rerank(query, candidates, text_key="text", top_k=None):
    model = _load_model()  # ~8s первый раз, потом из памяти
    if model is None:
        return candidates  # fallback: вернуть как есть

    # Truncate для скорости на CPU
    max_chars = 256
    pairs = [(query, c[text_key][:max_chars]) for c in candidates]

    scores = model.predict(pairs)

    # Присвоить rerank_score, отсортировать
    for c, score in zip(candidates, scores):
        c["rerank_score"] = float(score)
    return sorted(candidates, key=lambda x: x["rerank_score"], reverse=True)[:top_k]
```

### Интеграция в pipeline

Три точки вызова:

```python
# search_sessions: dense search → rerank
fetch_limit = limit * 3  # 15 вместо 5
results = qdrant.query_points(..., limit=fetch_limit)
formatted = [format(r) for r in results]
formatted = rerank(query, formatted, text_key="text_preview", top_k=limit)

# search_memory: dense search → rerank (аналогично)

# hybrid_search: dense + BM25 + RRF → rerank
# RRF выдаёт limit*3 кандидатов, cross-encoder сужает до limit
```

Паттерн один: overfetch × 3, rerank, trim.

### Конфигурация

```bash
RERANKER_ENABLED=true          # kill switch
RERANKER_MODEL=BAAI/bge-reranker-v2-m3
RERANKER_MAX_LENGTH=512        # max tokens per pair
RERANKER_MAX_DOC_CHARS=256     # truncate text before tokenization
```

`RERANKER_ENABLED=false` – мгновенный откат к поведению v4. Без перезапуска сервера модель просто не вызывается.

## Бенчмарк: A/B сравнение

30 вопросов из трёх категорий (IE, MR, KU) – те же вопросы, что в бенчмарке v4.

Методика: один и тот же запрос к `search_sessions`, с reranker и без. Сравниваю top-1 результат.

### Количественные результаты

```
                        Без reranker    С reranker
Avg latency/query       91 ms           3,879 ms
Top-1 изменился         —               20/30 (67%)
```

67% запросов получили другой top-1 результат. Две трети.

### Качественные примеры

**Q3: "Какая XSS уязвимость была найдена в UI NORA?"**

| | Без reranker | С reranker |
|---|---|---|
| Top-1 | `[{"id": 1, "cat": "IE", "q":...` (JSON файл) | `═══ NORA PIPELINE: fix/521-ui-xss-install-cmd ═══` |
| Rerank score | — | 0.680 |

Без reranker – случайный JSON. С reranker – правильный pipeline fix.

**Q6: "Какой баг нашли в circuit breaker NORA?"**

| | Без reranker | С reranker |
|---|---|---|
| Top-1 | "Нашёл баг в NORA. Посмотрю код подробнее." | "3 настоящих фейла: circuit breaker: got 000000" |
| Rerank score | — | 0.975 |

Без reranker – размытое упоминание. С reranker – конкретные детали бага.

**Q (search_memory): "nora storage backend"**

| | Без reranker | С reranker |
|---|---|---|
| Top-1 | score 0.748, "## Block 8: S3 Storage Backend" | rerank 0.991, тот же чанк |
| Top-2 | score 0.704, "### Storage (local)" | rerank 0.563, тот же |

Здесь dense search уже угадал правильный порядок – cross-encoder подтвердил и усилил разрыв (0.991 vs 0.563 вместо 0.748 vs 0.704).

### Латентность

```
15 кандидатов × 256 chars:  медиана 3,296 ms
15 кандидатов × 500 chars:  медиана 5,700 ms
10 кандидатов × 256 chars:  медиана 2,200 ms
```

Всё на CPU (AMD EPYC, 4 cores). На GPU было бы ~100ms. Но GPU занят Ollama (embedding + inference), а выделять второй GPU под reranker – overkill для 30 запросов в день.

Компромисс: truncate до 256 символов. Первые 256 символов чанка содержат достаточно информации для оценки релевантности. Потеря качества минимальна – для cross-encoder важнее увидеть ключевые слова запроса в документе, чем прочитать весь документ.

## Почему cross-encoder работает лучше

### Пример: "circuit breaker bug"

**Кандидат A**: "Нашёл баг в NORA. Посмотрю код подробнее и попробую решить."

Bi-encoder: "баг" + "NORA" → высокий cosine similarity с "circuit breaker bug in NORA". Но "circuit breaker" не упоминается.

**Кандидат B**: "3 настоящих фейла: 1. Circuit breaker: got 000000 – curl вернул 000, значит..."

Cross-encoder: видит "circuit breaker" в запросе И в документе. Видит "bug" в запросе и "фейла" в документе (парафраз). Score: 0.975.

Bi-encoder не может сделать этого – он кодирует документ не зная запроса. Cross-encoder читает пару целиком.

### Когда cross-encoder не помогает

1. **Нужного чанка нет в top-K** – reranker не добавляет результаты, только переставляет. Если recall@15 = 0, никакой reranker не поможет.

2. **Все кандидаты одинаково релевантны** – "nora storage backend" уже на первом месте, cross-encoder просто подтверждает.

3. **Запрос слишком общий** – "что делали на прошлой неделе" – все чанки одинаково (не)релевантны.

## Latency budget

Полный путь запроса через pipeline:

```
Embedding (Ollama, mxbai)       ~50ms
Qdrant dense search             ~20ms
BM25 sparse search              ~5ms
RRF fusion                      ~1ms
────────────────────────────────────────
Subtotal (v4)                   ~91ms

Cross-encoder rerank (15 × 256ch)  ~3,300ms
────────────────────────────────────────
Total (v5)                      ~3,400ms
```

3.4 секунды на поисковый запрос. Для интерактивного MCP-инструмента (CLI) – приемлемо. Для real-time autocomplete – нет. Для batch processing (индексация, QA runs) – irrelevant.

### Оптимизации (не реализованы)

1. **GPU inference** – ~100ms вместо ~3300ms. Требует выделенного GPU или time-sharing с Ollama.
2. **Quantization** – INT8 bge-reranker-v2-m3 может дать 2x speedup на CPU.
3. **Adaptive reranking** – не вызывать reranker, если top-1 dense score > порога (высокая confidence).
4. **Distilled model** – ms-marco-MiniLM (22M параметров) за ~200ms, но без русского.

Пока 3.3 секунды терпимо – не оптимизирую. Premature optimization – root of all evil.

## Архитектурная ретроспектива

RAG pipeline после 5 постов:

```
Данные
  ↓
Chunking (session-level, 7 turns, overlap 3)     [пост 3/N]
  ↓
Indexing
  ├── Dense vectors (mxbai-embed-large, 1024d)   [пост 2/N]
  └── Sparse vectors (BM25, pymorphy лемматизация) [пост 4/N]
  ↓
Query
  ├── Dense search (Qdrant, top-50)
  └── Sparse search (BM25, top-50)
  ↓
RRF Fusion (0.7 dense + 0.3 sparse)             [пост 4/N]
  ↓
Top-30 candidates
  ↓
Cross-encoder rerank (bge-reranker-v2-m3)        [этот пост]
  ↓
Top-10 results → user / LLM
```

Каждый слой добавляет точности, жертвуя latency:

| Слой | Recall вклад | Latency | Характер |
|------|-------------|---------|----------|
| Dense search | ~70% recall | ~50ms | Семантическое приближение |
| BM25 | +10% recall | ~5ms | Точные совпадения |
| RRF | +5% (dedup) | ~1ms | Комбинация рангов |
| Cross-encoder | +0% recall, reorder | ~3300ms | Точная релевантность |

Cross-encoder **не увеличивает recall**. Он не находит новые документы. Он берёт то, что уже найдено, и ставит самое релевантное наверх. Precision@1 – его метрика.

## Выводы

1. **Reranking ≠ retrieval**. Cross-encoder не находит новые результаты – он тасует колоду, которую ему дали. Если recall плохой, reranker бесполезен. Сначала – recall (chunking, hybrid search), потом – precision (reranking).

2. **67% top-1 изменений – это много**. Две трети запросов получили другой первый результат. Для RAG с LLM это означает, что контекст генерации в 67% случаев будет другим – потенциально лучше.

3. **Каскад – универсальный паттерн**. Bi-encoder + cross-encoder = L1 cache + L2 cache = bloom filter + disk. Дешёвый слой для coverage, дорогой для precision. Работает везде.

4. **CPU latency – основное ограничение**. 568M параметров на CPU = 3.3s. Это определяет архитектуру: reranking годится для async tools (MCP, CLI), не для realtime. GPU решает проблему, но добавляет инфра-сложность.

5. **Truncation работает**. 256 символов вместо 500 – latency падает вдвое, качество не страдает заметно. Для cross-encoder первые 256 символов документа достаточно информативны.

6. **Fallback обязателен**. `RERANKER_ENABLED=false` – мгновенный откат. Модель может не загрузиться (OOM, network, disk). Pipeline должен работать без reranker, просто с чуть худшим порядком. Degraded mode > failure mode.

---

Следующий – про то, как 98% accuracy на своих данных разваливается на чужих.
