---
title: "RAG Pipeline 2/N: Embeddings – как текст превращается в числа"
date: 2026-05-14T12:00:00+03:00
lastmod: 2026-05-14T12:00:00+03:00
draft: false
weight: 2
categories: ["AI и MLOps"]
tags: ["rag", "embeddings", "ollama", "ai", "devops", "nlp"]
author: "DevOps Way"
series: "RAG Pipeline"
description: "Что такое embeddings, почему all-MiniLM не понимает русский текст, как выбрать модель и не сломать pipeline. Практика: три модели, одна фраза, реальные числа."
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
    alt: "Embeddings – как текст становится вектором"
    caption: "RAG Pipeline: от текста к числам"
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
| Артефакт | Скрипт сравнения моделей + benchmark |
| Проверка | Три модели, одна фраза – сравниваем score |

---

## TL;DR

all-MiniLM и nomic-embed-text плохо различают русский текст: борщ и nginx получают одинаковый score. mxbai-embed-large – единственная приемлемая из трёх протестированных, но требует правильной настройки порога.

---

## Проблема: мусор на входе – мусор на выходе

В [прошлом посте](/posts/rag-01-qdrant-vectors/) мы запустили Qdrant и сделали семантический поиск. Но использовали случайные вектора (`random.uniform`). В реальном pipeline вектора создаёт embedding-модель – и от неё зависит **всё**.

Плохая модель превращает "настройка reverse proxy" и "проксирование запросов через nginx" в далёкие точки. Хорошая – в соседние. Если модель не понимает русский текст, ваш RAG будет находить ерунду, даже если Qdrant работает идеально. Garbage in – garbage out. Только тут garbage не в данных, а в модели.

---

## Как работает embedding

Embedding-модель – это нейросеть, обученная на миллионах пар текстов. На входе – строка. На выходе – массив чисел фиксированной длины (вектор).

```bash
# Отправляем текст в Ollama
curl -s http://localhost:11434/api/embed \
  -d '{"model":"all-minilm","input":"Docker контейнер"}' \
  | python3 -c "
import sys, json
emb = json.load(sys.stdin)['embeddings'][0]
print(f'Размерность: {len(emb)}')
print(f'Первые 5: {[round(x,4) for x in emb[:5]]}')
"
# Размерность: 384
# Первые 5: [-0.0312, 0.0891, -0.0456, 0.1234, -0.0678]
```

Два правила, которые нельзя нарушать:

1. **Детерминированность**: один и тот же текст всегда даёт один и тот же вектор
2. **Одна модель на pipeline**: индексировали через `mxbai-embed-large` – ищите через неё же. Вектора разных моделей **несовместимы** (разная размерность, разное пространство смыслов)

Нарушение второго правила – типичная причина "RAG ничего не находит". Переехали на новую модель – переиндексируйте всю базу.

---

## Три модели: сравнение на практике

Все три доступны через Ollama. Скачиваем:

```bash
ollama pull all-minilm        # 23 MB, 384d
ollama pull nomic-embed-text  # 274 MB, 768d
ollama pull mxbai-embed-large # 670 MB, 1024d
```

### Характеристики

| Модель | Размерность | Размер | Контекст | Русский | Скорость |
|--------|-------------|--------|----------|---------|----------|
| all-MiniLM | 384 | 23 MB | 256 tokens | Плохо | Очень быстрая |
| nomic-embed-text | 768 | 274 MB | 8192 tokens | Плохо (не отличает релевантное от нерелевантного) | Быстрая |
| mxbai-embed-large | 1024 | 670 MB | 512 tokens | Приемлемо (при правильном пороге) | Средняя |

### Эксперимент: одна фраза, три модели

Проверим, как модели понимают семантическую близость русского текста. Две пары фраз с одинаковым смыслом, но разными словами, и одна контрольная – заведомо нерелевантная ("рецепт борща"), чтобы проверить, отличает ли модель полезное от мусора:

```python
#!/usr/bin/env python3
# compare-embeddings.py – сравниваем три модели
import requests
import numpy as np

OLLAMA = "http://localhost:11434"

def get_embedding(model, text):
    resp = requests.post(f"{OLLAMA}/api/embed",
                         json={"model": model, "input": text})
    return np.array(resp.json()["embeddings"][0])

def cosine_sim(a, b):
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

queries = [
    ("настройка reverse proxy", "проксирование запросов через nginx"),
    ("контейнер упал с OOM", "процесс убит из-за нехватки памяти"),
    ("настройка reverse proxy", "рецепт борща"),
]

for model in ["all-minilm", "nomic-embed-text", "mxbai-embed-large"]:
    print(f"\n=== {model} ===")
    for q1, q2 in queries:
        e1 = get_embedding(model, q1)
        e2 = get_embedding(model, q2)
        score = cosine_sim(e1, e2)
        print(f"  {score:.3f}  '{q1}' ↔ '{q2}'")
```

Результаты (реальные замеры на нашем сервере, Ollama):

```
=== all-minilm ===
  0.24  'настройка reverse proxy' ↔ 'проксирование запросов через nginx'
  0.55  'контейнер упал с OOM' ↔ 'процесс убит из-за нехватки памяти'
  0.15  'настройка reverse proxy' ↔ 'рецепт борща'

=== nomic-embed-text ===
  0.45  'настройка reverse proxy' ↔ 'проксирование запросов через nginx'
  0.66  'контейнер упал с OOM' ↔ 'процесс убит из-за нехватки памяти'
  0.46  'настройка reverse proxy' ↔ 'рецепт борща'

=== mxbai-embed-large ===
  0.72  'настройка reverse proxy' ↔ 'проксирование запросов через nginx'
  0.75  'контейнер упал с OOM' ↔ 'процесс убит из-за нехватки памяти'
  0.50  'настройка reverse proxy' ↔ 'рецепт борща'
```

**Что видно по цифрам:**

- all-MiniLM: score 0.24 для семантически идентичных фраз – провал. На разумном пороге (0.5+) RAG ничего не найдёт. Единственный плюс: борщ (0.15) хотя бы далеко от proxy.
- nomic-embed-text: proxy 0.45, но борщ **тоже 0.46**. Модель не отличает nginx от кулинарии на русском тексте. Это хуже, чем бесполезно – это опасно.
- mxbai-embed-large: proxy 0.72 – уже рабочий score. Но борщ 0.50 – всё ещё высоковато. На пороге 0.6 борщ проскочит. На пороге 0.7 – нет. Настройка порога критична.

**Главный вывод:** ни одна из моделей не даёт на русском тексте score выше 0.8 для семантически идентичных фраз. На английском all-MiniLM выдаёт 0.68 для "Docker container" / "containerization" – тоже не блестяще, но мусор получает заметно более низкий score. На русском tokenizer разбивает слово на 8-11 частей (почти по буквам), и модель теряет контекст – это не "цена мультиязычности", а следствие того, что русского текста в обучающих данных было мало.

---

## Подводные камни с русским текстом

### 1. Токенизация: русское слово = 8-11 токенов

Embedding-модели используют tokenizer, обученный преимущественно на английском тексте. Одно английское слово – обычно 1 токен. Русское слово раскладывается почти по буквам:

```
English: "container"     → 1 token  → ["container"]
Русский: "контейнер"     → 9 tokens → ["к", "о", "н", "т", "е", "и", "н", "е", "р"]
Русский: "проксирование" → 11 tokens
```

Проверено на реальных tokenizer'ах all-MiniLM, nomic-embed-text и mxbai-embed-large – результат одинаковый. Одно русское слово = 8-11 токенов.

Последствие: русский текст длиной 800 символов может содержать 600-800 токенов. Модель с контекстом 256 токенов (all-MiniLM) обрежет его молча, потеряв большую часть. Модель с контекстом 512 (mxbai-embed-large) – тоже может не уместить.

### 2. Truncation: Ollama truncate=true не работает

Документация Ollama обещает параметр `truncate: true` для автоматической обрезки. На практике поведение нестабильно: в одних версиях модель молча обрезает текст (теряя конец), в других – возвращает ошибку. Полагаться на это нельзя.

Решение – обрезать самостоятельно **до** отправки:

```python
def safe_embed(model, text, max_chars=800):
    """Progressive truncation: 800 → 600 → 400 при ошибке"""
    for limit in [max_chars, 600, 400]:
        chunk = text[:limit]
        try:
            resp = requests.post(f"{OLLAMA}/api/embed",
                                 json={"model": model, "input": chunk},
                                 timeout=30)
            if resp.status_code == 200:
                return resp.json()["embeddings"][0]
        except Exception:
            continue
    return None  # Не удалось получить embedding
```

Это реальный код из нашего продакшен pipeline. Progressive truncation: сначала пробуем 800 символов, если модель не справляется – 600, потом 400.

### 3. Batch-обработка ломается

Ollama поддерживает batch embedding – отправить несколько текстов за один запрос. На коротких фразах работает даже с русским. Но на длинных текстах (300+ символов, реальные чанки документации) – ломается: модель молча возвращает пустой массив или ошибку. Воспроизводимость зависит от версии Ollama и модели.

```python
# ТАК НЕ НАДО (с русским текстом):
resp = requests.post(f"{OLLAMA}/api/embed",
    json={"model": "mxbai-embed-large",
          "input": [text1, text2, text3]})  # batch – ненадёжно

# ТАК НАДЁЖНО:
for text in [text1, text2, text3]:
    resp = requests.post(f"{OLLAMA}/api/embed",
        json={"model": "mxbai-embed-large",
              "input": text})  # по одному
```

Да, это медленнее. Но на первой итерации pipeline (all-MiniLM, 16K чанков) индексация поштучно занимала ~20 минут. На текущем объёме (206K, mxbai-embed-large) полная переиндексация дольше, но в штатном режиме systemd timer переиндексирует только изменённые файлы – и это незаметно.

### 4. Санитизация текста

Перед embedding текст нужно очистить:

```python
def sanitize_for_embedding(text):
    """Убираем мусор, который ломает embedding"""
    import re
    text = text.replace('\ufffd', '')           # replacement character
    text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', text)  # control chars
    text = re.sub(r'(.)\1{20,}', r'\1\1\1', text)  # aaaa...aaa → aaa
    text = text.strip()
    if len(text) < 20:       # quality gate
        return None
    return text
```

Без этого `\ufffd` (Unicode replacement character) и длинные повторяющиеся последовательности (`=====...=====` из markdown) генерируют мусорные вектора, которые "притягивают" нерелевантные результаты.

---

## Ollama vs API

| Критерий | Ollama (self-hosted) | OpenAI API (text-embedding-3-small) |
|----------|---------------------|-------------------------------------|
| Стоимость | Бесплатно (ваше железо) | $0.02 / 1M tokens |
| Приватность | Данные не покидают сервер | Данные уходят в OpenAI |
| Скорость | Зависит от GPU/CPU | Стабильно быстро |
| Качество на русском | mxbai-embed-large – приемлемо (score ~0.72 для похожих фраз) | text-embedding-3-large – по отзывам лучше (не тестировали) |
| Offline | Да | Нет |
| Зависимость | Нет | API key, rate limits, downtime |

Мы используем **Ollama + mxbai-embed-large**. Данные остаются на сервере, нет зависимости от внешнего API, нет счетов за токены. Качество на русском достаточное для RAG – при правильном пороге.

OpenAI API оправдан, если: нет GPU, нужно максимальное качество на русском, или объём данных маленький (стоимость копейки).

---

## Мини-тест

**1. RAG находил фрагменты, вы сменили модель эмбеддинга. Теперь ничего не находит. Почему?**

<details>
<summary>Ответ</summary>

Вектора старой и новой модели несовместимы – разная размерность и/или разное пространство смыслов. Нужно переиндексировать всю базу Qdrant новой моделью. Старые вектора бесполезны.

</details>

**2. Русский текст 800 символов, модель all-MiniLM (контекст 256 токенов). Что произойдёт?**

<details>
<summary>Ответ</summary>

800 символов русского текста ≈ 600-800 токенов (одно русское слово = 8-11 токенов – побуквенное разбиение). Модель с контекстом 256 (all-MiniLM) потеряет большую часть текста. Даже mxbai-embed-large с контекстом 512 не уместит всё. Решение: обрезать текст перед отправкой (safe_embed) или уменьшить размер чанка.

</details>

**3. Score между двумя явно похожими фразами = 0.4. Это нормально?**

<details>
<summary>Ответ</summary>

Зависит от модели и языка. На английском – нет, ожидается 0.7+. На русском – score 0.4 может быть лучшим результатом для all-MiniLM. Проблема в том, что нерелевантный текст (например, "рецепт борща") тоже может получить 0.4 на некоторых моделях (nomic-embed-text). Если разница score между релевантным и нерелевантным меньше 0.15 – модель непригодна для вашего языка. Для русского mxbai-embed-large даёт разницу ~0.22 (proxy 0.72, борщ 0.50), что уже рабочий вариант.

</details>

**4. Зачем `sanitize_for_embedding()` перед отправкой текста?**

<details>
<summary>Ответ</summary>

Мусорные символы (\ufffd, control chars) и длинные повторяющиеся последовательности (===...===) генерируют шумные вектора, которые "притягивают" нерелевантные результаты при поиске. Порог качества (<20 символов) отсекает слишком короткие фрагменты, которые не несут достаточного смысла для embedding.

</details>

---

## Артефакт: скрипт сравнения моделей

```python
#!/usr/bin/env python3
"""
compare-embeddings.py – benchmark embedding-моделей для вашего RAG
Запуск: python3 compare-embeddings.py

Требования:
  pip install requests numpy
  ollama pull all-minilm nomic-embed-text mxbai-embed-large
"""
import requests
import numpy as np
import time

OLLAMA = "http://localhost:11434"

MODELS = ["all-minilm", "nomic-embed-text", "mxbai-embed-large"]

# Пары: (текст1, текст2, ожидание)
# similar = должны быть близки, different = должны быть далеки
PAIRS = [
    ("настройка reverse proxy", "проксирование запросов через nginx", "similar"),
    ("контейнер упал с OOM", "процесс убит из-за нехватки памяти", "similar"),
    ("Kubernetes pod в CrashLoopBackOff", "контейнер перезапускается циклически", "similar"),
    ("ansible playbook для деплоя", "автоматизация развёртывания через YAML", "similar"),
    ("настройка reverse proxy", "рецепт борща", "different"),
    ("мониторинг CPU", "история Древнего Рима", "different"),
]

def get_embedding(model, text):
    resp = requests.post(f"{OLLAMA}/api/embed",
                         json={"model": model, "input": text},
                         timeout=60)
    resp.raise_for_status()
    return np.array(resp.json()["embeddings"][0])

def cosine_sim(a, b):
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))

print("=" * 70)
for model in MODELS:
    print(f"\n{'=' * 70}")
    print(f"  MODEL: {model}")
    print(f"{'=' * 70}")

    start = time.time()
    scores_sim, scores_diff = [], []

    for q1, q2, expect in PAIRS:
        e1 = get_embedding(model, q1)
        e2 = get_embedding(model, q2)
        score = cosine_sim(e1, e2)

        marker = "OK" if (expect == "similar" and score > 0.6) or \
                         (expect == "different" and score < 0.3) else "!!"
        print(f"  [{marker}] {score:.3f}  '{q1}' ↔ '{q2}'")

        if expect == "similar":
            scores_sim.append(score)
        else:
            scores_diff.append(score)

    elapsed = time.time() - start
    print(f"\n  Avg similar: {np.mean(scores_sim):.3f}")
    print(f"  Avg different: {np.mean(scores_diff):.3f}")
    print(f"  Separation: {np.mean(scores_sim) - np.mean(scores_diff):.3f}")
    print(f"  Time: {elapsed:.1f}s ({len(PAIRS)} pairs)")
    print(f"  Dimensions: {len(get_embedding(model, 'test'))}")
```

Запуск:

```bash
pip install requests numpy
python3 compare-embeddings.py
```

Чем больше `Separation` (разница между avg similar и avg different) – тем лучше модель отличает релевантное от нерелевантного.

---

## Продакшен-параметры

В [RAG Pipeline 1/N](/posts/rag-01-qdrant-vectors/) мы показывали параметры учебного pipeline (all-MiniLM, 384d, 16K чанков курса). С тех пор pipeline вырос: переехали на mxbai-embed-large, объём данных увеличился на порядок. Вот актуальные параметры (206,000+ векторов):

| Параметр | Значение | Почему |
|----------|----------|--------|
| Модель | mxbai-embed-large | Лучшее качество на русском из Ollama |
| Размерность | 1024 | Определяется моделью |
| Контекст модели | 512 tokens | Ограничение mxbai |
| CHUNK_SIZE | 800 chars | С progressive truncation не превышает 512 tokens |
| CHUNK_OVERLAP | 150 chars | Контекст на границах чанков |
| Truncation | Progressive: 800→600→400 | Fallback при "context length exceeded" |
| Batch | Поштучно (не batch) | Batch ломается на длинном русском |
| Sanitize | strip \ufffd, control chars, dedup | Чистые вектора = чистый поиск |
| Quality gate | min 20 chars | Слишком короткие фрагменты → шум |
| Объём | 206,000+ session vectors, 2,400 memory vectors | 686 сессий, 323K сообщений |
| Sync | systemd timer, 10 min | Re-index только изменённые |

---

## Что дальше

Модель выбрана, вектора генерируются. Но качество RAG зависит не только от модели – оно зависит от того, **как вы нарезаете текст на куски**:

- **RAG Pipeline 3/N – Chunking** – размер чанка, overlap, split по границам функций, metadata enrichment. Почему 800 символов, а не 500 или 1200.

---

Telegram: [@DevITWay](https://t.me/DevITWay)
Сайт: [devopsway.ru](https://devopsway.ru/)
