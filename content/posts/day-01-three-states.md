---
title: "День 1: три состояния Git — где сейчас живёт ваш файл"
date: 2026-04-16T14:00:00+03:00
lastmod: 2026-04-16T14:00:00+03:00
draft: false
weight: 2
categories: ["DevOps основы"]
tags: ["git", "status", "staging", "workflow"]
author: "DevOps Way"
description: "Три состояния файла в Git — working / staging / committed. Как читать git status, зачем git add -p, и почему git add . убивает историю. Sandbox-проверено."
canonical: ""
series: "Git Mastery"
aliases:
  - /posts/day-01-git/
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

После урока вы **понимаете**, в каком из трёх состояний живёт каждый ваш файл (working / staging / committed), читаете `git status` как карту и используете `git add -p` для осознанных коммитов вместо `git add .`. Знаете, какой командой вернуть файл из каждого состояния.

| Параметр | Значение |
|----------|----------|
| Bloom | Понимание, Применение |
| SFIA | Уровень 2 |
| Время | 30–40 минут |
| Артефакт | `~/.gitconfig` с алиасами `s`, `d`, `dc` + история из 5 осознанных коммитов |
| Проверка | `git status` → `nothing to commit, working tree clean`; `git log --oneline` показывает коммиты в формате `type(scope): message` |

---

## Теория за 3 минуты

У файла в Git три состояния, и каждая команда — это переход между ними.

```
┌──────────────┐  git add     ┌─────────────┐  git commit   ┌──────────────┐
│  working     │ ───────────▶ │   staging   │ ────────────▶ │  committed   │
│  (изменён    │              │ (подготовлен│               │  (в истории) │
│   на диске)  │              │  к коммиту) │               │              │
└──────────────┘              └─────────────┘               └──────────────┘
       ▲                            │                               │
       │    git restore --staged    │                               │
       │ ◀──────────────────────────┘                               │
       │                                                            │
       │                git restore / git checkout --               │
       │ ◀──────────────────────────────────────────────────────────┘
```

**Почему три, а не два.** Два было бы: «на диске → в истории». Третье — staging — даёт вам возможность **выбрать**, что именно пойдёт в коммит, даже если в working-дереве пять изменений. Коммит отвечает на один вопрос, а не на пять.

**`git status` — это компас.** Он показывает одновременно, что в staging (пойдёт в коммит), что в working (не пойдёт, пока не добавите), и что untracked (Git про файл вообще не знает).

**Главная мысль:** `git add .` — это как «ctrl+A, delete» в чужом документе. Вы не контролируете, что ушло в коммит. `git add -p` и `git add <файл>` — контролируете.

---

## Практика 1: три состояния своими глазами

### Шаг 1. Создаём репозиторий

```bash
mkdir -p /tmp/states-demo && cd /tmp/states-demo
git init -q
git config user.name "Student"
git config user.email "student@example.com"
```

### Шаг 2. Untracked — Git про файл ничего не знает

```bash
echo "hello" > a.txt
git status -sb
```

Вывод:
```
## No commits yet
?? a.txt
```

`??` — это untracked. Файл лежит на диске, Git его видит, но не отслеживает.

### Шаг 3. Working → staging через `git add`

```bash
git add a.txt
git status -sb
```

Вывод:
```
## No commits yet
A  a.txt
```

`A` (зелёная в терминале) — файл в staging, готов к коммиту.

### Шаг 4. Staging → committed через `git commit`

```bash
git commit -q -m "feat: add a.txt"
git status -sb
```

Вывод:
```
## main
```

Чистое дерево — всё в истории.

### Шаг 5. Изменяем → и видим два столбца

```bash
echo "world" >> a.txt
echo "new" > b.txt
git add b.txt
git status -sb
```

Вывод:
```
## main
 M a.txt
A  b.txt
```

Две колонки: **первая — staging**, **вторая — working**. У `a.txt` изменения только в working (` M`), у `b.txt` — в staging (`A` ).

Это и есть ответ на вопрос «что попадёт в следующий коммит»: только первая колонка.

---

## Практика 2: `git add -p` — осознанный коммит

### Шаг 0. Зачем это вообще нужно

Классический сценарий: вы правили аутентификацию, заодно поправили опечатку в README, и обновили package.json. Это три разных коммита: `fix(auth)`, `docs(readme)`, `chore(deps)`. `git add .` слепит их в один — история теряет смысл, `git bisect` и cherry-pick потом не работают.

`git add -p` даёт добавить в staging **кусок файла**, не весь файл.

### Шаг 1. Готовим «три разных изменения в одной сессии»

```bash
cd /tmp/states-demo

cat > auth.js << 'EOF'
function login(user) {
  return user.password === "1234";
}
EOF

cat > README.md << 'EOF'
# My Project
Содержит систему логина.
EOF

cat > package.json << 'EOF'
{ "name": "demo", "version": "0.1.0" }
EOF

git add . && git commit -q -m "feat: initial scaffold"
```

### Шаг 2. Делаем три разных правки в одной сессии

```bash
# 1) фикс бага в auth.js (серьёзная правка)
cat > auth.js << 'EOF'
const bcrypt = require('bcrypt');
function login(user, password) {
  return bcrypt.compareSync(password, user.passwordHash);
}
EOF

# 2) опечатка в README.md
sed -i 's/Содержит систему/Содержит безопасную систему/' README.md

# 3) апдейт version в package.json
sed -i 's/"0.1.0"/"0.2.0"/' package.json

git status -sb
```

Вывод:
```
## main
 M README.md
 M auth.js
 M package.json
```

Три файла с правками в working. Если сейчас `git add .` — один коммит на три несвязанные вещи.

### Шаг 3. Коммитим по одной правке

```bash
git add auth.js
git commit -q -m "fix(auth): replace plain-text compare with bcrypt"

git add README.md
git commit -q -m "docs(readme): clarify auth is secure"

git add package.json
git commit -q -m "chore: bump version to 0.2.0"
```

Проверяем:
```bash
git log --oneline
```

Вывод:
```
abc1234 chore: bump version to 0.2.0
def5678 docs(readme): clarify auth is secure
9abcdef fix(auth): replace plain-text compare with bcrypt
0123456 feat: initial scaffold
```

Четыре коммита, каждый отвечает на один вопрос. Через месяц вы вернётесь и поймёте, **зачем** было изменение — или откатите ровно одно из трёх.

### Шаг 4. `git add -p` — когда две правки в одном файле

Сценарий: в `auth.js` вы и fix сделали, и опечатку в комментарии поправили. Два коммита из одного файла:

```bash
cat > auth.js << 'EOF'
// Simple authentication module
const bcrypt = require('bcrypt');
function login(user, password) {
  return bcrypt.compareSync(password, user.passwordHash);
}

// TODO: rate limiting
function logout(session) {
  // убераем сессию (опечатка: "убираем")
  session.destroy();
}
EOF
git add auth.js && git commit -q -m "feat(auth): add logout"

# делаем два изменения в одном файле
sed -i 's/Simple authentication module/Secure authentication module/' auth.js
sed -i 's/убераем/убираем/' auth.js

git diff
```

В выводе два разных hunk'а. Теперь добавляем их в staging по отдельности:

```bash
git add -p auth.js
```

Git спрашивает по каждому hunk'у:
```
Stage this hunk [y,n,q,a,d,e,?]?
```

Нажимаете `y` на первый (заголовок), `n` на второй (опечатка). Коммитим:

```bash
git commit -q -m "docs(auth): clarify module purpose"
```

Теперь оставшееся:

```bash
git add auth.js
git commit -q -m "fix(auth): typo in logout comment"

git log --oneline | head -3
```

Два осмысленных коммита из одного файла.

---

## Практика 3: возврат из каждого состояния

Три состояния — три способа откатить.

### 3.1. Из staging обратно в working

```bash
cd /tmp/states-demo
echo "noise" >> auth.js
git add auth.js
git status -sb
# M  auth.js  — в staging

git restore --staged auth.js
git status -sb
#  M auth.js  — в working, без staging
```

### 3.2. Из working обратно к последнему коммиту (теряем правку)

```bash
git restore auth.js
git status -sb
# ## main   — чисто
```

⚠️ `git restore` без `--staged` **удаляет** правки из working-дерева. Перед этой командой убедитесь, что правки вам не нужны.

### 3.3. Уже закоммиченное — нужен `git reset` или `git revert`

Про это — День 2 (reflog + reset). Сейчас важно: **committed** — это точка «назад без потерь только через reflog».

---

## Артефакт: алиасы для быстрого `git status`

Добавьте в `~/.gitconfig`:

```bash
git config --global alias.s "status -sb"
git config --global alias.d "diff"
git config --global alias.dc "diff --cached"
git config --global alias.l "log --oneline -10"
```

Использование:
```bash
git s        # короткий статус
git d        # что в working (не в staging)
git dc       # что в staging (пойдёт в коммит)
git l        # последние 10 коммитов
```

`git d` и `git dc` — это **два разных взгляда на две разные очереди**. Первая команда, которую я запускаю перед коммитом: `git dc` — проверить, **что именно** туда уходит.

---

## Conventional Commits: минимум

Формат:
```
type(scope): короткое описание до 50 символов
```

**Базовые типы (их 5, остальные позже):**

| type | когда |
|------|-------|
| `feat` | новая функциональность |
| `fix` | исправление бага |
| `docs` | только документация |
| `refactor` | переписали без изменения поведения |
| `chore` | версии, зависимости, служебное |

**Scope** (в скобках) — модуль/компонент: `auth`, `api`, `ui`, `deps`. Опционально.

Плохо: `fix`, `update`, `asdf`, `wip`.
Хорошо: `fix(auth): bcrypt compare вместо прямого сравнения пароля`.

Больше типов и автоматическая проверка через `commitlint` — в Дне 5 (hooks).

---

## Частые ошибки

| Ошибка | Почему больно | Как не делать |
|--------|---------------|---------------|
| `git add .` не глядя | В коммит улетают `node_modules/`, `.env`, случайные логи | `git status` → `git diff` → `git add <файл>` |
| Один коммит на 10 файлов и 3 несвязанные правки | `git bisect` не работает, cherry-pick бесполезен | `git add -p` или несколько `git add <файл>` |
| `git commit -am` на незнакомом репо | `-a` добавляет **все отслеживаемые изменения**, но не untracked. Ломает ментальную модель новичка | Сначала `git status`, потом осознанный `git add` |
| Сообщение `fix`/`update`/`wip` | Через месяц вы не помните, что было «wip». `git log` становится бесполезен | Один тип + одно уточнение: `fix(auth): null check` |

---

## 📝 Документирование

Создайте `~/notes/day-01.md` и ответьте:

1. **Вашими словами**: три состояния Git и по одной команде для перехода в каждое.
2. **Два взгляда на diff**: чем `git diff` отличается от `git diff --cached`? В каком порядке вы их запускаете перед коммитом?
3. **Ваш сценарий**: опишите последнюю сессию кодинга из 3+ правок в разных файлах. Как бы вы разбили её на коммиты?
4. **Когда `git add .` допустим?** Попробуйте придумать 1–2 ситуации, где это нормально (подсказка: **свежий** untracked).

---

## Мини-тест

1. Вы сделали `git add README.md`, потом `echo "x" >> README.md`. Что покажет `git status`?
2. В staging — файл A, в working — правки в файле A и файле B. Какую команду запустить, чтобы увидеть **только то, что пойдёт в коммит**?
3. Вы случайно `git add secret.env`. Коммит ещё не сделан. Как отменить?
4. Вы сделали коммит с опечаткой в сообщении (но содержимое коммита правильное). Какая команда меняет только сообщение последнего коммита?

Ответы — в конце поста.

---

## Что дальше

- **День 2** → reflog и fsck: что спасает после `git reset --hard`, а что нет. Три состояния под углом восстановления
- **[Challenge](/posts/git-master-final-challenge/)** → сломанный репозиторий с 10 проблемами. Задача P1 — разобрать 20 непонятных коммитов и переделать в читаемую историю
- **Системно с нуля** → «Курс молодого бойца» DevIT Academy

---

## Ответы на мини-тест

1. Две строки по `README.md`:
   ```
   M  README.md
    M README.md
   ```
   Первая строка (`M` в первой колонке) — то, что было в staging на момент `git add`. Вторая (` M` во второй колонке) — новые правки в working после этого. В коммит пойдёт только **первая** версия.

2. `git diff --cached` (то же что `git diff --staged`). Без флага `git diff` показывает working минус staging, то есть как раз то, что **не пойдёт**.

3. `git restore --staged secret.env`. Файл остаётся в working с тем же содержимым, просто уходит из staging. Дальше: добавить `secret.env` в `.gitignore`.

4. `git commit --amend -m "новое сообщение"`. ⚠️ Если коммит уже запушен — `--amend` перепишет хеш, и `git push` потребует `--force-with-lease`. На общих ветках так делать не надо.
