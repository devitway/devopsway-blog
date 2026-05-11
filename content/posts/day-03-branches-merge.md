---
title: "День 3: ветки и merge — fast-forward против --no-ff"
date: 2026-04-16T16:00:00+03:00
lastmod: 2026-04-16T16:00:00+03:00
draft: false
weight: 4
categories: ["DevOps основы"]
tags: ["git", "branch", "merge", "conflicts", "workflow"]
author: "DevOps Way"
description: "Как работают ветки: указатель на коммит. Два способа слить feature в main — fast-forward и --no-ff. Чтение git log --graph. Решение merge-конфликтов через diff3."
canonical: ""
series: "Git Mastery"
aliases:
  - /posts/day-03-git/
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

После урока вы **умеете** создать feature-ветку и слить её в main двумя разными способами (fast-forward и `--no-ff`), читаете `git log --graph`, понимаете разницу между тремя стратегиями merge (ff / no-ff / squash) и решаете merge-конфликт по маркерам `<<<<<<< ======= >>>>>>>`.

| Параметр | Значение |
|----------|----------|
| Bloom | Применение |
| SFIA | Уровень 3 |
| Время | 40 минут |
| Артефакт | `~/.gitconfig` с `merge.ff = false`, `merge.conflictStyle = diff3`, alias `graph` |
| Проверка | `git log --graph` показывает два merge-коммита с разной формой; конфликт решён |

---

## Теория за 3 минуты

**Ветка** в Git — это **указатель на коммит**. Не копия, не папка, не «параллельный мир». Одна строчка в файле `.git/refs/heads/main` с SHA.

```
main ──●──●──●──●   ← указатель main = последний коммит
                ↑
             HEAD = main
```

`git checkout -b feature` создаёт ещё один указатель на тот же коммит:

```
main ──●──●──●──●   ← main
                  ↑
                feature
```

Делаем коммит в feature — и её указатель уходит вперёд, а main остаётся на месте:

```
main ──●──●──●──●   ← main
                ↘
                 ●──●   ← feature
```

**`git merge feature`** в main — это **соединить две линии обратно** в одну. У Git два способа это сделать, и они дают **разную историю**. Это и есть весь урок.

**Главная мысль:** ветка — не копия файлов, а **указатель**. Переключение веток дёшево, потому что Git не копирует — он просто меняет, куда смотрит HEAD.

---

## Практика 1: fast-forward merge

### Шаг 1. Готовим main

```bash
mkdir -p /tmp/demo-ff && cd /tmp/demo-ff
git init -q
git config user.name Student
git config user.email student@example.com

echo "v1" > app.txt
git add . && git commit -q -m "feat: initial"
```

### Шаг 2. Создаём feature, делаем пару коммитов

```bash
git checkout -q -b feature/login
echo "login form" > login.txt
git add . && git commit -q -m "feat(login): add form"

echo "login validation" >> login.txt
git add . && git commit -q -m "feat(login): add validation"

git log --oneline
```

Вывод:
```
def5678 feat(login): add validation
abc1234 feat(login): add form
0123456 feat: initial
```

Три коммита, все на ветке feature/login. Main всё ещё на `feat: initial`.

### Шаг 3. Merge с fast-forward (по умолчанию)

```bash
git checkout -q main
git merge feature/login
```

Вывод:
```
Updating 0123456..def5678
Fast-forward
 login.txt | 2 ++
 1 file changed, 2 insertions(+)
```

Смотрим граф:

```bash
git log --graph --oneline
```

Вывод:
```
* def5678 feat(login): add validation
* abc1234 feat(login): add form
* 0123456 feat: initial
```

**Линейная история.** Feature-коммиты просто «достроились» к main. Git не создал merge-коммита — он просто **двинул указатель main вперёд**. Отсюда название: fast-forward.

**Вывод по ff:** дёшево, чисто, но **теряется информация** — через месяц вы не увидите, что `add form` и `add validation` были одной фичей, а не двумя отдельными коммитами в main.

---

## Практика 2: merge --no-ff сохраняет историю фичи

### Шаг 1. То же самое, но с другой ветки

```bash
mkdir -p /tmp/demo-noff && cd /tmp/demo-noff
git init -q
git config user.name Student
git config user.email student@example.com

echo "v1" > app.txt
git add . && git commit -q -m "feat: initial"

git checkout -q -b feature/logout
echo "logout form" > logout.txt
git add . && git commit -q -m "feat(logout): add button"

echo "logout confirmation" >> logout.txt
git add . && git commit -q -m "feat(logout): add confirmation dialog"
```

### Шаг 2. Merge с принудительным merge-коммитом

```bash
git checkout -q main
git merge --no-ff feature/logout -m "merge: feature/logout"
```

Вывод:
```
Merge made by the 'ort' strategy.
 logout.txt | 2 ++
 1 file changed, 2 insertions(+)
```

Смотрим граф:

```bash
git log --graph --oneline
```

Вывод:
```
*   9abc123 merge: feature/logout
|\
| * bbb2222 feat(logout): add confirmation dialog
| * aaa1111 feat(logout): add button
|/
* 0000000 feat: initial
```

**Видите разницу?** В графе остался «пузырёк» — два коммита ветки logout и точка слияния. Через полгода вы можете:
- Посмотреть, что входило в эту фичу: `git log 9abc123^1..9abc123^2` (коммиты между двумя родителями merge)
- Откатить **всю фичу одним revert'ом**: `git revert -m 1 9abc123`
- Понять, какой набор коммитов был релизом

**Вывод по --no-ff:** история длиннее, но вы **видите структуру**. Для команды это обычно сложнее для чтения, чем ff.

---

## Практика 3: когда ff работает, а когда нет

```bash
mkdir -p /tmp/demo-diverge && cd /tmp/demo-diverge
git init -q
git config user.name Student
git config user.email student@example.com

echo "v1" > shared.txt
git add . && git commit -q -m "feat: initial"

# создаём feature и делаем там коммит
git checkout -q -b feature/A
echo "A change" > a.txt
git add . && git commit -q -m "feat(A): add a.txt"

# параллельно в main тоже делаем коммит
git checkout -q main
echo "main change" > b.txt
git add . && git commit -q -m "feat(main): add b.txt"

git log --graph --oneline --all
```

Вывод:
```
* xxx feat(main): add b.txt
| * yyy feat(A): add a.txt
|/
* zzz feat: initial
```

Ветки **разошлись**. Теперь:

```bash
git merge feature/A
```

Git **не может** сделать fast-forward — указатель main нельзя просто подвинуть, потому что есть свой коммит. Git автоматически создаст **merge-коммит**, даже без флага `--no-ff`:

```
Merge made by the 'ort' strategy.
 a.txt | 1 +
 1 file changed, 1 insertion(+)
```

```bash
git log --graph --oneline
```

Вывод:
```
*   www merge: feature/A
|\
| * yyy feat(A): add a.txt
* | xxx feat(main): add b.txt
|/
* zzz feat: initial
```

**Вывод:** fast-forward возможен **только когда main не двинулся** с момента создания фичи. Как только появляются параллельные коммиты — merge-коммит неизбежен.

---

## Практика 4: merge-конфликт и как его решать

### Шаг 1. Готовим конфликт нарочно

```bash
mkdir -p /tmp/demo-conflict && cd /tmp/demo-conflict
git init -q
git config user.name Student
git config user.email student@example.com
git config merge.conflictStyle diff3

cat > config.json << 'EOF'
{
  "timeout": 30,
  "retries": 3
}
EOF
git add . && git commit -q -m "feat: initial config"

# ветка feature/A меняет timeout
git checkout -q -b feature/timeout
sed -i 's/"timeout": 30/"timeout": 60/' config.json
git add . && git commit -q -m "feat(config): increase timeout to 60"

# на main ту же строку меняют по-другому
git checkout -q main
sed -i 's/"timeout": 30/"timeout": 10/' config.json
git add . && git commit -q -m "feat(config): decrease timeout to 10"
```

Два коммита изменяют **одну и ту же строку** разными значениями — классический конфликт.

### Шаг 2. Пытаемся слить

```bash
git merge feature/timeout
```

Вывод:
```
Auto-merging config.json
CONFLICT (content): Merge conflict in config.json
Automatic merge failed; fix conflicts and then commit the result.
```

Смотрим `config.json`:

```bash
cat config.json
```

Вывод (с `diff3`-стилем, потому что мы его настроили):
```
{
<<<<<<< HEAD
  "timeout": 10,
||||||| parent
  "timeout": 30,
=======
  "timeout": 60,
>>>>>>> feature/timeout
  "retries": 3
}
```

Три секции:
- **`<<<<<<< HEAD` → `|||||||`** — что у вас в main
- **`||||||| parent` → `=======`** — что было в общем предке (`diff3` style)
- **`=======` → `>>>>>>> feature/timeout`** — что пришло из фичи

Без `diff3` (по умолчанию) — только две секции, без «как было изначально». `diff3` даёт вам третье измерение: **вы видите, что правили от какого начала**.

### Шаг 3. Решаем конфликт и коммитим

Решение — оставить одно значение (например, компромиссное `30`):

```bash
cat > config.json << 'EOF'
{
  "timeout": 30,
  "retries": 3
}
EOF

git add config.json
git merge --continue
```

Или если хотим отменить merge и обдумать:

```bash
git merge --abort    # возврат к до-merge состоянию, безопасно
```

---

## Артефакт: `.gitconfig` с настройками по умолчанию

```bash
# конфликты с diff3 (три секции вместо двух)
git config --global merge.conflictStyle diff3

# по умолчанию НЕ делать fast-forward в merge (требовать явного флага)
git config --global merge.ff false
git config --global pull.ff only

# удобный алиас для чтения графа
git config --global alias.graph "log --all --graph --decorate --oneline"
git config --global alias.br "branch -vv"
```

Проверка:

```bash
git graph                # граф всех веток
git br                   # ветки + какие отстают/опережают remote
```

**Почему `merge.ff = false` по умолчанию:** в чистом ff-режиме через год вы не восстановите структуру — какие коммиты были релизом, какие хотфиксом. `--no-ff` даёт читаемую историю ценой одной лишней вершины.

**Почему `pull.ff = only`:** запрещает `git pull` создавать merge-коммит из remote-изменений. Если на main что-то прилетело — сначала `git pull --rebase` или `git fetch && git rebase`, а не автоматическое слияние.

---

## Три стратегии merge — когда какая

| Стратегия | Граф | Когда |
|-----------|------|-------|
| **fast-forward** (по умолчанию) | линейный | **Не использовать** для feature-веток в команде. ff стирает факт существования ветки |
| **`--no-ff`** | merge-коммит, «пузырёк» | **Default для feature-веток**. Видно структуру, легко откатить всю фичу через `revert -m` |
| **`--squash`** | один коммит | Фича = один большой коммит в main. Пропадает внутренняя история (хорошо для «мусорных» wip-коммитов, плохо для аудита) |

Команды в большинстве случаев берут **no-ff** как дефолт + squash для мелких PR'ов, которые не надо сохранять в истории.

---

## Частые ошибки

| Ошибка | Почему больно | Как не делать |
|--------|---------------|---------------|
| `git pull` без флага на общей ветке | Создаёт ненужные merge-коммиты из remote-сдвигов, граф засоряется | `pull.ff = only` + `git pull --rebase` когда нужно |
| Решили конфликт, забыли `git add` | `git merge --continue` падает с «nothing to commit» | После правки файла всегда `git add <файл>` |
| `git checkout -b` из чужой ветки вместо main | Ветка «висит» над чьей-то фичей, при merge в main конфликтов становится больше | `git checkout main && git pull && git checkout -b feature/X` |
| `git branch -D feature` до merge | Удаляет ветку, но коммиты остаются в reflog. Если reflog истёк — потеря | Сначала `git log feature..main`, убедиться что всё слилось |

---

## 📝 Документирование

Создайте `~/notes/day-03.md` и ответьте:

1. **Ветка — это не папка**: объясните своими словами, почему `git checkout` не копирует файлы.
2. **Разница ff и --no-ff**: одной строкой на каждый, плюс один критерий когда что выбирать.
3. **Ваша команда**: какой merge-стратегии у вас придерживаются? Если нет договора — предложите один.
4. **Конфликт**: вспомните последний merge-конфликт в своей практике. Что было общим предком? Что правили в main? Что в feature?

---

## Мини-тест

1. У вас ветка feature, на ней 3 коммита. В main с момента создания feature — ничего не менялось. Какой вид merge Git сделает по умолчанию? Какой коммит появится?
2. В прошлом сценарии вы сделали `git merge --no-ff feature`. Чем отличается граф?
3. Вы в середине конфликтного merge. В `config.json` три секции `<<<<<<<`/`|||||||`/`=======`/`>>>>>>>`. Что означает средняя секция (между `|||||||` и `=======`)?
4. Что произойдёт, если на полпути конфликтного merge сделать `git merge --abort`?

Ответы — в конце поста.

---

## Что дальше

- **День 4** → rebase vs merge: когда переписать историю линейно, когда сохранить ветвление. Плюс `rebase -i` для чистки коммитов перед PR
- **[Challenge](/posts/git-master-final-challenge/)** → сломанный репозиторий с 10 проблемами. Задача P3 — разобрать репо с 4 параллельными ветками и слепить читаемый граф
- **Системно с нуля** → «Курс молодого бойца» DevIT Academy, Git в Неделе 2

---

## Ответы на мини-тест

1. **Fast-forward**. Git просто подвинет указатель `main` на последний коммит feature. **Merge-коммита не будет** — история останется линейной, будто вы все три коммита сделали прямо в main.

2. Вместо одного линейного списка в графе появится «пузырёк»: merge-коммит на вершине, два родителя — прежний main и вершина feature. Видно, что три коммита шли одной веткой.

3. Это **версия из общего предка** (merge base) — тот коммит, от которого разошлись main и feature. В `diff3`-стиле Git показывает все три варианта, чтобы вы видели, **от какой отправной точки** делались обе правки, а не только конечные версии.

4. Git **полностью отменит merge** и вернёт репозиторий к состоянию до `git merge`. Рабочее дерево, индекс и HEAD — всё как было. Это безопасная кнопка «передумал».
