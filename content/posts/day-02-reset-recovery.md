---
title: "День 2: reflog и fsck — что спасает после git reset --hard, а что нет"
date: 2026-04-16T15:00:00+03:00
lastmod: 2026-04-16T15:00:00+03:00
draft: false
weight: 3
categories: ["DevOps основы"]
tags: ["git", "reflog", "fsck", "recovery", "reset"]
author: "DevOps Way"
description: "Честный разбор: когда reflog и fsck восстанавливают данные после git reset --hard, а когда уже ничего не сделать. Три состояния файла → три сценария восстановления. Защитные алиасы в ~/.gitconfig."
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

После урока вы **умеете** восстановить потерянный коммит через `git reflog`, восстановить staged-изменения через `git fsck --lost-found` и точно знаете, какие операции Git безвозвратно удаляют данные. Понимаете, как `reset --hard` действует на файл в каждом из трёх состояний (working / staging / committed).

| Параметр | Значение |
|----------|----------|
| Bloom | Применение, частично Анализ |
| SFIA | Уровень 2 |
| Время | 40–60 минут |
| Артефакт | `~/.gitconfig` с алиасами `safe-reset`, `recover-staged`, `tree`, `undo` |
| Проверка | Мини-тест + восстановление потерянного коммита за 2 команды |

---

## Теория: что такое «потеря данных» в Git

В Дне 1 вы видели три состояния — working / staging / committed. Сегодня смотрим на них **под углом reset'а**.

`git reset --hard HEAD` делает **три разные вещи одновременно**:

1. Сбрасывает **index** (staging) до состояния HEAD
2. Перезаписывает **tracked** файлы в working дереве до HEAD
3. **Untracked** файлы не трогает — остаются как есть

Отсюда таблица «что выживает»:

| Состояние файла | После `reset --hard` | Чем спасать |
|-----------------|----------------------|-------------|
| Untracked (не было `git add`) | Остаётся на диске | Никаких спасений не нужно |
| Modified (правки в working, без свежего `git add`) | **Откат к HEAD, правки потеряны** | Local History IDE, swap-файл, ничего |
| Staged (был `git add`, но нет `git commit`) | **Откат, но blob остался в object store** | `git fsck --lost-found` |
| Committed (был `git commit`) | Коммит «потерян», HEAD смотрит мимо | `git reflog` (90 дней) |

Эта таблица объясняет 90% случаев «я потерял код». Запомните её.

**Главная мысль:** Git защищает данные **после `git add`**. До `git add` вы полагаетесь на IDE / редактор / бэкап ФС. После `git add` у Git минимум один шанс вас спасти.

---

## Практика 1: reflog восстанавливает закоммиченное

### Шаг 1. Собираем демо-репозиторий

```bash
mkdir -p /tmp/demo-reflog && cd /tmp/demo-reflog
git init -q
git config user.name Student
git config user.email student@example.com

echo "console.log('v1')" > app.js
git add . && git commit -q -m "v1"

echo "console.log('v2')" > app.js
git add . && git commit -q -m "v2"

echo "console.log('v3')" > app.js
git add . && git commit -q -m "v3"

git log --oneline
```

Три коммита: `v1`, `v2`, `v3`.

### Шаг 2. «Катастрофа»

```bash
git reset --hard HEAD~2
git log --oneline
```

Вывод:
```
<sha> v1
```

v2 и v3 «исчезли». В `git log` их нет.

### Шаг 3. Восстановление через reflog

```bash
git reflog --date=iso
```

Вывод:
```
<sha1> HEAD@{0} reset: moving to HEAD~2
<sha3> HEAD@{1} commit: v3
<sha2> HEAD@{2} commit: v2
<sha1> HEAD@{3} commit (initial): v1
```

Reflog — это лог всех движений HEAD: коммиты, reset, checkout, rebase. Git держит его локально ~90 дней по умолчанию.

Возвращаемся на v3:

```bash
git reset --hard HEAD@{1}
git log --oneline
```

Вывод: `v3, v2, v1` — всё на месте.

**Вывод:** reflog спасает всё, что было **закоммичено**. Даже после `reset --hard` коммиты живы ~90 дней в object store.

---

## Практика 2: fsck восстанавливает staged, но не закоммиченное

### Шаг 1. Собираем

```bash
mkdir -p /tmp/demo-fsck && cd /tmp/demo-fsck
git init -q
git config user.name Student
git config user.email student@example.com

echo "v1" > file.txt
git add . && git commit -q -m "v1"

echo "v2-важная-правка" > file.txt
git add file.txt      # staged, но НЕ git commit
```

### Шаг 2. Катастрофа

```bash
git reset --hard HEAD
cat file.txt          # → v1, правка исчезла
```

Reflog здесь **не поможет** — коммита не было, HEAD не двигался к v2. Но `git add` уже создал **blob** в object store. Ищем:

### Шаг 3. Восстановление через fsck

```bash
git fsck --lost-found
```

Вывод:
```
Checking object directories: 100%, done.
dangling blob 7a2b1c3d4e5f...
```

Смотрим содержимое blob'а:

```bash
git cat-file -p $(git fsck --lost-found 2>/dev/null | awk '/dangling blob/{print $3}' | head -1)
```

Вывод: `v2-важная-правка`.

Возвращаем в файл:

```bash
BLOB=$(git fsck --lost-found 2>/dev/null | awk '/dangling blob/{print $3}' | head -1)
git cat-file -p "$BLOB" > file.txt
cat file.txt          # → v2-важная-правка
```

**Вывод:** fsck спасает всё, что попало в index через `git add`, даже если следом был `reset --hard`. Blob живёт ~14 дней до `git gc`.

---

## Практика 3: когда не спасёт никто

### Сценарий: 3 часа кода, ни одного `git add`

```bash
mkdir -p /tmp/demo-lost && cd /tmp/demo-lost
git init -q
git config user.name Student
git config user.email student@example.com

echo "initial" > file.txt
git add . && git commit -q -m "initial"

# три часа работы — только редактировали, ни разу git add
echo "3 часа моего кода" > file.txt

# случайный reset --hard
git reset --hard HEAD
cat file.txt          # → initial
```

Пробуем:

```bash
git reflog             # покажет только initial commit + reset operation
git fsck --lost-found  # dangling? ничего, blob не создавался
```

Ни reflog, ни fsck не помогут. Blob никогда не существовал.

Что остаётся:
- **Local History** в IDE (VSCode: Timeline, JetBrains: Local History, Vim: undo-persistence)
- **Swap-файл** редактора (`.swp`, `.vim/undo/`)
- **Резервные копии** файловой системы (Time Machine, rsync, ZFS snapshots)

**Это главный урок Дня 2:** Git защищает данные **после `git add`**. До `git add` вы вне его зоны ответственности.

---

## Артефакт: защитные алиасы в `~/.gitconfig`

Добавьте в `~/.gitconfig`:

```bash
git config --global alias.tree "log --all --graph --decorate --oneline"
git config --global alias.undo "reset --soft HEAD~1"
```

Два защитных алиаса сохраняем в файл (длинные):

```bash
cat >> ~/.gitconfig << 'EOF'

[alias]
    # reset --hard с подтверждением
    safe-reset = "!f() { \
        echo 'reset --hard уничтожит modified и staged изменения.'; \
        echo 'Сначала: git stash push -u (включая untracked).'; \
        read -p 'Продолжить? (yes/NO): ' c; \
        [ \"$c\" = yes ] && git reset --hard \"$@\"; \
    }; f"

    # восстановить все dangling blobs в .recovered/
    recover-staged = "!f() { \
        mkdir -p .recovered; \
        for b in $(git fsck --lost-found 2>/dev/null | awk '/dangling blob/{print $3}'); do \
            git cat-file -p $b > .recovered/$b.txt; \
        done; \
        echo \"Восстановлено в .recovered/\"; \
        ls .recovered; \
    }; f"
EOF
```

Использование:

```bash
git tree                # граф всех веток и коммитов
git undo                # откатить последний коммит (staged остаётся)
git safe-reset HEAD     # reset --hard с подтверждением
git recover-staged      # вытащить всё из dangling blobs
```

`git undo` = `reset --soft HEAD~1` — возвращает staging к состоянию «до коммита», файлы остаются. Это то, что вам нужно в 90% случаев «я закоммитил слишком рано».

`git safe-reset` добавляет паузу перед `reset --hard`. Секунды размышлений vs часы восстановления.

---

## Частые ошибки

| Ошибка | Почему больно | Как не делать |
|--------|---------------|---------------|
| `git reset --hard` на чужой ветке после pull | Теряете локальные коммиты. Reflog HEAD покажет предыдущее состояние, но только если вы знаете, что искать, и до истечения `gc.reflogExpire` (90 дней) | Перед reset — `git status`, `git stash push -u` |
| `git clean -fd` следом за reset | Удаляет **untracked** файлы — те самые, которые reset --hard пощадил. Ничто не спасёт | Сначала `git stash -u`, потом clean |
| `git gc --prune=now` сразу после катастрофы | Выкидывает dangling blobs до того, как вы их нашли | Не трогайте gc, пока не решена проблема |
| «Я делал правки, Git их съел» без `git add` | Правки не были в Git — нечего восстанавливать | IDE Local History / swap / ФС-бэкапы |

---

## 📝 Документирование

Создайте `~/notes/day-02.md` и ответьте:

1. **Три состояния под углом reset'а**: что выживает, что нет — одной таблицей.
2. **Разница reflog vs fsck**: по одному предложению на каждый.
3. **Ваш случай из практики**: теряли ли код? В каком состоянии был файл, как спаслись (или не спаслись)?
4. **Какой алиас вы поставите первым** в свой `~/.gitconfig` и почему?

---

## Мини-тест

1. Вы сделали 2 коммита, потом `git reset --hard HEAD~2`. Какой командой вернуть оба коммита?
2. Вы сделали `git add file.txt`, но не `git commit`. Потом `git reset --hard`. Где искать содержимое `file.txt`?
3. Вы час редактировали `.env`, ни разу не делали `git add`. Потом `git reset --hard`. Что покажет reflog? Что покажет fsck?
4. Вы сделали `git reset --soft HEAD~1`. Пропали ли правки из staging? А из working?

Ответы — в конце поста.

---

## Что дальше

- **День 3** → ветки и merge: когда fast-forward, когда `--no-ff`, как читать `git log --graph`
- **[Challenge](/posts/git-master-final-challenge/)** → сломанный репозиторий с 10 проблемами. Задача P2 — dangling blob без подсказок, найдёте за 2 команды
- **Системно с нуля** → «Курс молодого бойца» DevIT Academy, Git разбираем в Неделе 2

---

## Ответы на мини-тест

1. `git reflog` → найти нужный `HEAD@{N}` → `git reset --hard HEAD@{N}`. Reflog покажет всю историю движений HEAD за последние ~90 дней.

2. `git fsck --lost-found` → скопировать SHA из `dangling blob <sha>` → `git cat-file -p <sha>`. Blob живёт в object store ~14 дней до `git gc`.

3. Reflog покажет только операцию `reset: moving to HEAD` и initial commit — содержимого `.env` в reflog нет. Fsck не покажет ничего — blob никогда не создавался, потому что не было `git add`. **Данные потеряны навсегда**. Искать: Local History IDE, swap-файл редактора, ФС-бэкап.

4. `git reset --soft HEAD~1` откатывает **только HEAD**, не трогая index и working. Правки **остаются в staging** (`git status` покажет их как «to be committed»). Working тоже не меняется. Это безопасный способ «отменить последний коммит, чтобы переделать сообщение или перегруппировать файлы».
