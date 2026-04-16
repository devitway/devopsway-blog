---
title: "День 8: worktree — две ветки в двух каталогах, один репозиторий"
date: 2026-04-16T11:00:00+03:00
lastmod: 2026-04-16T11:00:00+03:00
draft: false
weight: 9
categories: ["DevOps основы"]
tags: ["git", "worktree", "parallel", "workflow"]
author: "DevOps Way"
description: "Как держать открытыми одновременно feature и hotfix ветку в разных каталогах, не трогая git stash и git checkout. Одно хранилище .git, несколько рабочих деревьев."
canonical: ""
series: "Git Mastery"
aliases:
  - /posts/day-09-git/
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

После урока вы **умеете** создавать параллельные рабочие деревья через `git worktree`, держать в них разные ветки одновременно, убирать их и чистить мёртвые ссылки через `prune`. Понимаете, что объекты и refs лежат в одном `.git/`, а `HEAD` и `index` — своё для каждого дерева.

| Параметр | Значение |
|----------|----------|
| Bloom | Применение, Анализ |
| SFIA | Уровень 2–3 |
| Время | 25–35 минут |
| Артефакт | Алиасы `wta`/`wtl`/`wtr` + конвенция `~/code/<repo>/` + `<repo>-<ветка>/` |
| Проверка | Мини-тест + параллельная работа feature + hotfix без `stash` |

---

## Теория за 3 минуты

Обычный репозиторий выглядит так: один каталог `my-repo/`, внутри `.git/` с объектами и refs, рядом ваши файлы. В каждый момент времени checked out **одна ветка** — это ваш `HEAD`.

`git worktree` снимает это ограничение. Вы можете дополнительно выдать **отдельный каталог** (рабочее дерево), который использует **тот же `.git/`**, но держит **свой HEAD** и **свой index**. В этом каталоге — другая ветка.

Что общее: объекты (`.git/objects/`), refs (`.git/refs/`), конфиг. Что раздельное: `HEAD`, `index`, stage, working copy.

Физически служебные файлы дополнительных worktrees лежат в `.git/worktrees/<name>/` главной репы. Поэтому `worktree add` дешёвый — не клонирует объекты заново.

**Главный случай применения:** срочный hotfix в `main`, когда у вас в основном каталоге грязная `feature/X` с 20 правками. Без worktree — `git stash`, `checkout main`, пишешь hotfix, `checkout feature`, `stash pop`. С worktree — соседний каталог, отдельное IDE-окно, оба состояния живы параллельно.

**Ограничение:** одна ветка не может быть checked out сразу в двух worktree (Git защищается). Нужна либо другая ветка, либо `--force`, либо `--detach`.

---

## Практика 1: параллельный hotfix без stash

### Шаг 1. Собираем репо с начатой feature

```bash
mkdir -p demo-wt && cd demo-wt
git init -q
git config user.email s@e.com
git config user.name Student

echo "v1" > app.txt && git add . && git commit -q -m "feat: initial"

git checkout -q -b feature/profile
echo "// profile WIP" > profile.js
git add profile.js
# СТАРТОВАЛИ feature, но не дошли до коммита — index грязный
git status
```

В основном каталоге висит незакоммиченный `profile.js`. В классической схеме вы бы сейчас делали `git stash`, чтобы пойти чинить `main`.

### Шаг 2. Добавляем worktree под hotfix

```bash
# вернуться в parent, потому что worktree add требует path вне текущего
cd ..
git -C demo-wt worktree add ./demo-wt-hotfix -b hotfix/login main
```

Команда:
- создала соседний каталог `demo-wt-hotfix/`
- в нём HEAD указывает на новую ветку `hotfix/login`, которая отходит от `main`
- в основном `demo-wt/` ничего не поменялось — там по-прежнему `feature/profile` + грязный index

Проверьте:

```bash
cd demo-wt-hotfix
git status            # on branch hotfix/login, clean
ls                    # app.txt — копия файлов main, без profile.js
```

### Шаг 3. Делаем hotfix параллельно

```bash
# пишем hotfix в соседнем каталоге
echo "v1 + hotfix" > app.txt
git add . && git commit -q -m "fix: urgent login"
git push -q 2>/dev/null || true   # если бы был remote

# возвращаемся в основной — всё на месте
cd ../demo-wt
git status            # всё ещё feature/profile с грязным profile.js
cat profile.js        # содержимое сохранилось
```

Мы только что сделали hotfix, не трогая feature-ветку и не теряя WIP-правки. Оба каталога — валидные git-репозитории на один `.git/`.

### Шаг 4. Убираем worktree, когда закончили

```bash
cd ..
git -C demo-wt worktree list
# /path/demo-wt          <sha> [feature/profile]
# /path/demo-wt-hotfix   <sha> [hotfix/login]

git -C demo-wt worktree remove ./demo-wt-hotfix
git -C demo-wt worktree list
# остался только главный
```

`worktree remove` требует **чистое дерево** (как и любой безопасный git). Если там грязь — закоммитьте или `remove --force`.

---

## Практика 2: review чужого PR в отдельном каталоге

Типичная задача — быстро прокликать чей-то PR, запустить его тесты, сходить в код, и вернуться к своей работе. Без worktree — опять stash-дэнс.

```bash
cd demo-wt
# создаём worktree, привязанный к ветке review (имитация чужого PR)
git checkout -q -b other-pr main
echo "// PR content" > pr.txt && git add . && git commit -q -m "feat: pr content"
git checkout -q feature/profile

cd ..
git -C demo-wt worktree add ./demo-wt-review other-pr
```

Теперь:
- в `demo-wt/` вы на `feature/profile`
- в `demo-wt-review/` — код ветки `other-pr`, можно открыть в отдельной IDE-вкладке, запустить тесты, посмотреть diff

```bash
cd demo-wt-review
ls                    # виден pr.txt
git log --oneline -1
```

Закончили — убираем:

```bash
cd ..
git -C demo-wt worktree remove ./demo-wt-review
```

**Частая ошибка:** попытка добавить worktree с уже checked-out веткой:

```bash
git -C demo-wt worktree add ./another feature/profile
# fatal: 'feature/profile' is already checked out at '/path/demo-wt'
```

Решения: новая ветка (`-b name`), `--detach` (анонимный HEAD на том же коммите), либо `--force` (рискованно — index начнёт расходиться, Git не гарантирует согласованность).

---

## Практика 3: `worktree prune` и зачем он нужен

Если вы удалите каталог worktree **руками** (без `git worktree remove`), в `.git/worktrees/` останется осиротевшая запись.

```bash
cd demo-wt
git worktree add ../tmp-wt -b throwaway
rm -rf ../tmp-wt                       # удалили каталог напрямую
git worktree list                      # запись всё ещё показывается, но "prunable"
git worktree prune --verbose           # чистит осиротевшие
git worktree list                      # остался только main
```

`worktree prune` — garbage collector для worktree-ссылок. Запускается автоматически при `git gc`, вручную нужен когда вы хотите немедленно освободить имена веток и слоты.

### Когда нужен `worktree lock`

Если ваше дерево живёт на съёмном диске или в сетевом каталоге, который иногда отключается, Git может посчитать его «prunable» в момент недоступности. Защита:

```bash
git worktree add ../external-wt -b research
git worktree lock ../external-wt --reason "research на внешнем HDD"
# теперь prune его не тронет, даже если каталог временно пропал
git worktree unlock ../external-wt     # когда хотите снять защиту
```

---

## Артефакт: алиасы и конвенция каталогов

Конвенция, которую удобно держать во всех репозиториях:

```
~/code/
├── myrepo/                  ← главный каталог, в нём обычно main или текущая feature
├── myrepo-hotfix/           ← worktree для срочных фиксов
└── myrepo-review/           ← worktree для чужих PR
```

Алиасы в `~/.gitconfig`:

```ini
[alias]
    # короткие worktree-операции
    wt  = worktree
    wta = worktree add
    wtl = worktree list
    wtr = worktree remove

    # добавить worktree рядом с текущим репо: git wth hotfix/login main
    # создаст ../$(basename pwd)-<ветка>/
    wth = "!f() { \
      repo=$(basename $(pwd)); \
      branch=$1; base=${2:-main}; \
      short=$(echo $branch | tr '/' '-'); \
      git worktree add \"../${repo}-${short}\" -b \"$branch\" \"$base\"; \
    }; f"
```

Использование:

```bash
cd ~/code/myrepo
git wth hotfix/login             # создаст ~/code/myrepo-hotfix-login с веткой hotfix/login от main
git wth review/pr-42 origin/main # review чужого PR от текущего main на remote
git wtl                          # посмотреть все активные
git wtr ../myrepo-hotfix-login   # убрать когда закончили
```

---

## Когда НЕ нужен worktree

- Проект маленький, ветки короткие, `stash` справляется → не плодите каталоги.
- Сборка тяжёлая и требует каталог-специфичного `node_modules` / `target/` на каждый worktree — диск съест. В таком случае иногда выгоднее один каталог + `stash`.
- CI-контейнер, который клонирует репо в чистый каталог на каждый запуск — worktree там не нужен.

Правило: worktree хорош для **долгоживущих параллельных контекстов локально**. Если контекст short-lived и лёгкий — `stash` проще.

---

## 📝 Документирование

Напишите в `NOTES.md` учебного репозитория:

1. **Своими словами**: что общего у двух worktree и что своё у каждого.
2. **Пример из вашей работы** — случай, где worktree сэкономил бы переключение: какая была грязная ветка, куда пришлось бы stash'ить, сколько времени ушло.
3. **Когда НЕ стоит** — одна причина против worktree из вашего контекста.
4. **Ваша конвенция каталогов** — как вы назовёте hotfix / review worktrees в своих проектах.

---

## Мини-тест

1. Вы на `feature/X`, index грязный. Что произойдёт, если сделать `git worktree add ../hot feature/X`? Какой флаг позволит обойти это?
2. Где физически живут `HEAD` и `index` второго worktree?
3. Что такое «prunable» worktree и когда нужен `worktree prune`?
4. Зачем `worktree lock` и в каком сценарии без него вы потеряете ссылку?

Ответы — в конце.

---

## Что дальше

- **Challenge** → `docker run devitway/git-challenge`: там есть задача «разрулить параллельно hotfix и feature без потери правок» — worktree решает её в два шага.
- **Системно с нуля** → «Курс молодого бойца» DevIT Academy — git в рабочем потоке, не как набор команд.

---

## Ответы на мини-тест

1. Git откажется: `'feature/X' is already checked out at <path>`. Обойти — новой веткой (`-b feature/X-parallel`), `--detach` (анонимный HEAD на том же коммите без ветки) или `--force` (не рекомендуется — index обоих деревьев может разойтись).
2. В `.git/worktrees/<name>/` главной репы. Там лежат `HEAD`, `index`, `gitdir` (указатель на путь к каталогу дерева). Объекты и refs — общие, в главном `.git/`.
3. «Prunable» — worktree, каталог которого уже удалён на диске, но запись в `.git/worktrees/` осталась. `worktree prune` удаляет такие записи, освобождая имена веток и слоты. Запускается вручную или автоматически при `git gc`.
4. Если worktree на съёмном диске или сетевом каталоге — в момент отключения Git сочтёт его prunable и может подчистить. `worktree lock` говорит «этот worktree не мёртв, не трогать», даже если сейчас недоступен.
