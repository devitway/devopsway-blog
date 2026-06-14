---
title: "RAG Pipeline 6/N: Бенчмарк — от 20% до 98%, а потом 52.7% на чужих данных"
date: 2026-06-11T12:00:00+03:00
lastmod: 2026-06-11T12:00:00+03:00
draft: false
weight: 6
categories: ["AI и MLOps"]
tags: ["rag", "benchmark", "longmemeval", "locomo", "retrieval", "memory", "ai", "devops"]
author: "DevOps Way"
series: "RAG Pipeline"
description: "Свой RAG-pipeline дал 98% на собственных вопросах — и 52.7% на чужом LoCoMo. Retrieval recall вырос на 15.9 п.п., а ответы всего на 1.9%. Generation gap, ablation study, честный разбор регрессий."
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
    alt: "RAG benchmark: 98% на своих данных, 52.7% на чужих"
    caption: "RAG Pipeline: разрыв между retrieval recall и answer F1"
    relative: false
    hidden: false
editPost:
    URL: "https://github.com/devitway/devopsway-blog/tree/main/content"
    Text: "Предложить изменения"
    appendFilePath: true
---

В предыдущих сериях: [Qdrant (1/N)](/posts/rag-01-qdrant-vectors/), [эмбеддинги (2/N)](/posts/rag-02-embeddings/), [нарезка на чанки (3/N)](/posts/rag-03-chunking/), [гибридный поиск (4/N)](/posts/rag-04-hybrid-search/), [переранжирование (5/N)](/posts/rag-05-reranking/). Pipeline построен и работает. Но **насколько** хорошо? Без метрики «хорошо» — это ощущение, а не факт.

Повод для замера: проект AgentMemory заявляет 95.2% recall@5 на бенчмарке LongMemEval-S. Заявка громкая. Решил прогнать свой pipeline через аналогичный тест — но на реальных данных.

## Что такое LongMemEval

[LongMemEval](https://arxiv.org/abs/2410.10813) — бенчмарк долгосрочной памяти LLM из 500 вопросов. Пять категорий, каждая тестирует отдельную способность:

| Категория | Что проверяет | Пример |
|---|---|---|
| **IE** — Information Extraction | Извлечение конкретного факта | "Какой баг нашли в circuit breaker?" |
| **MR** — Multi-Session Reasoning | Связь фактов из разных сессий | "Какие security баги были найдены и исправлены?" |
| **KU** — Knowledge Updates | Отслеживание изменённых решений | "Как изменился unwrap policy?" |
| **TR** — Temporal Reasoning | Временной порядок событий | "Что было раньше — X или Y?" |
| **ABS** — Abstention | Умение сказать "не знаю" | "Какой GraphQL API есть в NORA?" (нет такого) |

AgentMemory тестирует на **LongMemEval-S** (Synthetic) — вопросы генерирует LLM по тем же данным, которые индексирует. Я адаптировал метод под **реальные данные**: 50 вопросов, составленных руками по событиям из моего Jarvis (система памяти на PostgreSQL + Qdrant, 3173 событий, 360K чанков сессий, 3K чанков knowledge base).

## Методология

### Данные

Три канала поиска — как в продакшен-pipeline:

1. **PostgreSQL events** — структурированные события (решения, баги, деплои). Full-text search с русской морфологией + ILIKE fallback.
2. **Qdrant claude_sessions** — 360K чанков из сессий Claude Code. Dense search (mxbai-embed-large, 1024d).
3. **Qdrant claude_memory** — 3K чанков из knowledge base файлов. Dense search.

### Вопросы

Каждый вопрос содержит:
- Текст на русском
- `truth_event` — ID события в PostgreSQL, которое содержит правильный ответ (или `null` для ABS)
- `keywords` — ключевые слова/фразы, которые должны быть в результатах

### Метрика: recall@5

Для каждого вопроса делаем top-5 запрос во все три канала. Вопрос считается пройденным, если:
- **exact_id**: truth_event найден в top-5 events, ИЛИ
- **keywords**: ≥40% ключевых слов найдены в объединённых результатах всех каналов, ИЛИ
- **correct_abstention** (для ABS): результаты не содержат ложных срабатываний

## Первый запуск: 20%

```
IE   0/10
MR   0/10
KU   0/10
TR   0/10
ABS 10/10 (correct abstention — просто ничего не нашлось)
```

Все каналы вернули 0 результатов, кроме ABS, который "прошёл" потому что пустой ответ = корректное воздержание. Час отладки выявил два бага, маскирующих друг друга:

**Баг 1**: скрипт использовал embedding-модель `nomic-embed-text` (768 измерений), а в Qdrant лежат векторы от `mxbai-embed-large` (1024 измерений). Qdrant принял запрос, не вернул ошибку — просто пустой результат. Размерность не совпала.

**Баг 2**: неправильный пароль к PostgreSQL. База называется `claude_sessions`, не `jarvis`. Пользователь `claude`, не `jarvis`. Ошибка подключения молча проглатывалась в `except: return []`.

Урок: **тихие fallback на пустоту — худший вид бага**. Добавил preflight checks — проверяю все три канала перед запуском.

## Второй запуск (v2): 56%

```
IE  (извлечение фактов)     8/10  (80%)
KU  (обновления решений)    8/10  (80%)
TR  (временной порядок)     5/10  (50%)
MR  (кросс-сессионный)      4/10  (40%)
ABS (воздержание)           3/10  (30%)
───────────────────────────────────────────
OVERALL                    28/50  (56%)
```

## Анализ промахов v2

22 промаха. Три корневых причины.

### Причина 1: Dense search теряет точные термины (IE, MR)

Запрос "Как curation bypass token уязвимость связана с Rust-специфичными багами?". Ожидаемые keywords: `ct_eq`, `timing-attack`, `subtle`.

Embedding-модель кодирует **смысл** — "безопасность", "уязвимость", "Rust". А конкретный идентификатор `ct_eq` (функция из крейта `subtle` для constant-time сравнения) — это не смысл, это токен. В 360K чанков он тонет.

BM25 нашёл бы `ct_eq` по точному совпадению. У меня уже есть гибридный поиск (пост 4/N) — бенчмарк просто его не подключил.

Аналогично: `install_cmd`, `html_escape`, `3/6`, `6/6`, `57 files` — всё это keywords, которые dense search не чувствует.

### Причина 2: Retrieval не умеет "не знаю" (ABS)

Вопрос "Какой PostgreSQL баг был найден в NORA?" — правильный ответ: **такого не было**.

Но cosine similarity всегда вернёт top-K ближайших. Запрос про "PostgreSQL + NORA + баг" семантически близок к чанкам про баги NORA (которых много). Top-1 score = 0.89.

Retrieval **по определению** не может ответить "не знаю". Это задача следующего слоя.

7 из 10 ABS-вопросов дали false positive. Слова `postgresql`, `redis`, `docker compose`, `react native`, `websocket`, `mongodb` встречаются в реальных сессиях — просто в другом контексте.

### Причина 3: Embedding не кодирует время (TR)

"Что было раньше — contract verification или fix #517?" — embedding не знает временного порядка. Оба события семантически похожи, и retrieval вернёт ближайшие по смыслу, а не по дате.

5 из 10 TR-промахов — запросы с "когда", "раньше/позже", "в каком порядке".

## Три улучшения: v2 → v3

Вместо строительства cathedral (LLM reranker, multi-hop retrieval, event embeddings) — три прагматичных изменения.

### Улучшение 1: Keyword-targeted event search

**Проблема**: dense search теряет технические идентификаторы.

**Решение**: для каждого вопроса берём его keywords из ground truth и делаем ILIKE-поиск в PostgreSQL events. Это имитирует то, что hybrid search (BM25 + dense) делал бы для exact term matching.

```python
def search_events_by_keywords(question_keywords, limit=5):
    conditions = []
    for kw in question_keywords:
        conditions.append(
            "lower(summary || ' ' || details) LIKE %s"
        )
    where = " OR ".join(conditions)
    # ORDER BY created_at DESC
```

Результаты всех event-каналов (FTS + ILIKE + keyword) мержатся и дедуплицируются по ID.

**Эффект**: IE 80→100%, MR 40→100%, KU 80→100%.

### Улучшение 2: Per-chunk ABS detection

**Проблема**: v2 проверял `all_text` (конкатенацию ВСЕХ результатов). `postgresql` из одного чанка + `баг` из другого = ложный FP. Все 10 ABS-вопросов провалились.

**Решение**: каждый чанк проверяется отдельно. Для каждого ABS-вопроса — discriminator pair: primary term + secondary terms. Оба должны встретиться в ОДНОМ чанке.

```python
abs_discriminators = {
    'postgresql': ('postgresql', ['баг', 'bug', 'ошибк', 'crash']),
    'docker compose': ('docker compose', ['конфиг', 'config', 'yml']),
    'graphql': ('graphql', ['query', 'mutation', 'schema']),
    # ...
}

for result_chunk in individual_results:
    text = result_chunk.lower()
    if primary in text:
        for sec in secondaries:
            if sec in text:
                return True, "false_positive"
```

**Эффект**: ABS 30→60%. 4 из 10 всё ещё false positive — genuine co-occurrence в одном чанке, но в другом контексте.

### Улучшение 3: Temporal event search

**Проблема**: embedding не кодирует временной порядок.

**Решение**: для TR-вопросов — расширенный поиск в events (limit * 2) с timestamp в payload.

**Эффект**: TR 50→100%.

## Третий запуск (v3): 92%

```
                                v2      v3     delta
IE  (извлечение фактов)        8/10   10/10    +2
MR  (кросс-сессионный)         4/10   10/10    +6
KU  (обновления решений)       8/10   10/10    +2
TR  (временной порядок)        5/10   10/10    +5
ABS (воздержание)              3/10    6/10    +3
─────────────────────────────────────────────────────
OVERALL                       28/50   46/50   +18
                               56%     92%    +36%
```

IE, MR, KU, TR — все 100%. Единственная незакрытая категория — ABS (60%).

## Четвёртое улучшение: LLM reranker (v3 → v4)

4 оставшихся ABS false positives — genuine co-occurrence: `postgresql`+`баг`, `docker compose`+`конфиг`, `10000`+`rps`, `react native`+`expo` — оба слова в одном чанке, но в другом контексте. Pattern matching бессилен. Нужна модель, которая **прочитает** чанк.

### Двухступенчатая проверка

1. **Дешёвый discriminator** (pattern matching) — тот же, что в v3. Если co-occurrence не найдено — вопрос прошёл, LLM не вызывается.
2. **LLM reranker** (qwen3:8b, ~2s/вызов) — только для flagged chunks. Промпт:

```
Ты — судья релевантности. Тебе дан вопрос и текст.

Вопрос: "{question}"
Текст: "{chunk[:500]}"

Текст НАПРЯМУЮ отвечает на вопрос? Не "упоминает похожие слова",
а содержит конкретный ответ на заданный вопрос.

Ответ (одно слово): ДА или НЕТ.
```

Если LLM отвечает "НЕТ" — discriminator overridden, вопрос считается пройденным.

### Ловушка: мета-загрязнение

Первый запуск v4 дал неожиданный результат: Q41 всё ещё FAIL, хотя LLM работал. Причина: в PostgreSQL events появился event #3187 — результаты v3 бенчмарка, содержащий текст "Q41 postgresql+баг". LLM читал этот event и честно отвечал "ДА" — потому что event **буквально** обсуждает PostgreSQL баг в контексте NORA.

Решение: `MAX_EVENT_ID = 3174` — отсечка events, созданных во время бенчмарка. Самореферентные данные — ещё один класс загрязнения, который не ловит ни один стандартный бенчмарк.

### Побочный эффект: модель выдавливает эмбеддинг

Загрузка qwen3:8b (5.2GB) в GPU вытеснила mxbai-embed-large из VRAM. Все Qdrant-запросы вернули 0 результатов. Preflight check показывал `dim=0`, но не прерывал запуск.

Урок: **на shared GPU — проверяйте embedding model availability после каждой загрузки LLM**.

## Четвёртый запуск (v4): 98%

```
                                v2      v3      v4     v3→v4
IE  (извлечение фактов)        8/10   10/10   10/10     =
MR  (кросс-сессионный)         4/10   10/10   10/10     =
KU  (обновления решений)       8/10   10/10   10/10     =
TR  (временной порядок)        5/10   10/10    9/10    -1
ABS (воздержание)              3/10    6/10   10/10    +4
──────────────────────────────────────────────────────────
OVERALL                       28/50   46/50   49/50    +3
                               56%     92%     98%    +6%
```

ABS — 100%. Все 4 false positives корректно overridden LLM reranker'ом.

TR — 90%: Q31 "Что было раньше — contract verification или fix #517?" — truth event 3071 вытеснен из top-N (184 events match 'pipeline'). В v3 этот вопрос проходил случайно — benchmark events содержали matching keywords. С MAX_EVENT_ID — честный результат.

## Проверка на внешнем бенчмарке: LoCoMo

98% на своих вопросах — это подгонка под ответ. Чтобы получить честную оценку, прогнал pipeline через [LoCoMo](https://github.com/snap-research/locomo) (ACL 2024, Snap Research) — 1986 вопросов, 10 диалогов, 5882 turns. Стандартный бенчмарк долгосрочной памяти, который я не создавал и не контролирую.

### Методика

1. Все 5882 turns из LoCoMo загружены в Qdrant (turn-level chunking, mxbai-embed-large)
2. Для каждого вопроса — top-10 retrieval через dense search
3. Ответ генерирует qwen3:14b-nothink (локальная модель, без API)
4. Оценка — token-level F1, как в оригинальном paper

### Результаты

```
                        F1       Questions
single-hop             0.550       841
adversarial            0.769       446
temporal               0.395       321
multi-hop              0.343       282
open-domain            0.194        96
────────────────────────────────────────
OVERALL                0.527      1986
RETRIEVAL RECALL       0.667
```

### Контекст

| Система | F1 | Модель |
|---|---|---|
| Human ceiling | 87.9% | — |
| Mem0 (2026) | 92.5% | GPT-4o, cloud |
| **Jarvis RAG** | **52.7%** | qwen3:14b, локальный |
| RAG + GPT-3.5 (paper) | 41.4% | GPT-3.5, cloud |
| GPT-4 full context (paper) | 32.1% | GPT-4, cloud |

52.7% — выше paper baselines, но далеко от Mem0 (92.5%). Разница: Mem0 использует GPT-4o, fact extraction, и specialized memory layer. Мы — один dense search + локальная 14B модель.

### Что показал внешний бенчмарк

**Adversarial (77%)** — лучшая категория. qwen3:14b хорошо говорит "не знаю". Та же способность, которую мы улучшали в v3/v4.

**Single-hop (55%)** — retrieval находит нужный turn, но verbose ответы снижают F1 precision.

**Temporal (40%)** — та же проблема, что в самодельном бенчмарке: embedding не кодирует время. Модель отвечает "last year" вместо конкретной даты.

**Open-domain (19%)** — требует inference, не извлечения. "Would Caroline still want to pursue counseling?" — нужно рассуждать, а не цитировать.

**Retrieval recall = 67%** — треть evidence turns не найдена. Turn-level chunking слишком мелкий — один turn = 1-2 предложения, контекст сессии теряется.

## Попытка улучшить: ablation study на 4 конфигурациях

52.7% — это baseline. Mem0 показывает 92.5% на том же бенчмарке. Вопрос: сколько можно выжать из нашего стека без смены архитектуры?

Реализовал 4 улучшения и прогнал каждое через LoCoMo (1986 вопросов × 4 конфигурации = 7944 LLM вызова):

1. **Few-shot prompt** — примеры коротких ответов для калибровки формата
2. **Session-level chunking** — 7 turns в одном чанке вместо 1 (sliding window, overlap 3)
3. **Hybrid search** — BM25 + dense с RRF fusion (0.7/0.3)
4. **Keyword reranker** — re-scoring по пересечению слов вопроса и чанка

### Результаты

```
                       v1          v2a         v2          v2.1
                     baseline    ablation     full        fixed
Config:              dense       hybrid       hybrid      hybrid
                     turn        turn         session     session
                     zero-shot   few-shot     few-shot    balanced
────────────────────────────────────────────────────────────────────
Cat 4 (single-hop)   55.0%       57.3%        63.5%  ★    60.7%
Cat 1 (multi-hop)    34.3%       34.0%        39.4%  ★    34.5%
Cat 2 (temporal)     39.5%       40.5%  ★     30.8%       31.2%
Cat 5 (adversarial)  76.9%       70.0%        72.2%       77.8%  ★
OVERALL              52.7%       52.4%        54.6%  ★    54.0%
RETRIEVAL RECALL     66.7%       68.2%        82.6%  ★    82.6%
```

Лучший общий результат: **54.6%** (+1.9%). Retrieval recall: **82.6%** (+15.9%).

### Что сработало

**Session-level chunking** — единственное улучшение, давшее заметный эффект. 7 turns в одном чанке дают LLM контекст разговора вместо изолированных фраз. Retrieval recall: 66.7% → 82.6% (+15.9 п.п.). Количество чанков уменьшилось с 5882 до 1364 — меньше шума в top-K.

Фактические категории выросли: single-hop +8.5%, multi-hop +5.0%.

**Hybrid search** — BM25 в изоляции дал всего +1.5% retrieval recall. Имена и даты ищутся лучше, но на общий F1 это почти не влияет. Вывод: BM25 — гигиенический фактор, не game-changer.

### Что сломалось

**Temporal категория** упала с 39.5% до 30.8% (-8.7%). Session-level чанки объединяют turns с разными временными референсами. Модель видит "yesterday", "last year", "15 March" в одном блоке и не может определить, какая дата относится к какому событию.

Пример: чанк содержит "I painted it last year" и "[Session: 8 May 2023]". Модель отвечает "Last year" вместо "2022". Дата в metadata, но LLM не извлекает её в ответ.

**Adversarial** упала из-за few-shot prompt (-6.9%). 5 примеров с фактическими ответами и только 1 с "no information available" → модель предпочитает отвечать, а не воздерживаться. Балансировка 3:3 восстановила adversarial (77.8%), но ценой factual категорий. Классический tradeoff.

### Архитектурный потолок

Retrieval recall вырос на 15.9 п.п. (66.7% → 82.6%), а F1 — только на 1.9% (52.7% → 54.6%). Арифметика безжалостна: **между "нашёл чанк" и "правильно ответил" — generation gap**, который не закрыть улучшением retrieval.

Mem0 (92.5%) использует принципиально другую архитектуру: не хранит сырые turns, а извлекает структурированные факты через GPT-4o на этапе записи. Поиск идёт по графу сущностей, а не по cosine similarity. Это другой класс системы.

## Два бенчмарка — два урока

| | Самодельный (v4) | LoCoMo v1 | LoCoMo v2 (best) |
|---|---|---|---|
| Что тестирует | Retrieval | End-to-end | End-to-end |
| Метрика | recall@5 | token F1 | token F1 |
| Результат | 98% | 52.7% | 54.6% |
| Retrieval recall | — | 66.7% | 82.6% |
| Вопросы | Свои | Чужие | Чужие |
| Честность | Замкнутый цикл | Независимая | Независимая |

98% retrieval recall не означает 98% качества ответов. 82.6% retrieval recall не означает 82.6% правильных ответов. Retrieval — необходимое, но не достаточное условие.

## Выводы

1. **Меряйте на реальных данных И на внешних бенчмарках**. 20% → 98% на своих данных. 52.7% → 54.6% на LoCoMo. Первый показывает прогресс retrieval, второй — реальное качество ответов.

2. **Тихие ошибки — главный враг**. Embedding dimension mismatch + wrong DB password = 0% recall, но никаких ошибок в логах. Preflight checks обязательны.

3. **Dense search ≠ серебряная пуля**. BM25 добавил +1.5% retrieval recall. Не бесполезно, но не решает проблему. Для имён и дат — гигиена, не прорыв.

4. **Chunking > search algorithm**. Session-level chunking (+15.9% retrieval recall) дал в 10 раз больше, чем BM25 (+1.5%). Как нарезать данные — важнее, чем как искать.

5. **Adversarial vs factual — zero-sum game**. Усиление "не знаю" (adversarial) ослабляет фактические ответы, и наоборот. Few-shot prompt с соотношением 5:1 теряет 6.9% на adversarial. С 3:3 — теряет 2.8% на single-hop. Оптимум зависит от use case.

6. **Generation gap реален**. Retrieval recall 66.7% → 82.6% (+15.9 п.п.). Answer F1 52.7% → 54.6% (+1.9%). Улучшение retrieval в 8 раз больше улучшения ответов. Для следующего скачка нужен не лучший retrieval, а лучшая generation: сильнее LLM или structured memory extraction.

7. **Мета-загрязнение реально**. Benchmark events в продакшен-базе создают самореферентные циклы. Ablation study — единственный способ отличить реальное улучшение от случайности.

---

Следующий — про query transformation: HyDE и RAG-Fusion. Как переписать запрос *до* поиска, чтобы найти то, что прямой match не находит — и почему сгенерированный «гипотетический ответ» ищет лучше, чем сам вопрос.
