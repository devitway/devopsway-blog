---
title: "День 7: cherry-pick и rerere — перенос коммитов и память Git о конфликтах"
date: 2026-04-16T10:00:00+03:00
lastmod: 2026-04-16T10:00:00+03:00
draft: false
weight: 8
categories: ["DevOps основы"]
tags: ["git", "cherry-pick", "rerere", "merge", "conflict"]
author: "DevOps Way"
description: "Как точечно перенести один коммит между ветками через cherry-pick. Как включить rerere — и Git будет сам разрешать повторяющиеся конфликты, запоминая ваше решение."
series: "Git Mastery"
aliases:
  - /posts/day-07-git/
showToc: true
TocOpen: false
hidemeta: false
comments: true
disableHLJS: false
disableShare: false
hideSummary: false
searchHidden: false
---

## Цель урока

После урока вы **умеете** переносить отдельные коммиты между ветками через `cherry-pick`, различаете случаи, когда это уместно, и когда правильнее `merge`/`rebase`. Включили `rerere` глобально и понимаете, как Git запоминает ваше решение конфликта, чтобы применить его автоматически в следующий раз.

| Параметр | Значение |
|----------|----------|
| Bloom | Применение, Анализ |
| SFIA | Уровень 2–3 |
| Время | 35–45 минут |
| Артефакт | `rerere.enabled = true` в `~/.gitconfig` + алиас `pick` |
| Проверка | Мини-тест + сценарий с повторным конфликтом |

---

## Теория за 3 минуты

**`git cherry-pick <sha>`** берёт один коммит с одной ветки и применяет как новый коммит на текущую. Новый коммит имеет **другой SHA**, но тот же diff и то же сообщение.

**Когда уместно cherry-pick:**
- hotfix из `main` надо прокинуть в активный `release/*`
- один коммит из чужого PR пригодится и вашей команде, остальное не нужно
- восстановление потерянного коммита (вы видели в [Дне 2](/posts/day-02-reset-recovery/) — reflog + cherry-pick)

**Когда НЕ cherry-pick:**
- регулярная синхронизация двух веток (это `merge` или `rebase`)
- 5+ коммитов переносить точечно — накопится drift, лучше `rebase --onto` или merge

**`rerere` (reuse recorded resolution)** — механизм, где Git запоминает **как вы разрешили конфликт** (по хэшу содержимого конфликтных областей) и применяет ту же развязку автоматически, когда встречает идентичный конфликт снова.

Типичный случай: вы второй раз rebase'ите ту же long-lived ветку на обновлённый `main`, и снова сталкиваетесь с тем же конфликтом в том же файле. С включённым `rerere` конфликт решается сам.

---

## Практика 1: cherry-pick без конфликта

### Шаг 1. Собираем репо с двумя ветками

```bash
mkdir -p demo-cherry && cd demo-cherry
git init -q

cat > app.js << 'EOF'
function sum(a, b) { return a + b; }
module.exports = sum;
EOF
git add . && git commit -q -m "feat: initial app"

# Создаём release-ветку от main
git branch release/v1

# На main добавляем три коммита
echo "// main change 1" >> app.js && git add . && git commit -q -m "feat: main change 1"

# КРИТИЧЕСКИЙ багфикс — нужен в release тоже
cat > app.js << 'EOF'
function sum(a, b) {
  if (typeof a !== 'number' || typeof b !== 'number') return 0;  // hotfix
  return a + b;
}
module.exports = sum;
EOF
git add . && git commit -q -m "fix: guard against non-number input"
HOTFIX_SHA=$(git rev-parse HEAD)

echo "// main change 3" >> app.js && git add . && git commit -q -m "feat: main change 3"

git log --oneline
```

### Шаг 2. Переносим только hotfix на release

```bash
git checkout release/v1
git cherry-pick $HOTFIX_SHA
```

Git применит тот же diff, создаст новый коммит с таким же сообщением, вернёт вам чистый tree.

```bash
git log --oneline release/v1
# <new-sha> fix: guard against non-number input
# <root>    feat: initial app
```

**Запомните**: SHA изменился. Тот же diff, другой коммит. Это нормально — cherry-pick всегда создаёт нового «клона».

### Шаг 3. Возвращаемся на main

```bash
git checkout main
```

---

## Практика 2: cherry-pick с конфликтом (+ включаем rerere)

Поставим ситуацию, когда коммит изменил файл, а в целевой ветке этот файл уже другой. Перед этим включим `rerere` — Git будет **тихо запоминать** ваше решение, это пригодится в Практике 3.

### Шаг 0. Включаем rerere глобально

```bash
git config --global rerere.enabled true
git config --global rerere.autoupdate true
```

- `enabled` — писать и читать решения
- `autoupdate` — автоматически добавлять в index разрешённые области (без `git add`)

Включайте один раз на машину — работает везде, места почти не занимает.

### Шаг 1. Готовим конфликт

```bash
cd .. && mkdir -p demo-conflict && cd demo-conflict
git init -q

cat > config.json << 'EOF'
{
  "timeout": 30,
  "retries": 3
}
EOF
git add . && git commit -q -m "feat: config"

git branch feature
git checkout -q feature
cat > config.json << 'EOF'
{
  "timeout": 30,
  "retries": 5,
  "feature_flag": true
}
EOF
git add . && git commit -q -m "feat: add feature_flag"

git checkout -q main
cat > config.json << 'EOF'
{
  "timeout": 60,
  "retries": 3
}
EOF
git add . && git commit -q -m "perf: increase timeout"

# Из feature хотим только коммит с feature_flag
FEATURE_SHA=$(git log feature --format=%H -1 --grep feature_flag)
```

### Шаг 2. Cherry-pick → конфликт

```bash
git cherry-pick $FEATURE_SHA
# CONFLICT (content): Merge conflict in config.json
# Automatic cherry-pick failed; fix conflicts...
```

### Шаг 3. Разрешаем вручную

```bash
cat config.json
```
Вы увидите маркеры:
```
<<<<<<< HEAD
  "timeout": 60,
  "retries": 3
=======
  "timeout": 30,
  "retries": 5,
  "feature_flag": true
>>>>>>>
```

Объединяем руками — берём `timeout: 60` из main и `feature_flag` из feature:

```bash
cat > config.json << 'EOF'
{
  "timeout": 60,
  "retries": 5,
  "feature_flag": true
}
EOF
git add config.json
git cherry-pick --continue
```

Коммит создан, работа продолжается.

---

## Практика 3: rerere применяет решение автоматически

Теперь самое интересное. В Практике 2 rerere тихо записал, **как вы развязали конфликт**. Представим, что тот же конфликт нужно решить ещё раз — например, мы сделали rebase, ветку перезаписали, и cherry-pick приходится повторить.

### Шаг 1. Откатываем и повторяем

```bash
# Откатываем коммит с разрешением, но память rerere остаётся
git reset --hard HEAD~1
git cherry-pick $FEATURE_SHA
```

На этот раз Git скажет:
```
Auto-merging config.json
CONFLICT (content): Merge conflict in config.json
error: could not apply <sha>... feat: add feature_flag
...
Staged 'config.json' using previous resolution.
```

Обратите внимание на последнюю строку: **`Staged ... using previous resolution`** — rerere узнал конфликт по хэшу преимаджа, подставил ваше старое решение и даже сам сделал `git add`. Откройте файл:

```bash
cat config.json
```
Там уже правильное содержимое (`timeout: 60` + `feature_flag: true`), **без маркеров конфликта** и уже в индексе (`autoupdate` сработал). Остаётся только завершить cherry-pick:

```bash
git cherry-pick --continue
```

Второй раз вы не писали ни строчки — Git сам сделал работу по памяти. Если `autoupdate` выключен, нужно вручную `git add config.json`, но содержимое всё равно уже разрешено.

### Шаг 2. Где Git хранит память

```bash
ls .git/rr-cache/
# <hash>/preimage postimage
cat .git/rr-cache/*/preimage | head
```

`rr-cache` — каталог с записями: каждая пара «как конфликт выглядел (preimage)» → «как вы его решили (postimage)». Ключ — хэш от преимаджа, поэтому «похожие, но не идентичные» конфликты rerere отличает.

---

## Артефакт: готовая настройка

Добавьте в `~/.gitconfig`:

```ini
[rerere]
    enabled = true
    autoupdate = true

[alias]
    # cherry-pick с коротким именем + авто-skip пустых коммитов
    pick = "cherry-pick --allow-empty --keep-redundant-commits"

    # Список коммитов, отсутствующих в текущей ветке по сравнению с <branch>
    # Удобно искать, что перенести
    missing = "!f() { git log --cherry-pick --oneline --no-merges ..$1; }; f"

    # Показать, что rerere помнит
    rr-status = rerere status
    rr-diff   = rerere diff
```

Использование:
```bash
git missing main                        # что есть в main, чего нет у меня
git pick <sha>                          # cherry-pick
git rr-status                           # какие конфликты rerere готов решить
git rr-diff                             # посмотреть как именно
```

---

## Когда cherry-pick — запах

- **Вы делаете его 5+ раз подряд** между теми же двумя ветками. Значит, ветки должны синхронизироваться merge'ом, а не точечно.
- **Вы переносите чужие коммиты без ревью diff** — теряется контекст, легко затащить то, чего не ожидали.
- **Коммит зависит от 10 предыдущих**, которых на целевой ветке нет — получите конфликт на конфликте, проще взять всю цепочку.

Правило: cherry-pick хорош для **одного изолированного коммита**. Для потока — merge или rebase.

---

## 📝 Документирование

Напишите в `NOTES.md`:

1. **Своими словами**: почему cherry-pick создаёт новый SHA, а не «перемещает» коммит.
2. **Три ситуации**, где cherry-pick оправдан, и одна — где лучше merge.
3. **Что помнит rerere** — по одному предложению, как вы объясните коллеге.
4. **Включили ли rerere у себя** (`git config --global rerere.enabled true`). Да/нет — и почему.

---

## Мини-тест

1. Вы cherry-pick'нули коммит, который **уже применён** в целевой ветке. Что произойдёт по умолчанию и что изменит флаг `--allow-empty`?
2. Можно ли cherry-pick'нуть **merge-коммит**? Какой флаг нужен?
3. В какой момент rerere **записывает** решение — когда вы руками разрешаете конфликт, или когда делаете `git add`?
4. Если хэш конфликтной области отличается от «помеченной» даже на один пробел, сработает ли rerere?

Ответы — в конце.

---

## Что дальше

- **[День 8](/posts/day-08-worktree/)** → worktree: работать одновременно в двух ветках без `git stash` и `git checkout`. Вы сможете держать hotfix-ветку открытой параллельно с feature-веткой, в разных каталогах, с общим `.git/`.
- **[Challenge](/posts/git-master-final-challenge/)** → сломанный репозиторий с 10 проблемами. Задача P8 — cherry-pick с конфликтом + rerere запомнит решение.

---

## Ответы на мини-тест

1. По умолчанию Git скажет «The previous cherry-pick is now empty» и предложит пропустить. С `--allow-empty` создаст пустой коммит (нужно редко — например, для сохранения истории событий).
2. Да: `git cherry-pick -m 1 <merge-sha>`. Флаг `-m` указывает, относительно какого родителя считать diff (у merge-коммита их двое).
3. `rerere` записывает preimage (конфликт) при возникновении конфликта, а postimage (решение) — при `git commit`. Вы правите маркеры, делаете `git add`, затем `git commit` — и в этот момент rerere сохраняет решение.
4. Нет. Хэш считается от точного содержимого preimage — разница в пробел, табуляцию или порядок строк даст другой хэш. Это и защита (не применит «почти похожее» решение по ошибке), и ограничение.
