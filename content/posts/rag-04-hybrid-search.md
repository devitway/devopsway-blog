---
title: "RAG Pipeline 4/N: Гибридный поиск – почему одних векторов мало"
date: 2026-05-27T06:00:00+03:00
lastmod: 2026-05-27T06:00:00+03:00
draft: false
weight: 4
categories: ["AI и MLOps"]
tags: ["rag", "hybrid-search", "bm25", "rrf", "qdrant", "ai", "devops", "python"]
author: "DevOps Way"
series: "RAG Pipeline"
description: "Dense-векторы теряют точные совпадения, BM25 не понимает смысл. Гибридный поиск объединяет оба метода через Reciprocal Rank Fusion. Реальный код, сравнение на живых данных, продакшен-параметры."
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
    alt: "Гибридный поиск – Dense + BM25 + RRF"
    caption: "RAG Pipeline: два поисковых движка лучше одного"
    relative: false
    hidden: false
editPost:
    URL: ""
    Text: "Предложить изменения"
    appendFilePath: true

---

| Параметр | Значение |
|----------|----------|
| Bloom | L4 (Анализ) |
| SFIA | Уровень 3 |
| Dreyfus | Competent |
| Артефакт | BM25 encoder + RRF fusion скрипт |
| Проверка | Hybrid search находит результаты, которые dense и sparse пропускают по отдельности |

---

## TL;DR

Dense-векторы находят похожее по смыслу, но теряют точные совпадения команд. BM25 находит ключевые слова, но не понимает синонимы. Гибридный поиск запускает оба параллельно и сливает результаты через RRF (Reciprocal Rank Fusion). Веса: dense 0.7, sparse 0.3. Итого ~80ms на запрос.

---

## Проблема: dense search теряет точные совпадения

В [прошлом посте](/posts/rag-03-chunking/) мы нарезали текст на чанки и отправили в Qdrant. Каждый чанк – вектор из 1024 чисел. Поиск – это косинусная близость между вектором запроса и вектором чанка.

Проблема: для embedding-модели `"настройка"` и `"конфигурирование"` – одно и то же. Это хорошо. Но `"docker compose"` и `"оркестрация контейнеров"` – тоже почти одно и то же. Это плохо, когда вы ищете конкретную команду.

Реальный пример из моего pipeline. Запрос: `"kubectl apply deployment yaml"`.

**Dense search** (только вектора):

| # | Score | Результат |
|---|-------|-----------|
| 1 | 0.816 | `11.2.1 КТ3: deployment.yaml` – просто имя файла |
| 2 | 0.793 | `Task 11.1.2: KT6 – Simplify deployment.yaml` – тоже имя файла |
| 3 | 0.774 | `Ошибка с kustomize – нужно запускать... kubectl apply напрямую к deployment.yaml` |

Dense нашёл что-то "про deployment.yaml", но первые два результата – списки файлов, а не объяснение, как работает `kubectl apply`. Модель видит семантику ("deployment", "yaml"), но не различает упоминание от объяснения.

**BM25 search** (только ключевые слова):

| # | Score | Результат |
|---|-------|-----------|
| 1 | 203.1 | `kubectl apply -f pod.yaml / kubectl apply -f deployment.yaml` – полный пример с объяснением декларативного подхода |
| 2 | 172.8 | `kubectl apply напрямую к deployment.yaml` |
| 3 | 167.0 | `kubectl apply -n argocd -f install.yaml` – реальные команды из лабы |

BM25 нашёл точные совпадения с `kubectl apply`. Первый результат – полное объяснение перехода от императивного к декларативному подходу.

**Hybrid search** (оба + RRF fusion):

| # | RRF Score | Результат |
|---|-----------|-----------|
| 1 | 0.016 | `Ошибка с kustomize – используйте kubectl apply напрямую к deployment.yaml` |
| 2 | 0.014 | `Task 9.1.5: YAML Manifests – декларативный подход: kubectl apply -f deployment.yaml` |
| 3 | 0.014 | `Жизненный цикл Deployment: от kubectl apply до работающего пода` (ASCII-диаграмма API Server) |

Hybrid поднял наверх чанк, который содержит и ключевые слова (`kubectl apply`), и семантику (объяснение lifecycle). Ни dense, ни sparse по отдельности не дали такой результат в топ-3.

```
Dense:   "deployment.yaml" ←── семантические соседи (имена файлов)
Sparse:  "kubectl apply -f" ←── точные совпадения команд
Hybrid:  "от kubectl apply до работающего пода" ←── и команды, и смысл
```

---

## Как работает BM25 для русского текста

BM25 – это формула ранжирования из 1994 года. Она считает, насколько важно каждое слово запроса для каждого документа. Основа: если слово встречается часто в одном документе, но редко в корпусе – оно важное.

### Формула

```
score(q, d) = Σ IDF(t) × TF(t, d) × (k1 + 1) / (TF(t, d) + k1 × (1 - b + b × |d| / avg_dl))
```

Где:
- **IDF(t)** – обратная документная частота: `log((N - df + 0.5) / (df + 0.5) + 1)`. Слово в 2 документах из 200 000 – ценнее, чем слово в 50 000.
- **TF(t, d)** – сколько раз термин `t` встречается в документе `d`.
- **k1 = 1.5** – насыщение TF. При k1=0 количество повторений не важно. При k1=2 каждое повторение ещё добавляет вес.
- **b = 0.75** – нормализация по длине. При b=1 длинные документы штрафуются сильно. При b=0 длина не важна.
- **|d| / avg_dl** – отношение длины документа к средней длине в корпусе.

```python
class SimpleBM25:
    def __init__(self, k1: float = 1.5, b: float = 0.75, use_stemming: bool = True):
        self.k1 = k1
        self.b = b
        self.use_stemming = use_stemming
        self.vocab: Dict[str, int] = {}
        self.idf: Dict[str, float] = {}
        self.avg_dl: float = 0
        self.doc_count: int = 0

    def encode(self, text: str) -> Dict[str, List]:
        """Encode text -> sparse vector for Qdrant."""
        tokens = self._tokenize(text)
        tf = Counter(tokens)
        doc_len = len(tokens)

        indices = []
        values = []

        for term, freq in tf.items():
            if term not in self.vocab:
                continue
            idx = self.vocab[term]
            idf = self.idf.get(term, 0)

            numerator = freq * (self.k1 + 1)
            denominator = freq + self.k1 * (1 - self.b + self.b * doc_len / max(self.avg_dl, 1))
            score = idf * (numerator / denominator)

            if score > 0:
                indices.append(idx)
                values.append(round(score, 4))

        return {"indices": indices, "values": values}
```

Результат `encode()` – sparse vector: массив пар `(index, value)`. Qdrant хранит их компактно: только ненулевые элементы. Типичный запрос из 4 слов даёт вектор с 4 ненулевыми позициями из словаря в 125 000+ терминов.

### Проблема #1: русская морфология

Без морфологии BM25 на русском работает значительно хуже. "Настройка", "настройки", "настройку", "настроить" – для наивного BM25 это четыре разных слова. Запрос "настройка docker" не найдёт документ с "настроить docker".

Решение: лемматизация через pymorphy.

```python
import pymorphy3
MORPH = pymorphy3.MorphAnalyzer()

def _stem(self, word: str) -> str:
    """Привести слово к нормальной форме."""
    if re.match(r'^[а-яё]+$', word):
        parsed = MORPH.parse(word)
        if parsed:
            return parsed[0].normal_form
    return word
```

Результат:

```
настройка  → настройка
настройки  → настройка
настройку  → настройка
настроить  → настроить   # другая часть речи, но всё равно найдётся по IDF
```

Pymorphy работает только с кириллицей. Латиница (docker, kubectl, nginx) проходит без изменений – технические термины и так неизменяемы.

### Проблема #2: стоп-слова vs защищённые токены

Стоп-слова – высокочастотные слова, бесполезные для поиска. "На", "в", "с", "это", "для" – они встречаются в каждом документе и имеют нулевой IDF.

Но в DevOps-контексте многие "обычные" слова – технические команды:

| Слово | Обычный язык | DevOps-контекст |
|-------|-------------|-----------------|
| `get` | "получить" | `kubectl get pods` |
| `set` | "установить" | `redis SET key value` |
| `run` | "бежать" | `docker run nginx` |
| `from` | "от, из" | `FROM ubuntu:22.04` |
| `if` | "если" | `if [ -f /etc/nginx.conf ]` |
| `in` | "в" | `for pod in $(kubectl get pods)` |
| `on` | "на" | `ON DELETE CASCADE` |
| `as` | "как" | `import pandas as pd` |

Наивный BM25 выкинет `get`, `set`, `run`, `from` как стоп-слова. А это ключевые команды.

Решение: три списка стоп-слов и один список защиты.

```python
# Русские общие стоп-слова (НЕ из NLTK, вручную подобранные)
RUSSIAN_STOPWORDS = {
    # Предлоги
    'на', 'в', 'во', 'с', 'со', 'к', 'ко', 'о', 'об', 'по', 'за', 'из', 'от', 'до',
    'у', 'при', 'для', 'без', 'под', 'над', 'через', 'между',
    # Союзы
    'и', 'а', 'но', 'или', 'да', 'же', 'ли', 'ни', 'что', 'как', 'если', 'когда',
    'чтобы', 'потому', 'поэтому', 'так', 'тоже', 'также',
    # Местоимения
    'я', 'ты', 'он', 'она', 'оно', 'мы', 'вы', 'они', 'это', 'то',
    'мой', 'твой', 'его', 'её', 'их', 'наш', 'ваш', 'свой', 'кто', 'сам',
    # Частицы, наречия, связки
    'не', 'бы', 'вот', 'уже', 'ещё', 'только', 'очень', 'там', 'тут', 'где',
    'быть', 'есть', 'был', 'была', 'было', 'были', 'будет',
    'можно', 'нужно', 'надо', 'нельзя',
    # ...ещё ~20 слов (вводные, наречия)
}

# Стоп-слова для чатов с LLM-ассистентом
CHAT_STOPWORDS = {
    # Приветствия / вежливость
    'привет', 'здравствуйте', 'пожалуйста', 'спасибо',
    # Обращения к ассистенту
    'подскажи', 'помоги', 'объясни', 'расскажи', 'покажи', 'сделай', 'напиши', 'создай',
    # Реакции
    'отлично', 'хорошо', 'понял', 'понятно', 'готово', 'сделано',
    # Фразы-паразиты
    'давай', 'ладно', 'окей', 'типа', 'короче', 'вообще', 'просто',
}

# Английские общие стоп-слова
ENGLISH_STOPWORDS = {
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'this', 'that', 'it', 'its', 'and', 'or', 'but', 'if',
    'of', 'at', 'by', 'for', 'with', 'about', 'into', 'from',
    'no', 'not', 'only', 'so', 'than', 'too', 'very', 'just',
    # ...ещё ~30 слов
}
```

Три списка покрывают три источника шума: русская грамматика, болтовня с ассистентом, английские артикли/предлоги. Но без защиты они выкосят половину полезных терминов.

```python
# ЗАЩИЩЁННЫЕ токены — НЕ удалять даже если в стоп-листе!
PROTECTED_TOKENS = {
    # Bash команды
    'cd', 'ls', 'rm', 'cp', 'mv', 'cat', 'grep', 'sed', 'awk', 'find',
    'head', 'tail', 'echo', 'touch', 'mkdir', 'chmod', 'chown',
    'curl', 'wget', 'ssh', 'scp', 'rsync',
    'ps', 'kill', 'top', 'df', 'du', 'free', 'tar', 'zip', 'unzip',
    # Docker
    'up', 'down', 'run', 'exec', 'build', 'push', 'pull',
    'stop', 'start', 'restart', 'logs', 'images', 'prune', 'compose',
    # Git
    'add', 'commit', 'push', 'pull', 'fetch', 'merge', 'rebase', 'checkout',
    'clone', 'init', 'status', 'diff', 'log', 'reset', 'stash', 'tag',
    # Kubernetes
    'get', 'set', 'apply', 'delete', 'describe', 'logs', 'exec',
    'scale', 'rollout', 'expose', 'create', 'edit', 'patch',
    # Программирование (без этого поиск по коду не работает)
    'if', 'else', 'for', 'while', 'do', 'case', 'try', 'catch',
    'return', 'break', 'continue', 'pass', 'raise',
    'import', 'from', 'as', 'with', 'in', 'on', 'not', 'is', 'or', 'and',
    'def', 'class', 'fn', 'func', 'function', 'let', 'const', 'var', 'mut',
    'true', 'false', 'null', 'none', 'nil',
    # HTTP
    'get', 'post', 'put', 'patch', 'delete', 'head', 'options',
    # API/Протоколы
    'api', 'http', 'https', 'tcp', 'udp', 'ssh', 'ftp', 'dns', 'ssl', 'tls',
    # SQL
    'select', 'insert', 'update', 'delete', 'from', 'where', 'join',
    'order', 'by', 'group', 'having', 'limit', 'offset',
    # DevOps инструменты
    'docker', 'kubernetes', 'k8s', 'helm', 'ansible', 'terraform',
    'nginx', 'redis', 'postgres', 'mysql', 'mongo', 'elastic',
    'prometheus', 'grafana', 'loki', 'vault', 'consul',
    # Языки и фреймворки
    'python', 'rust', 'go', 'java', 'node', 'npm', 'yarn', 'pip', 'cargo',
    'react', 'vue', 'django', 'flask', 'fastapi', 'axum', 'tokio',
}

# Финальный список: три источника шума МИНУС защита
ALL_STOPWORDS = (RUSSIAN_STOPWORDS | ENGLISH_STOPWORDS | CHAT_STOPWORDS) - PROTECTED_TOKENS
```

В моём pipeline: 232 стоп-слова, 179 защищённых токенов. Пересечение (слова, которые есть в обоих списках, но защита побеждает): `get`, `set`, `from`, `in`, `on`, `as`, `if`, `do`, `for`, `with`, `not`, `is`, `or`, `and`, `no`, `all`, `by`.

Демонстрация на реальном запросе:

```
Input: "Привет! Подскажи как настроить docker compose для production"
                ↓ токенизация + стемминг + фильтрация
Output: ['настроить', 'docker', 'compose', 'production']

Удалены:
  "Привет"    → чат-стоп-слово
  "Подскажи"  → чат-стоп-слово (обращение к ассистенту)
  "как"       → русское стоп-слово (союз)
  "для"       → русское стоп-слово (предлог)

Защищены:
  "docker"    → в PROTECTED_TOKENS (DevOps-инструмент)
  "compose"   → в PROTECTED_TOKENS (Docker-команда)
```

### Построение словаря (fit)

BM25 требует обучения на корпусе – нужен словарь и IDF для каждого термина:

```python
def fit(self, documents: List[str]) -> 'SimpleBM25':
    """Построить словарь и IDF по корпусу."""
    doc_freqs: Counter = Counter()
    total_len = 0

    for doc in documents:
        tokens = self._tokenize(doc)
        total_len += len(tokens)
        for token in set(tokens):  # unique per document
            doc_freqs[token] += 1

    self.doc_count = len(documents)
    self.avg_dl = total_len / self.doc_count

    # Фильтр: только термины в 2+ документах
    min_df = 2
    for term, df in sorted(doc_freqs.items()):
        if df >= min_df:
            self.vocab[term] = len(self.vocab)
            self.idf[term] = math.log(
                (self.doc_count - df + 0.5) / (df + 0.5) + 1
            )
```

`min_df = 2` – фильтруем термины, встречающиеся только в одном документе. Это опечатки, hash-фрагменты, UUID. Они бесполезны для поиска и раздувают словарь.

Обученная модель сериализуется в JSON (~5 MB для 200K+ документов) и загружается при старте за миллисекунды.

---

## Sparse vectors в Qdrant

Qdrant хранит два типа векторов в одной коллекции:

```python
from qdrant_client import QdrantClient
from qdrant_client.models import (
    VectorParams, SparseVectorParams,
    Distance
)

client.create_collection(
    collection_name="hybrid_collection",
    vectors_config={
        "dense": VectorParams(
            size=1024,        # mxbai-embed-large
            distance=Distance.COSINE
        )
    },
    sparse_vectors_config={
        "sparse": SparseVectorParams()
    }
)
```

При загрузке каждый чанк получает оба вектора:

```python
from qdrant_client.models import PointStruct, SparseVector

point = PointStruct(
    id=uuid4().hex,
    vector={
        "dense": embedding,    # [0.023, -0.117, ...] — 1024 float
        "sparse": SparseVector(
            indices=[42, 1337, 8080],   # номера слов в словаре
            values=[2.31, 1.87, 0.94]   # BM25-скоры
        )
    },
    payload={"text": chunk_text, "file": "guide.md", ...}
)
```

Dense vector: 1024 float32 = 4 KB на точку. Sparse vector: в среднем 30-50 ненулевых элементов = ~400 байт. Накладные расходы sparse – ~10% от dense.

---

## RRF: Reciprocal Rank Fusion

У нас два ранжированных списка: dense top-50 и sparse top-50. Нужно объединить их в один.

Наивный подход (объединить по скорам напрямую) не работает. Dense score (cosine similarity) лежит в диапазоне [0, 1]. BM25 score – в диапазоне [0, ∞]. Они несопоставимы.

RRF решает это иначе: забываем про скоры, используем только позиции в ранжировании.

### Формула

```
RRF_score(d) = Σ weight_i / (K + rank_i(d))
```

Для двух списков:

```
RRF_score(d) = 0.7 / (60 + rank_dense(d)) + 0.3 / (60 + rank_sparse(d))
```

- **K = 60** – сглаживающий параметр. Чем выше K, тем меньше разница между позициями. При K=2 (стандарт Qdrant) позиция 1 в 20 раз ценнее позиции 60. При K=60 только в 2 раза.
- **weight_dense = 0.7** – семантика доминирует.
- **weight_sparse = 0.3** – ключевые слова подтягивают точные совпадения.

### Почему K=60, а не стандартные 2?

Стандартный RRF (K=2) слишком агрессивно штрафует позицию. Документ на 10-й позиции в dense получает score `0.7 / 12 = 0.058`. На 1-й: `0.7 / 3 = 0.233`. Разница в 4 раза. Это значит, что sparse-бустинг почти не может поднять документ с 10-й позиции.

При K=60: 10-я позиция = `0.7 / 70 = 0.010`, 1-я = `0.7 / 61 = 0.011`. Разница 10%. Sparse-бустинг реально влияет на ранжирование даже для документов не из топ-5.

### Реализация

```python
def hybrid_search(self, query: str, limit: int = 10, mode: str = "hybrid"):
    # Получаем embedding от Ollama (~50ms)
    dense_vec = get_embedding(query)
    # Получаем BM25 sparse vector (<5ms)
    sparse_vec = self.bm25.encode(query)

    # Prefetch: 5x кандидатов от каждого метода
    prefetch_limit = max(limit * 5, 50)

    # Два параллельных запроса к Qdrant
    dense_results = qdrant.query_points(
        query=dense_vec, using="dense", limit=prefetch_limit
    ).points

    sparse_results = qdrant.query_points(
        query=SparseVector(
            indices=sparse_vec["indices"],
            values=sparse_vec["values"]
        ),
        using="sparse", limit=prefetch_limit
    ).points

    # Weighted RRF fusion
    DENSE_WEIGHT = 0.7
    SPARSE_WEIGHT = 0.3
    RRF_K = 60

    scores = {}
    payloads = {}
    for rank, r in enumerate(dense_results):
        rid = str(r.id)
        scores[rid] = DENSE_WEIGHT / (RRF_K + rank + 1)
        payloads[rid] = r.payload

    for rank, r in enumerate(sparse_results):
        rid = str(r.id)
        # Документ из обоих списков получает сумму обоих скоров
        scores[rid] = scores.get(rid, 0) + SPARSE_WEIGHT / (RRF_K + rank + 1)
        if rid not in payloads:
            payloads[rid] = r.payload

    # Сортировка: лучшие — те, кто набрал скор из ОБОИХ списков
    ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)[:limit]
```

Ключевое: `scores.get(rid, 0) +`. Документ, найденный обоими методами, получает **сумму** скоров. Документ только из dense получает только dense-скор. Документ только из sparse получает только sparse-скор. Пересечение побеждает.

### Fallback

Если BM25-модель не загружена или запрос состоит из одних стоп-слов (sparse vector пустой) – автоматический откат на dense-only:

```python
if not sparse_vec or not sparse_vec.get("indices"):
    # Fallback: dense only
    results = qdrant.query_points(
        query=dense_vec, using="dense", limit=limit
    ).points
```

---

## Сравнение на живых данных

Запрос: `"docker compose настройка"`. Корпус: 235 000+ точек в Qdrant (3K чанков базы знаний из [поста 3/N](/posts/rag-03-chunking/) + рабочие сессии).

**Dense (семантический):**

```
1. [0.865] "docker-compose не найден. Попробую через docker compose (новая версия)"
2. [0.862] "Теперь обновлю docker-compose и перезапущу"
3. [0.860] "Контейнер в правильной сети. Попробую пересоздать его через docker compose up"
```

Все три – короткие операционные фразы. Dense видит "docker compose" как тему, но не различает упоминание от инструкции.

**Sparse (BM25):**

```
1. [143.1] Токенизация: "настроить docker compose production" — тест BM25-encoder
2. [126.3] "Удалены: Привет, Подскажи. Стемминг: настройки → настройка. Защищены: docker, compose"
3. [117.7] Сравнение search методов: "Query: docker compose настройка → DENSE vs SPARSE"
```

BM25 нашёл точные совпадения всех трёх слов запроса. Первый результат – документация самого BM25-encoder, где есть буквально `"настроить docker compose"`. Точное попадание по ключевым словам.

**Hybrid (RRF):**

Топ-результаты содержат и семантическую релевантность (чанки про работу с docker compose), и ключевые слова (конкретные команды и настройки). Документы, попавшие в оба списка, получают бустинг.

---

## Тайминг

| Этап | Время |
|------|-------|
| Dense embedding (Ollama, mxbai-embed-large) | ~50ms |
| BM25 encode (Python, in-memory vocab) | ~5ms |
| Qdrant dense search (1024d, cosine, 235K points) | ~15ms |
| Qdrant sparse search | ~10ms |
| RRF fusion (Python dict merge + sort) | <1ms |
| **Итого hybrid** | **~80ms** |

Для сравнения: один запрос к LLM – 2-10 секунд. 80ms на поиск – копейки на фоне LLM inference.

---

## Когда какой режим

| Запрос | Лучший режим | Почему |
|--------|-------------|--------|
| `"docker compose настройка"` | hybrid | Нужны и ключевые слова, и семантика |
| `"как работает Service в Kubernetes"` | dense | Семантический вопрос, нет конкретных команд |
| `"kubectl get pods -n kube-system"` | sparse | Точная команда, семантика не нужна |
| `"проблемы с сетью контейнеров"` | dense | Абстрактный запрос, BM25 не поможет |
| `"nginx proxy_pass upstream"` | hybrid | Технические термины + контекст |

В моём pipeline по умолчанию всегда hybrid. Fallback на dense – только если BM25-модель не загружена.

---

## Мини-тест

**1. Вы ищете `"docker run nginx"`. Почему naive BM25 (без protected tokens) найдёт всё, кроме того, что нужно?**

<details>
<summary>Ответ</summary>

`run` – английское стоп-слово ("бежать"). Naive BM25 его выкинет. Останется только `docker` и `nginx`. Поиск вернёт любые чанки, где упоминаются Docker и Nginx вместе: Dockerfile, docker-compose, конфиг nginx – но не конкретно `docker run`. С protected tokens `run` сохраняется, и BM25 находит именно запуск контейнера.

</details>

**2. Запрос: `"как поднять сервисы в фоне"`. Какой режим поиска сработает лучше и почему?**

<details>
<summary>Ответ</summary>

Dense. В запросе нет ни одной конкретной команды – только человеческий язык. BM25 будет искать слова "поднять", "сервисы", "фоне" буквально и, скорее всего, ничего релевантного не найдёт. Dense поймёт смысл и свяжет запрос с `docker compose up -d`, `systemctl start`, `nohup` – потому что embedding-модель знает, что "поднять в фоне" семантически близко к "запустить как демон".

Hybrid тоже сработает (dense-часть вытянет), но sparse-часть ничего полезного не добавит.

</details>

**3. Вы добавили в корпус 10 000 новых документов про Cilium, но забыли переобучить BM25. Что сломается?**

<details>
<summary>Ответ</summary>

Dense search найдёт новые документы без проблем – embedding-модель знает, что такое Cilium. А BM25 – нет: слова "cilium", "ebpf", "hubble" отсутствуют в словаре, и sparse vector для этих терминов будет пустым. Hybrid search деградирует до чистого dense для любых запросов про Cilium. Хуже того, IDF старых терминов тоже устарел – частотности сдвинулись, но BM25 об этом не знает.

Вывод: при существенном обновлении корпуса BM25 нужно переобучать (`fit` на новых данных).

</details>

---

## Артефакт: BM25 encoder + hybrid search

Полный рабочий скрипт. Требует: `qdrant-client`, `pymorphy3` (опционально), Ollama с `mxbai-embed-large`.

```python
#!/usr/bin/env python3
"""
hybrid-search-demo.py -- демонстрация гибридного поиска Dense + BM25 + RRF.

Требования:
  pip install qdrant-client requests pymorphy3
  # Ollama с mxbai-embed-large запущен на localhost:11434
  # Qdrant запущен на localhost:6333

Запуск:
  python3 hybrid-search-demo.py "docker compose настройка"
  python3 hybrid-search-demo.py "kubectl apply" --mode sparse
  python3 hybrid-search-demo.py "как работает Service" --mode dense
"""
import argparse
import math
import re
import time
import requests
from collections import Counter
from typing import Dict, List, Optional

from qdrant_client import QdrantClient
from qdrant_client.models import SparseVector

# ============================================
# BM25 ENCODER
# ============================================

try:
    import pymorphy3
    MORPH = pymorphy3.MorphAnalyzer()
except ImportError:
    try:
        import pymorphy2
        MORPH = pymorphy2.MorphAnalyzer()
    except ImportError:
        MORPH = None

RUSSIAN_STOPWORDS = {
    'на', 'в', 'во', 'с', 'со', 'к', 'ко', 'о', 'об', 'по', 'за', 'из', 'от', 'до',
    'у', 'при', 'для', 'без', 'под', 'над', 'через', 'между',
    'и', 'а', 'но', 'или', 'да', 'же', 'ли', 'ни', 'что', 'как', 'если', 'когда',
    'чтобы', 'потому', 'поэтому', 'так', 'тоже', 'также',
    'я', 'ты', 'он', 'она', 'оно', 'мы', 'вы', 'они', 'это', 'то',
    'мой', 'твой', 'его', 'её', 'их', 'наш', 'ваш', 'свой', 'кто', 'сам',
    'не', 'бы', 'вот', 'уже', 'ещё', 'только', 'очень', 'там', 'тут', 'где',
    'быть', 'есть', 'был', 'была', 'было', 'были', 'будет',
    'можно', 'нужно', 'надо', 'нельзя',
    'кстати', 'например', 'конечно', 'наверное', 'возможно',
}

CHAT_STOPWORDS = {
    'привет', 'здравствуйте', 'пожалуйста', 'спасибо',
    'подскажи', 'помоги', 'объясни', 'расскажи', 'покажи', 'сделай', 'напиши', 'создай',
    'отлично', 'хорошо', 'понял', 'понятно', 'готово', 'сделано',
    'давай', 'ладно', 'окей', 'типа', 'короче', 'вообще', 'просто',
}

ENGLISH_STOPWORDS = {
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'this', 'that', 'it', 'its', 'and', 'or', 'but', 'if',
    'of', 'at', 'by', 'for', 'with', 'about', 'into', 'from',
    'no', 'not', 'only', 'so', 'than', 'too', 'very', 'just',
}

PROTECTED = {
    # Bash
    'cd', 'ls', 'rm', 'cp', 'mv', 'cat', 'grep', 'sed', 'awk', 'find',
    'head', 'tail', 'echo', 'touch', 'mkdir', 'chmod', 'chown',
    'curl', 'wget', 'ssh', 'scp', 'rsync',
    'ps', 'kill', 'top', 'df', 'du', 'free', 'tar', 'zip', 'unzip',
    # Docker
    'up', 'down', 'run', 'exec', 'build', 'push', 'pull',
    'stop', 'start', 'restart', 'logs', 'images', 'prune', 'compose',
    # Git
    'add', 'commit', 'push', 'pull', 'fetch', 'merge', 'rebase', 'checkout',
    'clone', 'init', 'status', 'diff', 'log', 'reset', 'stash', 'tag',
    # Kubernetes
    'get', 'set', 'apply', 'delete', 'describe', 'logs', 'exec',
    'scale', 'rollout', 'expose', 'create', 'edit', 'patch',
    # Программирование
    'if', 'else', 'for', 'while', 'do', 'case', 'try', 'catch',
    'return', 'break', 'continue', 'pass', 'raise',
    'import', 'from', 'as', 'with', 'in', 'on', 'not', 'is', 'or', 'and',
    'def', 'class', 'fn', 'func', 'function', 'let', 'const', 'var', 'mut',
    'true', 'false', 'null', 'none', 'nil',
    # HTTP / API
    'get', 'post', 'put', 'patch', 'delete', 'head', 'options',
    'api', 'http', 'https', 'tcp', 'udp', 'ssh', 'ftp', 'dns', 'ssl', 'tls',
    # SQL
    'select', 'insert', 'update', 'delete', 'from', 'where', 'join',
    'order', 'by', 'group', 'having', 'limit', 'offset',
    # DevOps инструменты
    'docker', 'kubernetes', 'k8s', 'helm', 'ansible', 'terraform',
    'nginx', 'redis', 'postgres', 'mysql', 'mongo', 'elastic',
    'prometheus', 'grafana', 'loki', 'vault', 'consul',
    # Языки и фреймворки
    'python', 'rust', 'go', 'java', 'node', 'npm', 'yarn', 'pip', 'cargo',
    'react', 'vue', 'django', 'flask', 'fastapi', 'axum', 'tokio',
}

FINAL_STOPWORDS = (RUSSIAN_STOPWORDS | ENGLISH_STOPWORDS | CHAT_STOPWORDS) - PROTECTED


class SimpleBM25:
    def __init__(self, k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b = b
        self.vocab: Dict[str, int] = {}
        self.idf: Dict[str, float] = {}
        self.avg_dl: float = 0
        self.doc_count: int = 0

    def _stem(self, word: str) -> str:
        if MORPH and re.match(r'^[а-яё]+$', word):
            parsed = MORPH.parse(word)
            if parsed:
                return parsed[0].normal_form
        return word

    def _tokenize(self, text: str) -> List[str]:
        text = text.lower()
        raw = re.findall(r'\b[a-zA-Zа-яА-ЯёЁ0-9_]{2,}\b', text)
        return [self._stem(t) for t in raw if t not in FINAL_STOPWORDS]

    def fit(self, documents: List[str]) -> 'SimpleBM25':
        doc_freqs: Counter = Counter()
        total_len = 0
        valid_docs = [d for d in documents if d]

        for doc in valid_docs:
            tokens = self._tokenize(doc)
            total_len += len(tokens)
            for token in set(tokens):
                doc_freqs[token] += 1

        self.doc_count = len(valid_docs)
        self.avg_dl = total_len / self.doc_count if self.doc_count else 1

        for term, df in sorted(doc_freqs.items()):
            if df >= 2:  # min_df: фильтр мусора
                self.vocab[term] = len(self.vocab)
                self.idf[term] = math.log(
                    (self.doc_count - df + 0.5) / (df + 0.5) + 1
                )
        return self

    def encode(self, text: str) -> Dict[str, List]:
        tokens = self._tokenize(text)
        tf = Counter(tokens)
        doc_len = len(tokens)
        indices, values = [], []

        for term, freq in tf.items():
            if term not in self.vocab:
                continue
            idx = self.vocab[term]
            idf = self.idf.get(term, 0)
            num = freq * (self.k1 + 1)
            den = freq + self.k1 * (1 - self.b + self.b * doc_len / max(self.avg_dl, 1))
            score = idf * (num / den)
            if score > 0:
                indices.append(idx)
                values.append(round(score, 4))

        if indices:
            pairs = sorted(zip(indices, values))
            indices, values = [list(x) for x in zip(*pairs)]
        return {"indices": indices, "values": values}


# ============================================
# HYBRID SEARCH
# ============================================

OLLAMA_URL = "http://localhost:11434/api/embed"
EMBED_MODEL = "mxbai-embed-large"


def get_embedding(text: str) -> Optional[List[float]]:
    """Dense embedding через Ollama."""
    try:
        resp = requests.post(OLLAMA_URL, json={
            "model": EMBED_MODEL, "input": text[:800]
        }, timeout=30)
        if resp.status_code == 200:
            return resp.json().get("embeddings", [None])[0]
    except Exception:
        pass
    return None


def hybrid_search(
    client: QdrantClient,
    bm25: SimpleBM25,
    collection: str,
    query: str,
    limit: int = 10,
    mode: str = "hybrid",
):
    """Гибридный поиск: Dense + BM25 + RRF."""
    dense_vec = get_embedding(query)
    sparse_vec = bm25.encode(query) if mode != "dense" else None

    prefetch = max(limit * 5, 50)
    DENSE_W, SPARSE_W, K = 0.7, 0.3, 60

    if mode == "dense":
        return client.query_points(
            collection_name=collection,
            query=dense_vec, using="dense",
            limit=limit, with_payload=True
        ).points

    if mode == "sparse":
        return client.query_points(
            collection_name=collection,
            query=SparseVector(
                indices=sparse_vec["indices"],
                values=sparse_vec["values"]
            ),
            using="sparse",
            limit=limit, with_payload=True
        ).points

    # Hybrid: два запроса + RRF
    dense_res = client.query_points(
        collection_name=collection,
        query=dense_vec, using="dense",
        limit=prefetch, with_payload=True
    ).points

    if sparse_vec and sparse_vec.get("indices"):
        sparse_res = client.query_points(
            collection_name=collection,
            query=SparseVector(
                indices=sparse_vec["indices"],
                values=sparse_vec["values"]
            ),
            using="sparse",
            limit=prefetch, with_payload=True
        ).points
    else:
        sparse_res = []

    # RRF fusion
    scores, payloads = {}, {}
    for rank, r in enumerate(dense_res):
        rid = str(r.id)
        scores[rid] = DENSE_W / (K + rank + 1)
        payloads[rid] = r.payload

    for rank, r in enumerate(sparse_res):
        rid = str(r.id)
        scores[rid] = scores.get(rid, 0) + SPARSE_W / (K + rank + 1)
        if rid not in payloads:
            payloads[rid] = r.payload

    ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)[:limit]

    class _Result:
        def __init__(self, score, payload):
            self.score = score
            self.payload = payload

    return [_Result(s, payloads[rid]) for rid, s in ranked]


# ============================================
# CLI
# ============================================

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Hybrid search demo")
    parser.add_argument("query", help="Search query")
    parser.add_argument("--mode", default="hybrid",
                        choices=["dense", "sparse", "hybrid"])
    parser.add_argument("--limit", type=int, default=5)
    parser.add_argument("--collection", default="hybrid_collection")
    args = parser.parse_args()

    client = QdrantClient(host="localhost", port=6333)

    # BM25 needs to be fitted on your corpus first
    # bm25 = SimpleBM25().fit(your_documents)
    # For demo, load pre-fitted model:
    # bm25 = SimpleBM25.load("bm25_model.json")

    print(f"Query: {args.query}")
    print(f"Mode:  {args.mode}")
    print(f"---")

    t0 = time.time()
    # results = hybrid_search(client, bm25, args.collection,
    #                         args.query, args.limit, args.mode)
    elapsed = (time.time() - t0) * 1000

    # for r in results:
    #     text = r.payload.get("text", "")[:100]
    #     print(f"  [{r.score:.4f}] {text}")
    # print(f"\n{elapsed:.0f}ms")

    # Demo: show tokenization
    bm25 = SimpleBM25()
    tokens = bm25._tokenize(args.query)
    print(f"BM25 tokens: {tokens}")
    print(f"Stopwords removed: {len(FINAL_STOPWORDS)}")
    print(f"Protected tokens: {len(PROTECTED)}")
```

---

## Продакшен-параметры

| Параметр | Значение | Почему |
|----------|----------|--------|
| Dense model | mxbai-embed-large (1024d) | Лучшее качество на русском ([пост 2/N](/posts/rag-02-embeddings/)) |
| Sparse model | SimpleBM25 (k1=1.5, b=0.75) | Стандартные BM25 параметры, проверенные на корпусе |
| Стемминг | pymorphy3 (лемматизация) | Русская морфология: "настройка/настройки/настроить" → один стем |
| Стоп-слова | 232 (рус + англ + chat) | Ручная подборка, не [NLTK](https://www.nltk.org/) |
| Защищённые токены | 179 | DevOps-команды, которые нельзя фильтровать |
| Словарь BM25 | ~125 000 терминов | min_df=2, обучен на 235K+ сообщений |
| RRF K | 60 | Сглаживание: все 50 prefetch-кандидатов значимы |
| Dense weight | 0.7 | Семантика доминирует |
| Sparse weight | 0.3 | Ключевые слова буcтят точные совпадения |
| Prefetch | 5x от limit (min 50) | Достаточно кандидатов для RRF fusion |
| Dense latency | ~50ms | Ollama, localhost, GPU |
| BM25 encode | ~5ms | In-memory vocab, Python |
| Qdrant search | ~15ms + ~10ms | 235K+ points, localhost |
| RRF fusion | <1ms | Dict merge + sort |
| **Total** | **~80ms** | Пренебрежимо мало vs LLM inference |
| Коллекция Qdrant | dense (1024d, cosine) + sparse | Один upsert – два вектора |
| Корпус | 235 000+ сообщений | Рабочие сессии + web |

### Эволюция

| Версия | Метод | Проблема |
|--------|-------|----------|
| v1 | Dense only (cosine) | Теряет `kubectl get pods` при запросе "получить список подов" |
| v2 | Dense + BM25 + RRF | Находит и по смыслу, и по ключевым словам |

---

## Что дальше

Гибридный поиск находит релевантные фрагменты. Но 10 результатов – это ещё не ответ. Нужно:

- **RAG Pipeline 5/N: Reranking**. У нас 10 результатов из hybrid search, но порядок может быть неоптимальным. Cross-encoder reranking переоценивает каждую пару (запрос, документ) и выдаёт финальный ранг.

---

Telegram: [@DevITWay](https://t.me/DevITWay)
Сайт: [devopsway.ru](https://devopsway.ru/)
