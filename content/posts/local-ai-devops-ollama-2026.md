---
title: "Локальный AI-ассистент в терминале: гайд для DevOps-инженера (2026)"
date: 2026-05-22T12:00:00+03:00
lastmod: 2026-05-22T12:00:00+03:00
draft: false
categories: ["AI и MLOps"]
tags: ["ollama", "opencode", "aider", "devops", "cli", "open-source", "local-llm"]
author: "DevOps Way"
description: "Какой CLI выбрать, какую модель поставить, как настроить — без облаков, без подписок, без зависимости от вендора. Реальные тесты на CPU и GPU."
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
    alt: "Локальный AI-ассистент в терминале"
    caption: "Tool-agnostic + model-agnostic стек для DevOps"
    relative: false
    hidden: false
editPost:
    URL: ""
    Text: "Предложить изменения"
    appendFilePath: true
---

В феврале мы писали про Qwen Code как бесплатную альтернативу Claude Code. 15 апреля Alibaba [закрыла бесплатный доступ](https://github.com/QwenLM/qwen-code/issues/3203). Статья устарела за два месяца.

Это типичная проблема: привязка к одному вендору = риск. Сегодня бесплатно, завтра — нет. Поэтому перезапускаем тему с другим фокусом: **tool-agnostic + model-agnostic**. Выбираем CLI отдельно, модель отдельно, и собираем рабочий стек, который не сломается от решений чужого менеджмента.

---

## Часть 1: Выбираем CLI

Три рабочих варианта на май 2026. Все — open-source, все работают с локальными моделями через Ollama.

### OpenCode — швейцарский нож

[OpenCode](https://opencode.ai/) — 160K+ звёзд на GitHub, 75+ провайдеров, MIT-лицензия. TypeScript-проект от SST/Anomaly с терминальным TUI.

**Установка:**
```bash
curl -fsSL https://opencode.ai/install | bash
```

**Подключение к Ollama** (`~/.config/opencode/opencode.jsonc` или `opencode.json` в корне проекта):
```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "ollama": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Ollama",
      "options": {
        "baseURL": "http://localhost:11434/v1"
      },
      "models": {
        "qwen3:14b": { "name": "Qwen 3 14B" },
        "gemma4:26b": { "name": "Gemma 4 26B MoE" }
      }
    }
  }
}
```

**Плюсы:** установка одной командой, переключение между облачными и локальными провайдерами одной командой (`/models`), MCP-серверы, tool calling, сессии с историей.

**Минусы:** конфиг многословный, кривая вхождения чуть круче чем у Aider.

**Кому:** хочешь один инструмент на все случаи — и локальные модели, и Copilot, и Claude — через единый интерфейс.

### Aider — ветеран pair programming

[Aider](https://aider.chat/) — 45K+ звёзд, Python, заточен под работу с git-репозиториями. Строит структурную карту кодовой базы, автоматически запускает линтер и тесты после каждого изменения.

**Установка:**
```bash
python -m pip install aider-install && aider-install
```

**Подключение к Ollama:**
```bash
export OLLAMA_API_BASE=http://127.0.0.1:11434
aider --model ollama_chat/qwen3:14b
```

**Плюсы:** лучшая интеграция с git (автокоммиты, диффы), repo-map для больших проектов, автозапуск тестов после правок.

**Минусы:** Python-зависимость, фокус на кодинге (не на DevOps-рутине), контекстное окно Ollama по умолчанию 4K — для больших проектов нужно вручную поднимать.

**Кому:** основная задача — писать и рефакторить код в репозитории с тестами.

### Qwen Code — всё ещё жив (локально)

[Qwen Code](https://github.com/QwenLM/qwen-code) — облако мертво, но локальный режим через Ollama работает как и раньше.

**Установка:**
```bash
npm install -g @qwen-code/qwen-code@latest
```

**Подключение к Ollama** (`~/.qwen/settings.json`):
```json
{
  "modelProviders": {
    "openai": [{
      "id": "qwen3:8b",
      "name": "Qwen3 8B (Ollama)",
      "baseUrl": "http://localhost:11434/v1"
    }]
  },
  "security": { "auth": { "selectedType": "openai" } },
  "model": { "name": "qwen3:8b" }
}
```

**Важно:** Ollama не требует API-ключ, но Qwen Code всё равно его проверяет. Установите любое непустое значение:
```bash
export OPENAI_API_KEY=ollama
```

**Плюсы:** если уже настроен — продолжает работать, знакомый интерфейс.

**Минусы:** зависимость от npm, будущее проекта туманно после закрытия free tier, меньше провайдеров чем у OpenCode.

**Кому:** уже пользуешься, лень мигрировать, всё работает.

### Сравнительная таблица CLI

| | OpenCode | Aider | Qwen Code |
|---|:---:|:---:|:---:|
| Язык | TypeScript | Python | Node.js |
| GitHub stars | 160K+ | 45K+ | 25K+ |
| Ollama | ✅ | ✅ | ✅ |
| Tool calling | ✅ | ✅ | ✅ |
| MCP-серверы | ✅ | ❌ | ✅ |
| Git-интеграция | базовая | лучшая | базовая |
| Провайдеров | 75+ | 20+ | ~10 |
| Установка | 1 команда | pip | npm |

**Рекомендация:** начинайте с **OpenCode** — максимальная гибкость, не привязан к экосистеме. Для code-heavy задач с git — **Aider**.

---

## Часть 2: Выбираем модель

Критерий для DevOps-задач: tool calling + адекватное понимание bash/yaml/terraform/docker. Красивый бенчмарк на HumanEval вторичен — нам важнее, чтобы модель корректно вызывала инструменты и не галлюцинировала в командах.

### MoE-модели — главный выбор для CPU

MoE (Mixture of Experts) — архитектура, где из 30B параметров на каждый токен активируется только 3B. Это принципиально меняет расклад для CPU: вы получаете качество большой модели при скорости маленькой.

| Модель | Всего | Активных | RAM (Q4) | Tool calling | Примечание |
|--------|:-----:|:--------:|:--------:|:---:|------------|
| **Qwen 3.6 35B-A3B** | 35B | 3B | ~21 GB | ✅ | Свежая (апрель 2026), SWE-bench 73.4% |
| **Qwen 3 30B-A3B** | 30B | 3B | ~22 GB | ✅ | Проверенная, хорошо документирована |
| **Gemma 4 26B-A4B** | 26B | 4B | ~20 GB | ✅ | Google, Apache 2.0, 256K контекст |
| **Qwen 3.5 397B-A17B** | 397B | 17B | ~230 GB+ | ✅ | Флагман, нужна серверная машина |

**Qwen 3.6 35B-A3B** — лучший выбор на сегодня для тех, у кого есть 20+ GB RAM. Специально обучена для agentic coding, tool calling из коробки, 73.4% на SWE-bench Verified — это уровень фронтирных моделей.

**Gemma 4 26B-A4B** — альтернатива, если нужен длинный контекст (256K токенов) или предпочитаете Google-экосистему. Чуть больше активных параметров (4B vs 3B), но и чуть качественнее на некоторых задачах.

### Dense-модели — когда RAM ограничена

| Модель | Параметры | RAM (Q4) | Tool calling | Скорость CPU |
|--------|:---------:|:--------:|:---:|:------------:|
| **Qwen 3 14B** | 14B | ~10 GB | ✅ | 5-6 t/s |
| **Qwen 3 8B** | 8B | ~5 GB | ✅ | 9-10 t/s |
| **Gemma 4 E4B** | 4.5B eff / 8B total | ~5 GB | ✅ | 12-18 t/s |
| **Qwen 3 4B** | 4B | ~3 GB | ✅ | 16-18 t/s |

### Модели-ловушки (НЕ работают для agentic-сценариев)

Грабли, чтобы не тратить вечер:

- **`qwen3-coder:30b` (до ноября 2025)** — шаблон Ollama был без tool calling, вызывал бесконечный retry в агентных CLI. Сейчас починено, но осадочек остался. Не путайте с `qwen3.6:35b-a3b`.
- **`phi4-mini`** — мусор вместо JSON в tool calls.
- **`qwen2.5-coder:32b`** — tool calls возвращает JSON-строку в `content`, а не в поле `tool_calls`. CLI не парсит это как вызов инструмента.
- Любая модель без native tool calling — просто не будет работать с агентными CLI.

**Правило:** перед установкой проверяйте на [ollama.com/search?c=tools](https://ollama.com/search?c=tools), есть ли у модели тег `tools` в capabilities. Но тег — необходимое, не достаточное условие: `phi4-mini` имеет тег `tools`, а tool calls всё равно сломаны.

---

## Часть 3: Матрица «Железо → Модель → CLI»

### По доступной RAM

| RAM | Модель | Команда установки | Чего ожидать |
|:---:|--------|-------------------|--------------|
| **8 GB** | Qwen 3 4B (Q4) | `ollama run qwen3:4b` | ~17 t/s, простые задачи |
| **16 GB** | Qwen 3 8B (Q4) | `ollama run qwen3:8b` | ~9 t/s, золотая середина |
| **24 GB** | Gemma 4 26B-A4B (Q4) | `ollama run gemma4:26b` | MoE, ~16 t/s, 20 GB RAM, лучшее качество |
| **24 GB** | Qwen 3 30B-A3B (Q4) | `ollama run qwen3:30b-a3b` | MoE, ~20 t/s, 22 GB RAM |
| **32+ GB** | Qwen 3.6 35B-A3B (Q4) | `ollama run qwen3.6:35b-a3b` | ~21 GB RAM, лучший MoE |
| **32+ GB** | Qwen 3 14B (Q8) | `ollama run qwen3:14b` | Dense, стабильный, ~5 t/s |

### По задаче

| Задача | Модель | Почему |
|--------|--------|--------|
| «Покажи порты / диски / процессы» | Qwen 3 4B–8B | Скорость важнее качества |
| Написать bash-скрипт мониторинга | Gemma 4 26B-A4B | Компактный код без болтовни, MoE-скорость |
| Разобрать Dockerfile / Compose | Gemma 4 26B-A4B | Длинный контекст, точные исправления |
| Отладить Terraform / Ansible | Gemma 4 26B-A4B или Qwen 3 14B+ | Gemma точнее в CIDR/синтаксисе |
| Анализ логов (большой файл) | Gemma 4 26B-A4B | 256K контекст |
| systemd / конфиги | Qwen 3 8B или Gemma 4 26B-A4B | Обе справляются, 8B быстрее |

---

## Часть 4: Практическая настройка (15 минут)

### Шаг 1: Ollama

```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama pull qwen3:30b-a3b     # MoE, 18 GB — или qwen3:8b для слабого железа
```

### Шаг 2: Поднимаем контекстное окно

По умолчанию Ollama даёт модели 4K токенов контекста (на машинах с GPU < 24 GB; с 24+ GB VRAM — автоматически 32K). Для агентной работы 4K мало — CLI отправляет системный промпт + историю + tool calls, и контекст кончается на первом же запросе.

```bash
# Вариант 1: через переменную окружения (для systemd — в override)
OLLAMA_CONTEXT_LENGTH=16384 ollama serve

# Вариант 2: внутри интерактивной сессии (REPL)
ollama run qwen3:30b-a3b
>>> /set parameter num_ctx 16384
```

**Важно:** `/set parameter` работает только внутри REPL (после `>>>`), не на командной строке.

Минимум — 16K. Если RAM позволяет — 32K.

### Шаг 3: Отключаем thinking (опционально)

MoE-модели Qwen по умолчанию «думают вслух» — генерируют блок `<think>...</think>` перед ответом. На простых DevOps-командах это +3–5 секунд бессмысленного ожидания.

**Важно:** в Ollama 0.24+ thinking вынесен в отдельное поле API. Старый трюк `/no_think` в промпте **больше не работает** — модель всё равно думает, только в скрытое поле, расходуя токены. Правильный способ — передать `"think": false` в API-запросе.

**Внимание:** `PARAMETER think false` в Modelfile **не поддерживается** (Ollama 0.24.0 вернёт `unknown parameter 'think'`). Thinking отключается только через API-запрос (`"think": false`) или через шаблон с `/no_think` в Modelfile:

**Кастомный Modelfile (Qwen 3 30B-A3B без thinking):**

```dockerfile
FROM qwen3:30b-a3b

TEMPLATE """{{- range .Messages }}
{{- if eq .Role "system" }}<|im_start|>system
{{ .Content }}<|im_end|>
{{- else if eq .Role "user" }}<|im_start|>user
{{ .Content }} /no_think<|im_end|>
{{- else if eq .Role "assistant" }}<|im_start|>assistant
{{ .Content }}<|im_end|>
{{- end }}
{{- end }}<|im_start|>assistant
"""

PARAMETER num_ctx 16384
```

```bash
ollama create qwen3:30b-nothink -f Modelfile
```

Для рутинных задач разницы в качестве нет, а скорость — вдвое выше. CLI (Aider, OpenCode) могут передавать `think: false` через API, но если используете `ollama run` напрямую — nothink-вариант через Modelfile удобнее.

**Нюанс:** даже с `think: false` модели Qwen 30B-A3B иногда «рассуждают вслух» прямо в ответе (не в `<think>` блоке, а в тексте). Gemma 4 26B-A4B этим не страдает — отвечает компактно и по делу.

### Шаг 4: CLI

**OpenCode:**
```bash
curl -fsSL https://opencode.ai/install | bash
opencode
# В интерфейсе: /connect → Ollama → выбираем модель
```

**Aider:**
```bash
pip install aider-install && aider-install
export OLLAMA_API_BASE=http://127.0.0.1:11434
aider --model ollama_chat/qwen3.6:35b-a3b-nothink
```

### Шаг 5: Проверяем

```
> покажи топ-5 процессов по RAM
> какие порты слушают на этой машине
> напиши systemd unit для бэкапа PostgreSQL
```

Если модель корректно вызывает bash-команды и возвращает отформатированный результат — всё работает.

---

## Часть 5: CPU vs GPU — реальные замеры

Главный вопрос: «насколько терпимо на CPU?»

Замеры на Ryzen 9 7950X, 128 GB DDR5, RTX 3090 24 GB, Ollama 0.24.0. CPU-тесты с ограничением потоков через `num_thread` (8t ≈ i7, 4t ≈ i3/ноутбук). Thinking отключён (`/no_think`), генерация 200 токенов.

### Результаты (t/s — токенов в секунду, генерация)

| Модель | Тип | GPU | CPU 8t | CPU 4t |
|--------|:---:|:---:|:------:|:------:|
| **Qwen 3 30B-A3B** | MoE | 161 | **20.5** | **21.1** |
| **Gemma 4 26B-A4B** | MoE | 138 | 15.5 | 15.6 |
| **Qwen 3 4B** | Dense | 204 | 16.6 | 17.5 |
| **Qwen 3 8B** | Dense | 133 | 9.1 | 9.3 |
| **Qwen 3 14B** | Dense | 82 | 5.4 | 5.3 |

Ключевое наблюдение: **MoE 30B-A3B на CPU быстрее чем dense 4B** — 20+ t/s против 17 t/s. При этом качество на уровне 30B-модели. Gemma 4 26B-A4B чуть медленнее (15.5 t/s), но всё равно быстрее dense 14B и близка к dense 8B — при значительно более высоком качестве. Это главный аргумент за MoE на CPU-only машинах.

**5–20 t/s на CPU** — вполне рабочая скорость. Для простых команд ответ приходит за 3–5 секунд, для длинных скриптов — 20–30 секунд. GPU ускоряет в 8–15x, но CPU — не «мучение», а адекватный вариант.

**Почему 4 потока ≈ 8 потоков?** Генерация токенов — это bandwidth-bound задача (чтение весов из RAM), а не compute-bound. Скорость определяется пропускной способностью памяти, не числом ядер. На DDR5 разница между 4 и 8 потоками минимальна.

**Вывод:** MoE 30B-A3B на CPU — лучший выбор по соотношению качество/скорость. Gemma 4 26B-A4B — отличная альтернатива с 256K контекстом и 16 t/s на CPU. Dense 8B — для тех, кому не хватает RAM на MoE.

---

## Часть 6: Качество на DevOps-задачах — тест на практике

Скорость — это хорошо, но генерирует ли модель рабочий код? Прогнали 5 типовых DevOps-задач через все три модели, **по 3 прогона каждая** (thinking отключён через API `think: false`, `temperature: 0.1`, Ollama 0.24.0, RTX 3090):

| Тест | qwen3:8b | qwen3:30b-a3b | gemma4:26b |
|------|:--------:|:-------------:|:----------:|
| Bash-скрипт мониторинга диска | PASS 3/3 (110 tok) | PARTIAL 2/3, RAMBLE 3/3 | **PASS 3/3** (101 tok) |
| Починить Dockerfile (3 бага) | **3/3** fix, 3/3 consistent | 0-2/3, RAMBLE 3/3 | **3/3** fix, 3/3 consistent |
| Объяснить K8s StatefulSet | 4/4 3/3 consistent | 4/4 но RAMBLE 3/3 | **4/4** 3/3 consistent |
| systemd unit (6 критериев) | 5/6 — **BUG `on_failure`** 3/3 | 6/6, RAMBLE 3/3 | **6/6** 3/3 consistent |
| Найти баг в Terraform CIDR | PASS concise 3/3 | PASS verbose, RAMBLE 3/3 | **PASS concise** 3/3 |

**RAMBLE** = модель «думает вслух» прямо в ответе (не в `<think>` блоке), тратит 500-1024 токена на рассуждения вместо кода.

**Выводы (подтверждены 3x AB):**

- **Gemma 4 26B-A4B** — лидер: 5/5 тестов PASS, 0 ramble, компактные ответы (53-130 tok), 100% consistency. Лучший systemd (`network-online.target`), лучший Dockerfile (`--no-cache-dir`).
- **Qwen 3 8B** — хорошая: 5/5 PASS, 0 ramble, но стабильный баг в systemd (`on_failure` вместо `on-failure` — воспроизводится 3/3).
- **Qwen 3 30B-A3B** — быстрая (20 t/s на CPU), но проблемная: **RAMBLE 15/15 прогонов** (100%). Даже с `think: false` модель пишет рассуждения в content, расходуя токены. На Dockerfile — нестабильна (0-2/3 fix из 3 багов). Для агентных CLI это критично: CLI парсит ответ и ожидает код, а получает текст.

---

## Часть 7: Грабли и лайфхаки

### Контекстное окно — враг номер один

На CPU-only машинах Ollama по умолчанию ставит контекст в 4K токенов (с GPU 24+ GB — автоматически 32K). 4K — это мало. Модель просто забывает начало разговора. Симптом: на третьем вопросе в сессии ответы становятся неадекватными. Лечение: `OLLAMA_CONTEXT_LENGTH=16384` или `num_ctx 16384` в Modelfile.

### Tool calling не работает?

1. Проверьте, что модель поддерживает tools (на странице Ollama в capabilities должен быть тег `tools`)
2. Увеличьте `num_ctx` — маленький контекст = обрезанные tool calls
3. Попробуйте без thinking mode — `<think>` блоки иногда ломают парсинг tool calls в CLI

### MCP-серверы

Работают в OpenCode и Qwen Code. Aider пока не поддерживает MCP. Если нужен доступ к файловой системе, GitHub, или кастомным API через MCP — выбирайте OpenCode.

### Память при MoE

MoE-модели загружают **все** параметры в RAM, хотя активируют малую часть. По данным `ollama ps`: Qwen 3 30B-A3B — 22 GB, Gemma 4 26B-A4B — 20 GB (с контекстом 32K). Если у вас 16 GB RAM — MoE не влезет, берите dense Qwen 3 8B (~5 GB).

---

## Итог

| Что | Рекомендация |
|-----|-------------|
| **CLI** | OpenCode (универсал) или Aider (code + git) |
| **Модель, GPU** | Gemma 4 26B-A4B или Qwen 3.6 35B-A3B |
| **Модель, CPU, 32 GB RAM** | Gemma 4 26B-A4B (лучшее качество на DevOps-задачах) или Qwen 3.6 35B-A3B |
| **Модель, CPU, 24 GB RAM** | Qwen 3 30B-A3B (MoE) — 20 t/s, быстрее dense 8B |
| **Модель, CPU, 16 GB RAM** | Qwen 3 8B (MoE-модели требуют 20+ GB — не влезут) |
| **Модель, CPU, 8 GB RAM** | Qwen 3 4B |
| **Минимальный старт** | `ollama pull qwen3:8b && aider --model ollama_chat/qwen3:8b` |

Главный принцип: **CLI и модель — независимые слои**. Alibaba закроет Qwen Code — переключитесь на OpenCode за 5 минут. Qwen-модель станет хуже — смените на Gemma 4. Ничего не ломается, данные не теряются.

---

Telegram: [@DevITWay](https://t.me/DevITWay)
Сайт: [devopsway.ru](https://devopsway.ru/)
