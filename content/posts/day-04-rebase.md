---
title: "День 4: rebase vs merge — когда переписать историю, когда сохранить"
date: 2026-04-16T17:00:00+03:00
lastmod: 2026-04-16T17:00:00+03:00
draft: false
weight: 5
categories: ["DevOps основы"]
tags: ["git", "rebase", "merge", "history", "interactive"]
author: "DevOps Way"
description: "Как rebase переставляет коммиты вместо слияния. Линейная история vs merge-пузыри. Interactive rebase для чистки коммитов перед PR. Золотое правило: не ребейсить публичные ветки."
canonical: ""
series: "Git Mastery"
aliases:
  - /posts/day-04-git/
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

После урока вы **умеете** перестроить feature-ветку поверх свежего `main` через `git rebase`, понимаете разницу между rebase и merge на уровне графа, используете `rebase -i` для чистки коммитов перед PR (squash / reword / drop) и знаете **золотое правило**: не ребейсить то, что уже запушено в публичную ветку.

| Параметр | Значение |
|----------|----------|
| Bloom | Применение, частично Анализ |
| SFIA | Уровень 3 |
| Время | 45 минут |
| Артефакт | `~/.gitconfig` с `pull.rebase = true`, `rebase.autoStash = true`, alias `rb`, `rbi` |
| Проверка | Feature-ветка успешно ребейзнута поверх main; `git log --graph` показывает линейную историю |

---

## Теория: rebase — это не merge

`git merge` **соединяет** две ветки merge-коммитом, сохраняя факт ветвления:

```
main ──●──●──●──●────●   ← merge-коммит
           \         /
            ●──●──●   (feature)
```

`git rebase` **переносит** коммиты фичи поверх нового базового коммита, как если бы вы начали фичу только что:

```
До rebase:
main ──●──●──●──●       (feature отставала)
           \
            ●──●──●   (feature)

После rebase:
main ──●──●──●──●──●'──●'──●'   (feature "переписана" на новое основание)
```

Важно: коммиты **`●'`** — это **новые** коммиты с новыми SHA. Старые `●` остались в reflog и в object store, но ветка `feature` теперь указывает на новые.

**Главная мысль:** rebase не «двигает» коммиты. Он **создаёт новые** копии поверх новой базы. Старые SHA становятся orphan. Отсюда все правила и ограничения.

---

## Практика 1: простой rebase

### Шаг 1. Создаём разошедшиеся ветки

```bash
mkdir -p /tmp/demo-rebase && cd /tmp/demo-rebase
git init -q -b main
git config user.name Student
git config user.email student@example.com

echo "v1" > app.txt
git add . && git commit -q -m "feat: initial"

git checkout -q -b feature/profile
echo "profile page" > profile.txt
git add . && git commit -q -m "feat(profile): add page"
echo "profile css" >> profile.txt
git add . && git commit -q -m "style(profile): add styles"

# параллельно в main прилетел хотфикс
git checkout -q main
echo "hotfix" >> app.txt
git add . && git commit -q -m "fix: urgent hotfix"

git log --all --graph --oneline
```

Вывод:
```
* xxx fix: urgent hotfix
| * yyy style(profile): add styles
| * zzz feat(profile): add page
|/
* www feat: initial
```

Ветки разошлись — классическая ситуация для выбора: merge или rebase.

### Шаг 2. Rebase feature поверх main

```bash
git checkout -q feature/profile
git rebase main
```

Вывод:
```
Successfully rebased and updated refs/heads/feature/profile.
```

Смотрим граф:

```bash
git log --all --graph --oneline
```

Вывод:
```
* aaa style(profile): add styles
* bbb feat(profile): add page
* xxx fix: urgent hotfix
* www feat: initial
```

**Линейная история.** Два коммита фичи теперь идут **после** хотфикса, как если бы вы писали фичу уже с учётом хотфикса. Merge-коммита нет.

### Шаг 3. Merge feature в main — fast-forward

```bash
git checkout -q main
git merge feature/profile
git log --graph --oneline
```

Вывод:
```
* aaa style(profile): add styles
* bbb feat(profile): add page
* xxx fix: urgent hotfix
* www feat: initial
```

Fast-forward возможен, потому что после rebase ветка feature «дотянулась» до main линейно. Merge просто подвинул указатель.

**Итог:** rebase + ff merge = совершенно линейная история. Это то, что любят сторонники «чистого git log».

---

## Практика 2: тот же сценарий через merge

Для сравнения — то же самое, но без rebase:

```bash
mkdir -p /tmp/demo-merge-vs && cd /tmp/demo-merge-vs
git init -q -b main
git config user.name Student
git config user.email student@example.com

echo "v1" > app.txt && git add . && git commit -q -m "feat: initial"
git checkout -q -b feature/profile
echo "profile page" > profile.txt && git add . && git commit -q -m "feat(profile): add page"
echo "profile css" >> profile.txt && git add . && git commit -q -m "style(profile): add styles"
git checkout -q main
echo "hotfix" >> app.txt && git add . && git commit -q -m "fix: urgent hotfix"

git merge --no-ff feature/profile -m "merge: feature/profile"
git log --graph --oneline
```

Вывод:
```
*   mmm merge: feature/profile
|\
| * yyy style(profile): add styles
| * zzz feat(profile): add page
* | xxx fix: urgent hotfix
|/
* www feat: initial
```

**Граф «с развилкой».** Видно, что фича шла параллельно хотфиксу. История сложнее, но **честнее** — в ней виден реальный ход разработки.

---

## Rebase vs merge — когда какой

| Критерий | rebase | merge |
|----------|--------|-------|
| История | линейная | «с развилками» |
| Видна структура фичи | нет, коммиты выглядят как прямая линия | да, фича = «пузырь» |
| `git bisect` | проще (линейный обход) | чуть сложнее (надо учитывать merge-коммиты) |
| Revert фичи | `revert` каждого коммита отдельно | `revert -m 1` одним движением |
| Работа с публичной веткой | **ЗАПРЕЩЕНО** (правило №1 ниже) | безопасно |
| Конфликты | решать **по каждому коммиту** | один раз в merge-коммите |

**Практическое правило команды:**
- **Пока фича живёт локально** → ребейсите её поверх `main` регулярно, чтобы уменьшить конфликты перед PR
- **При мёрдже в main** → `--no-ff merge` (читаемая история релизов) ИЛИ ff после rebase (если команда держит линейную)

Смесь подходов тоже работает — главное договориться. Худшее — когда половина команды ребейсит, а половина мёрджит **ту же ветку**.

---

## Практика 3: золотое правило — не ребейсить публичную ветку

### Почему это опасно

```bash
mkdir -p /tmp/demo-forbidden && cd /tmp/demo-forbidden
git init -q --bare remote.git

git clone -q ./remote.git workA
cd workA
git config user.name A; git config user.email a@e.com
echo "v1" > f.txt && git add . && git commit -q -m "v1"
echo "v2" >> f.txt && git add . && git commit -q -m "v2"
echo "v3" >> f.txt && git add . && git commit -q -m "v3"
git push -q origin main

# коллега клонирует
cd ..
git clone -q ./remote.git workB
cd workB && git log --oneline
```

Коллега видит те же `v1 v2 v3`. Теперь вы **переписываете историю**:

```bash
cd ../workA
git rebase -i HEAD~3   # (в интерактивном редакторе — squash или reword)
# предположим, вы объединили всё в один коммит v1-2-3
git push --force origin main       # ← КАТАСТРОФА
```

Теперь в `workB`:

```bash
cd ../workB
git pull origin main
```

Git **не сможет** сделать ff — история разошлась. Коллега либо получит merge-коммит «поверх» ваших переписанных SHA, либо у него поломается ветка. Если он в этот момент уже делал свою работу на `v3` — она повиснет на orphan-коммитах.

**Правило №1:** `git rebase` можно делать **только** с коммитами, которых ещё никто не видел (не запушены или запушены только в вашу feature-ветку, куда больше никто не коммитит).

Если всё же надо переписать публичную ветку — минимум: `git push --force-with-lease` (safer чем `--force`), предупредить команду в чате, команда делает `git fetch && git reset --hard origin/branch`.

---

## Практика 4: `rebase -i` — чистим коммиты перед PR

Часто во время работы остаётся мусор: `wip`, `fix typo`, `forgot semicolon`. Перед созданием PR это надо причесать.

### Шаг 1. Готовим «грязную» ветку

```bash
mkdir -p /tmp/demo-rbi && cd /tmp/demo-rbi
git init -q -b main
git config user.name Student
git config user.email student@example.com

echo "base" > app.js && git add . && git commit -q -m "feat: initial"

git checkout -q -b feature/cart
echo "cart v1" > cart.js && git add . && git commit -q -m "wip: start cart"
echo "cart v2" >> cart.js && git add . && git commit -q -m "fix typo"
echo "cart v3" >> cart.js && git add . && git commit -q -m "feat(cart): add cart logic"
echo "// comment" >> cart.js && git add . && git commit -q -m "comment"

git log --oneline
```

Вывод:
```
aaaa comment
bbbb feat(cart): add cart logic
cccc fix typo
dddd wip: start cart
xxxx feat: initial
```

Четыре коммита, из которых один нормальный (`feat(cart): add cart logic`), остальные — мусор.

### Шаг 2. Запускаем `rebase -i`

```bash
git rebase -i HEAD~4
```

Открывается редактор:

```
pick dddd wip: start cart
pick cccc fix typo
pick bbbb feat(cart): add cart logic
pick aaaa comment
```

Заменяем на:

```
pick    dddd wip: start cart
squash  cccc fix typo
squash  bbbb feat(cart): add cart logic
squash  aaaa comment
```

- **pick** — оставить коммит как есть
- **squash** (или `s`) — объединить с предыдущим
- **fixup** (или `f`) — то же самое, но выбросить сообщение этого коммита
- **reword** (или `r`) — оставить коммит, но переписать сообщение
- **drop** (или `d`) — выкинуть коммит вообще

Сохраняем. Git откроет ещё один редактор для итогового сообщения — пишем осмысленно:

```
feat(cart): add cart logic with basic UI
```

Результат:

```bash
git log --oneline
```

Вывод:
```
yyyy feat(cart): add cart logic with basic UI
xxxx feat: initial
```

Четыре грязных коммита превратились в один чистый — ровно то, что должно попасть в main.

**Практика**: `rebase -i` делайте **перед** `git push`. Если запушили — не трогайте.

---

## Практика 5: конфликты при rebase

Rebase решает конфликты **поэтапно** — коммит за коммитом, а не одним махом как merge. Это и плюс (видно, какой коммит вызвал конфликт), и минус (если 10 коммитов — может потребоваться 10 раундов).

```bash
mkdir -p /tmp/demo-rb-conflict && cd /tmp/demo-rb-conflict
git init -q -b main
git config user.name Student; git config user.email s@e.com
git config merge.conflictStyle diff3

echo "version: 1.0" > version.txt
git add . && git commit -q -m "v1.0"

git checkout -q -b feature/bump
sed -i 's/1.0/1.1/' version.txt
git add . && git commit -q -m "bump: 1.1"
sed -i 's/1.1/1.2/' version.txt
git add . && git commit -q -m "bump: 1.2"

git checkout -q main
sed -i 's/1.0/2.0/' version.txt   # breaking change на main
git add . && git commit -q -m "bump: 2.0 (breaking)"

git checkout -q feature/bump
git rebase main
```

Rebase остановится на первом конфликтующем коммите:

```
CONFLICT (content): Merge conflict in version.txt
error: could not apply ...
Resolve all conflicts manually, mark them as resolved with "git add"...
```

Решаем:

```bash
cat version.txt            # видим <<<<<<< и >>>>>>> маркеры
echo "version: 2.1" > version.txt
git add version.txt
git rebase --continue
```

Если коммитов несколько — rebase может остановиться снова на следующем. Повторяем. Если передумали:

```bash
git rebase --abort          # откатиться в состояние до rebase, безопасно
```

---

## Артефакт: `.gitconfig` для rebase-friendly workflow

```bash
# pull должен делать rebase по умолчанию, не merge-коммит
git config --global pull.rebase true

# автоматически делать stash перед rebase если есть незакоммиченные правки
git config --global rebase.autoStash true

# алиасы для частых операций
git config --global alias.rb "rebase"
git config --global alias.rbi "rebase -i"
git config --global alias.rbc "rebase --continue"
git config --global alias.rba "rebase --abort"
```

Использование:

```bash
git rb main              # ребейзнуть текущую ветку поверх main
git rbi HEAD~5           # интерактивный rebase последних 5 коммитов
git rbc                  # продолжить после решения конфликта
git rba                  # отменить rebase
```

`pull.rebase = true` — это решение: когда на main прилетели чужие коммиты, ваш `git pull` будет **перестраивать** вашу работу поверх них, а не создавать ненужный merge-коммит. Для feature-веток это обычно правильно.

---

## Частые ошибки

| Ошибка | Почему больно | Как не делать |
|--------|---------------|---------------|
| `git push --force` на общую ветку после rebase | Переписывает историю у всех в команде, кто уже вытянул старые SHA | Только `--force-with-lease` + предупреждение в чате, либо **вообще не ребейсить публичные ветки** |
| `rebase -i` на уже запушенную ветку | Те же разошедшиеся ветки у коллег | Делать `rebase -i` **до** `git push` |
| Rebase без решения всех конфликтов, потом `--continue` | `git rebase --continue` падает: «unmerged paths» | Сначала `git add <решённый-файл>`, потом `--continue` |
| Rebase 50 коммитов и сдаться на 30-м | Потерянное время + придётся начинать сначала | Ребейсить **регулярно** (раз в день), не накапливать |

---

## 📝 Документирование

Создайте `~/notes/day-04.md` и ответьте:

1. **Что делает rebase с SHA коммитов**: одной фразой объясните, почему после rebase `HEAD` указывает на другие SHA.
2. **Rebase vs merge — ваш выбор**: в какой момент жизни фичи вы делаете rebase, в какой merge? Опишите правило командой.
3. **Золотое правило**: объясните своими словами, почему нельзя ребейсить публичную ветку.
4. **`rebase -i` против «чистого» стиля коммитов**: как вы относитесь к `wip`/`fix typo`-коммитам? Сначала писать аккуратно или писать как пойдёт и чистить перед PR?

---

## Мини-тест

1. У вас feature-ветка с 3 коммитами. На main — 2 новых коммита. Вы делаете `git rebase main` на feature. Сколько коммитов окажется на feature после успешного rebase? Какие у них SHA по сравнению с исходными?
2. Вы сделали `git push origin feature/X`, потом `git rebase -i` поменял историю, потом `git push origin feature/X`. Git отказал. Что делать, если других разработчиков на этой ветке нет? А если есть?
3. В `rebase -i` вы пометили второй коммит как `drop`. Что произойдёт с файлами, которые этот коммит добавлял?
4. Rebase остановился на конфликте. Вы решили файл, забыли сделать `git add`, сразу ввели `git rebase --continue`. Что увидите?

Ответы — в конце поста.

---

## Что дальше

- **День 5** → git hooks: pre-commit + commit-msg, как не пропустить мусор в коммиты
- **[Challenge](/posts/git-master-final-challenge/)** → сломанный репозиторий с 10 проблемами. Задача P6 — применить `rebase -i` к 20 коммитам и получить читаемую историю из 4
- **Системно с нуля** → «Курс молодого бойца» DevIT Academy, продвинутый Git в Неделе 3

---

## Ответы на мини-тест

1. **Три коммита**. Те же изменения, но **другие SHA** — это новые коммиты, построенные поверх новой базы (последнего коммита main). Исходные три коммита остаются в reflog на ~90 дней, потом выкидываются `git gc`.

2. Если других разработчиков нет — `git push --force-with-lease origin feature/X`. Это «force push с предохранителем»: если в remote что-то появилось с момента вашего последнего fetch, push откажет и вы не затрёте чужое. Если другие есть — сначала предупредить в чате, затем force-with-lease, и команда делает у себя `git fetch && git reset --hard origin/feature/X`.

3. Коммит **исчезнет** из истории ветки. Файлы, которые он добавлял или менял, **тоже** пропадут — rebase перестраивает дерево без этих изменений. Если в последующих коммитах были правки этих файлов — получите конфликт или потерю данных. Поэтому `drop` использовать осторожно, чаще уместнее `reword` или `squash`.

4. `git rebase --continue` упадёт с сообщением вроде «error: Committing is not possible because you have unmerged files» или «fatal: no changes — did you forget to use 'git add'?». Надо либо `git add <файл>` и ещё раз `--continue`, либо `git rebase --skip` (если коммит полностью не нужен), либо `git rebase --abort` (начать заново).
