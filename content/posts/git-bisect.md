---
title: "День 6: bisect — Git находит сломавший коммит за вас"
date: 2026-04-16T10:00:00+03:00
lastmod: 2026-04-16T10:00:00+03:00
draft: false
weight: 7
categories: ["DevOps основы"]
tags: ["git", "bisect", "debugging", "regression", "ci"]
author: "DevOps Way"
description: "Бинарный поиск по истории коммитов. За 10 шагов найти виновника среди 1024 коммитов. Ручной bisect, автоматический через bisect run, и когда использовать skip."
series: "Git Mastery"
aliases:
  - /posts/day-06-git/
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

После урока вы **умеете** найти коммит, внёсший регрессию, за `log₂(N)` шагов через `git bisect`; различаете `bad`, `good`, `skip`; умеете автоматизировать поиск через `git bisect run` с любым тест-скриптом.

| Параметр | Значение |
|----------|----------|
| Bloom | Применение, Анализ |
| SFIA | Уровень 2–3 |
| Время | 30–40 минут |
| Артефакт | `test-bisect.sh` — тест-детектор под `bisect run` |
| Проверка | Мини-тест + сценарий «найди виновника за 4 шага» |

---

## Теория за 3 минуты

Git-история — это **DAG коммитов**. Каждый коммит знает, от какого родителя он произошёл.

Когда тест сломался «где-то за последние две недели», ручной перебор по 50+ коммитам — час. `bisect` делает бинарный поиск по этому DAG: на каждом шаге берёт коммит ровно посередине между «точно работает» и «точно сломано», вы его проверяете, Git сужает диапазон вдвое.

**Математика простая:**

| Коммитов между good и bad | Шагов bisect |
|-------------------------:|:------------:|
| 16 | 4 |
| 64 | 6 |
| 1024 | 10 |
| 1 000 000 | 20 |

Каждый шаг уменьшает область поиска в 2 раза. Это единственный инструмент Git с настоящей «магией» — вы поймёте почему, когда пройдёте практику.

---

## Практика 1: ручной bisect на 16 коммитах

### Шаг 1. Собираем репо с регрессией

```bash
mkdir -p /tmp/demo-bisect && cd /tmp/demo-bisect
git init -q

# Пишем простой калькулятор процентов
cat > calc.js << 'EOF'
function percent(value, total) {
  return (value / total) * 100;
}
module.exports = percent;
EOF

cat > test.js << 'EOF'
const percent = require('./calc');
const r = percent(25, 100);
if (r !== 25) { console.error('FAIL: got', r); process.exit(1); }
console.log('PASS');
EOF

git add . && git commit -q -m "feat: percent calculator"

# 15 коммитов с невинными правками, один из них ломает тест
for i in $(seq 1 15); do
  echo "// iteration $i" >> calc.js
  # В коммит 9 вносим регрессию
  if [ "$i" = "9" ]; then
    sed -i 's|(value / total) \* 100|(value / total) + 100|' calc.js
  fi
  git add . && git commit -q -m "chore: minor change $i"
done

git log --oneline | head -5
```

### Шаг 2. Проверяем, что сейчас сломано

```bash
node test.js
# FAIL: got 100.25
```

### Шаг 3. Запускаем bisect

```bash
git bisect start
git bisect bad HEAD           # текущее состояние — плохое
git bisect good HEAD~15       # самый первый коммит — хороший
```

Git переключится на середину и скажет:
```
Bisecting: 7 revisions left to test after this (roughly 3 steps)
```

### Шаг 4. Тестируем и отвечаем

```bash
node test.js && git bisect good || git bisect bad
```

Git возьмёт следующую середину. Повторяете команду выше ещё 2–3 раза.

После последнего шага увидите:
```
<sha> is the first bad commit
commit <sha>
    chore: minor change 9
```

### Шаг 5. Выход из bisect

```bash
git bisect reset
```

**Итог**: нашли виновника из 15 коммитов за **4 шага** (log₂(16) = 4). Если бы коммитов было 1024, ушло бы 10 шагов. Руками было бы 1024 запуска теста.

---

## Практика 2: автоматический bisect через `run`

Проверка «запусти тест и ответь good/bad» — это цикл. Git умеет его крутить сам.

### Шаг 1. Тест-скрипт с правильными exit-кодами

```bash
cat > test-bisect.sh << 'EOF'
#!/bin/bash
# Bisect ожидает: exit 0 = good, exit 1 = bad, exit 125 = skip (не могу протестировать)
node test.js > /dev/null 2>&1
EOF
chmod +x test-bisect.sh
```

### Шаг 2. Полностью автоматический поиск

```bash
git bisect start HEAD HEAD~15
git bisect run ./test-bisect.sh
```

Git сам пробегает все шаги, печатает итог, оставляет вас на виновнике:

```
running './test-bisect.sh'
Bisecting: 7 revisions left...
...
<sha> is the first bad commit
bisect found first bad commit
```

```bash
git bisect reset
```

**Это ключевой навык**: если у вас есть воспроизводимый тест (любой скрипт, возвращающий 0/1), регрессию можно находить без участия человека. В CI это превращается в job «найди-виновника-и-открой-issue».

---

## Практика 3: когда тест нестабилен — `bisect skip`

Не все коммиты пригодны для тестирования. Пример: в коммите 5 сломалась сборка (не тест), `npm install` падает — вы ни good, ни bad сказать не можете.

```bash
git bisect start HEAD HEAD~15

# допустим, текущий коммит не собирается
git bisect skip

# Git возьмёт соседний коммит и попытается снова
```

Для автоматизации — `exit 125` в тест-скрипте:

```bash
cat > test-bisect-safe.sh << 'EOF'
#!/bin/bash
# Сначала проверяем, что коммит вообще работоспособен
if [ ! -f calc.js ]; then
  exit 125   # этот коммит не годится для теста
fi
node test.js > /dev/null 2>&1
EOF
chmod +x test-bisect-safe.sh
```

Правило: `bad`/`good` — «я могу сказать про поведение», `skip` — «я не могу сказать».

---

## Артефакт: универсальный шаблон тест-скрипта

Сохраните в корне своего проекта как `.bisect-run.sh`:

```bash
#!/bin/bash
# .bisect-run.sh — безопасный тест-детектор для git bisect run
# Правила: exit 0 = good, 1 = bad, 125 = skip, 128 = abort

set -u

# 1. Сначала защита от нерабочих коммитов (не могу даже запустить)
[ ! -f package.json ] && exit 125
npm install --silent > /dev/null 2>&1 || exit 125

# 2. Запускаем настоящий тест
if npm test > /tmp/bisect-test.log 2>&1; then
  exit 0   # good
else
  # Различаем «тест упал» vs «ошибка инфры»
  if grep -q "Test failed\|assert" /tmp/bisect-test.log; then
    exit 1   # bad — наша регрессия
  else
    exit 125 # skip — проблема не в нашем коде
  fi
fi
```

Плюс алиас в `~/.gitconfig`:

```ini
[alias]
    # bisect с автостартом от текущего HEAD
    bi = "!f() { git bisect start HEAD \"$1\" && git bisect run \"${2:-./.bisect-run.sh}\"; }; f"
```

Использование:
```bash
git bi HEAD~50                  # искать среди последних 50 коммитов
git bi v1.2.0                   # искать между тегом v1.2.0 и HEAD
git bi HEAD~50 ./my-test.sh     # свой тест-скрипт
```

---

## 📝 Документирование

Напишите в `NOTES.md` своего учебного репозитория:

1. **Вашими словами**: как bisect уменьшает 1000 коммитов до 10 шагов.
2. **Разницу `bad` / `good` / `skip`** — по одному предложению на каждый.
3. **Какой тест-скрипт вы напишете для своего проекта**: набросайте 5–10 строк.
4. **Ситуация из прошлого**: был ли случай, когда bisect помог бы? Сколько времени потратили руками?

---

## Мини-тест

1. В вашем проекте 512 коммитов между последним работающим тегом и сломанным HEAD. Сколько шагов bisect?
2. Какой exit-код должен вернуть тест-скрипт, если в текущем коммите не собирается зависимость (не от нашего кода)?
3. Почему плохая идея ставить `bad` в начале истории и `good` в HEAD, если тест сейчас падает?
4. Чем отличается `git bisect reset` от `git bisect end`? (подсказка: вторая команда не существует)

Ответы — в конце поста.

---

## Что дальше

- **[День 7](/posts/git-cherrypick-rerere/)** → cherry-pick + rerere: точечный перенос коммитов между ветками, и как Git запоминает, как вы решили конфликт, чтобы не решать его второй раз
- **[Challenge](/posts/git-master-final-challenge/)** → сломанный репозиторий с 10 проблемами. Задача P7 — регрессия в 20 коммитах, bisect найдёт её за 5 шагов
- **Системно с нуля** → «Курс молодого бойца» DevIT Academy

---

## Ответы на мини-тест

1. `log₂(512) = 9` шагов.
2. `exit 125` — «не могу протестировать». `bad` было бы ложным — регрессии в нашем коде нет.
3. `bad` и `good` — это про **поведение теста**, а не про «свежесть» коммита. `good` значит «тест проходит», `bad` — «тест падает». В начале истории, скорее всего, теста ещё нет или он проходит — это `good`. Путают направление, когда думают, что `good` = «старый коммит». Git не знает времени — он знает тест.
4. `git bisect reset` возвращает HEAD к исходной ветке и чистит состояние. Команды `git bisect end` нет — это типичная ошибка памяти. Если видите в чужом скрипте — это баг.
