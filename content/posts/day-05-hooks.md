---
title: "День 5: git hooks — как отловить мусор до коммита"
date: 2026-04-16T18:00:00+03:00
lastmod: 2026-04-16T18:00:00+03:00
draft: false
weight: 6
categories: ["DevOps основы"]
tags: ["git", "hooks", "pre-commit", "commit-msg", "automation"]
author: "DevOps Way"
description: "Git hooks без Husky и Node — чистый bash. Pre-commit блокирует секреты и trailing whitespace. Commit-msg проверяет Conventional Commits regex'ом. Распространение hooks на команду через core.hooksPath."
canonical: ""
series: "Git Mastery"
aliases:
  - /posts/day-05-git/
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

После урока вы **умеете** написать и установить `pre-commit` и `commit-msg` hook на чистом bash (без Husky / Node / Python), понимаете почему hooks живут локально и как распространить их на команду через `core.hooksPath` + папку в репозитории. Можете добавить проверку секретов, trailing whitespace, формата Conventional Commits.

| Параметр | Значение |
|----------|----------|
| Bloom | Применение |
| SFIA | Уровень 3 |
| Время | 40 минут |
| Артефакт | `repo/.githooks/pre-commit` + `commit-msg` + `core.hooksPath = .githooks` |
| Проверка | Коммит с секретом блокируется; коммит с кривым сообщением блокируется; `git commit --no-verify` обходит (и это ожидаемо) |

---

## Теория: что такое git hook

**Hook** — это исполняемый файл в папке `.git/hooks/`, который Git вызывает на определённое событие. Если файл есть и имеет бит `+x` — Git запустит его и **смотрит на exit code**: `0` — продолжить операцию, не `0` — отменить.

```
.git/hooks/
├── pre-commit         ← вызывается до создания коммита
├── commit-msg         ← вызывается с путём к файлу сообщения
├── pre-push           ← вызывается до git push
├── post-commit        ← после коммита (нотификация)
├── pre-rebase         ← до rebase
└── pre-commit.sample  ← примеры от Git (не активные)
```

По умолчанию Git кладёт туда `.sample` файлы — это примеры, они не активны (без бита `+x`).

**Ключевое ограничение:** папка `.git/hooks/` **не попадает** в git push. Hooks — это **локальная** настройка каждого разработчика. Отсюда задача: как заставить всю команду использовать одни и те же проверки → решение через `core.hooksPath` (Практика 3).

**«Щёлкнуло» дня:** hooks — это **дружеская страховка на твоём компе**, не жёсткая защита сервера. Кто очень хочет — обойдёт через `git commit --no-verify`. Серьёзная защита делается в CI и серверных hooks (pre-receive на GitLab/GitHub). Hooks на клиенте ловят то, что **забыли**, а не то, что **пытались скрыть**.

---

## Практика 1: pre-commit — блокируем секреты и пробелы

### Шаг 1. Готовим репозиторий

```bash
mkdir -p /tmp/demo-hooks && cd /tmp/demo-hooks
git init -q -b main
git config user.name Student
git config user.email student@example.com
echo "hello" > app.txt
git add . && git commit -q -m "feat: initial"
```

### Шаг 2. Пишем pre-commit

```bash
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
# pre-commit: запретить секреты и trailing whitespace в staged файлах
set -e

# список файлов в индексе (то, что попадёт в коммит)
FILES=$(git diff --cached --name-only --diff-filter=ACMR)
[ -z "$FILES" ] && exit 0

# 1. Проверка на секреты: имя секретного ключа + "=" + значение длиной ≥16 символов
# (не ловит безопасные формы типа API_KEY=os.getenv("API_KEY") — там нет длинного значения)
SECRET_PATTERN='((password|secret|api_key|apikey|token)[[:space:]]*[=:][[:space:]]*["\x27]?[A-Za-z0-9+/_-]{16,}|BEGIN RSA PRIVATE KEY|AKIA[0-9A-Z]{16})'
if echo "$FILES" | xargs -r grep -EnHi "$SECRET_PATTERN" 2>/dev/null; then
  echo ""
  echo "Похоже на секрет в staged файлах. Коммит отменён."
  echo "Если ложное срабатывание — git commit --no-verify"
  exit 1
fi

# 2. Trailing whitespace
if echo "$FILES" | xargs -r grep -EnH ' +$' 2>/dev/null; then
  echo ""
  echo "Найдены trailing whitespace. Убрать: sed -i 's/ *$//' <файл>"
  exit 1
fi

exit 0
EOF
chmod +x .git/hooks/pre-commit
```

### Шаг 3. Проверяем: секрет блокируется

```bash
echo 'API_KEY=sk-1234567890abcdef' > config.py
git add config.py
git commit -m "feat: add config"
```

Вывод:
```
config.py:1:API_KEY=sk-1234567890abcdef
Похоже на секрет в staged файлах. Коммит отменён.
```

Exit code не 0 — коммит не создан. Исправляем:

```bash
rm config.py
echo 'API_KEY=os.getenv("API_KEY")' > config.py
echo ".env" > .gitignore
git add config.py .gitignore
git commit -m "feat: read API_KEY from env"
```

Проходит.

### Шаг 4. Проверяем: trailing whitespace блокируется

```bash
printf 'def foo():   \n    pass\n' > dirty.py
git add dirty.py
git commit -m "feat: add foo"
```

Вывод:
```
dirty.py:1:def foo():
Найдены trailing whitespace. Убрать: sed -i 's/ *$//' <файл>
```

Исправляем и коммитим.

**Побочный канал:** `git commit --no-verify` обходит все client-side hooks. Это ожидаемое поведение — hook не тюрьма, а напоминание. Если коллега систематически юзает `--no-verify` — это не вопрос hook'а, а вопрос договора в команде.

---

## Практика 2: commit-msg — валидация Conventional Commits

pre-commit не видит сообщение коммита (сообщение запрашивается **после** pre-commit). Для валидации сообщения нужен **commit-msg hook** — ему в `$1` передаётся путь к временному файлу с сообщением.

```bash
cat > .git/hooks/commit-msg << 'EOF'
#!/bin/bash
# commit-msg: минимальная проверка Conventional Commits
MSG_FILE="$1"
MSG=$(head -1 "$MSG_FILE")

# разрешённые типы
PATTERN='^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-z0-9-]+\))?!?: .{1,72}$'

if ! echo "$MSG" | grep -qE "$PATTERN"; then
  echo ""
  echo "Сообщение коммита не соответствует Conventional Commits:"
  echo "  $MSG"
  echo ""
  echo "Ожидается: <type>(scope)?: <описание>"
  echo "Типы: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert"
  echo "Примеры:"
  echo "  feat: add user login"
  echo "  fix(api): handle 500 on /users"
  echo "  chore!: drop Node 16 support"
  exit 1
fi
EOF
chmod +x .git/hooks/commit-msg
```

### Тестируем

```bash
echo "content" > x.txt
git add x.txt
git commit -m "исправил баг"
```

Вывод:
```
Сообщение коммита не соответствует Conventional Commits:
  исправил баг
Ожидается: <type>(scope)?: <описание>
Типы: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert
```

Повторяем правильно:

```bash
git commit -m "fix: исправил кейс с пустым юзером"
```

Проходит. Можно и с scope:

```bash
echo "more" >> x.txt
git add x.txt
git commit -m "fix(auth): перехват пустого юзера в login"
```

**Важно про regex**: он намеренно простой (стартовая строка, тип, опц. scope, `!` для breaking change, двоеточие, пробел, до 72 символов). Если хотите строгости — есть `commitlint` (npm) или `cocogitto` (Rust). Но 80% команд спокойно живут на 10 строк bash.

---

## Практика 3: распространение hooks на команду

Проблема: `.git/hooks/` **не синхронизируется** через `git push`. Коллеге нужно руками копировать ваши hooks. Это не работает.

**Решение:** положить hooks **в сам репозиторий** (папка `.githooks/`), и каждый разработчик делает один раз:

```bash
git config core.hooksPath .githooks
```

Эта настройка говорит Git'у: «смотри в `.githooks/` вместо `.git/hooks/`». А `.githooks/` — обычная папка в репо, под версионным контролем.

### Шаг 1. Переносим hooks в репозиторий

```bash
cd /tmp/demo-hooks
mkdir -p .githooks
mv .git/hooks/pre-commit .githooks/
mv .git/hooks/commit-msg .githooks/
chmod +x .githooks/*
```

### Шаг 2. Переключаем Git на эту папку

```bash
git config core.hooksPath .githooks
```

### Шаг 3. Добавляем в репо + README

```bash
cat > .githooks/install.sh << 'EOF'
#!/bin/bash
# Установка hooks для этого репозитория
git config core.hooksPath .githooks
echo "✓ core.hooksPath -> .githooks"
echo "  проверки pre-commit и commit-msg активны"
EOF
chmod +x .githooks/install.sh

git add .githooks
git commit -m "chore(hooks): add pre-commit and commit-msg via core.hooksPath"
```

### Как подключается коллега

Один раз после `git clone`:

```bash
./.githooks/install.sh
```

И всё — у коллеги те же самые проверки. Обновления hooks приходят автоматически через `git pull` (они теперь тоже часть истории).

**Альтернатива** — pre-commit framework (pre-commit.com, Python). Он делает ровно это, но ещё умеет ставить плагины и кэшировать окружения. Для JavaScript-стека есть Husky — тоже обёртка над тем же `core.hooksPath`. Базовый принцип один: **hooks в репо + переключение папки через config**.

---

## Практика 4: pre-push — запуск тестов

**pre-push** вызывается перед `git push`. Exit != 0 отменяет push. Классический кейс: запустить тесты перед отправкой в remote.

```bash
cat > .githooks/pre-push << 'EOF'
#!/bin/bash
# pre-push: запустить тесты перед push
# если тесты не запускаются в этом репо — просто выходим с 0

if [ -f "go.mod" ]; then
  go test ./... || { echo "тесты упали, push отменён"; exit 1; }
elif [ -f "package.json" ] && grep -q '"test"' package.json; then
  npm test || { echo "тесты упали, push отменён"; exit 1; }
elif [ -f "pytest.ini" ] || [ -f "pyproject.toml" ]; then
  pytest || { echo "тесты упали, push отменён"; exit 1; }
fi

exit 0
EOF
chmod +x .githooks/pre-push
```

Это не заменяет CI, но экономит минуты: падающие тесты ловятся на своей машине, а не после push и жёлтого прогресс-бара в CI.

---

## Артефакт: `.githooks/` в вашем репо

Готовый набор для старта любого проекта:

```
repo/
├── .githooks/
│   ├── install.sh        # один раз после clone
│   ├── pre-commit        # секреты + whitespace
│   ├── commit-msg        # Conventional Commits
│   └── pre-push          # тесты
└── README.md             # инструкция: "после clone → ./.githooks/install.sh"
```

README-снипет команды:

```markdown
## Contributing

After cloning, run:
\`\`\`bash
./.githooks/install.sh
\`\`\`
This activates pre-commit and commit-msg hooks.
```

---

## Частые ошибки

| Ошибка | Почему больно | Как не делать |
|--------|---------------|---------------|
| Положить hooks в `.git/hooks/` и забыть — коллега их не увидит | Коллега коммитит секреты, ваши hooks его не спасают | Через `core.hooksPath` + папка в репо |
| Забыть `chmod +x` у hook'а | Git молча игнорирует не-исполняемый файл | `chmod +x .githooks/*` в install.sh |
| Тяжёлые проверки в pre-commit (линт, тесты, сборка) на 10 секунд | Команда начинает юзать `--no-verify` и весь pre-commit теряет смысл | pre-commit < 1 секунды. Линт и тесты — в pre-push или CI |
| Ловить секреты только regex'ом `password=` | Ложноотрицательные: переменные, имена функций типа `getPassword()` тоже проходят | Использовать специализированный сканер (gitleaks, detect-secrets) в CI; hook — только первая линия |

---

## 📝 Документирование

Создайте `~/notes/day-05.md` и ответьте:

1. **Почему hooks не синхронизируются через push**: объясните одной фразой.
2. **`core.hooksPath` — что и зачем**: опишите механизм в 2-3 предложениях.
3. **Проверка, которую ставите первой**: какой pre-commit сценарий вам сейчас нужнее всего в текущем проекте?
4. **`--no-verify`**: это баг или фича? Обоснуйте.

---

## Мини-тест

1. Вы положили pre-commit в `.git/hooks/pre-commit`, но он не срабатывает. Что проверить первым?
2. Чем отличаются hooks `pre-commit` и `commit-msg` по моменту вызова и входным данным?
3. Вы хотите, чтобы у всей команды работал один pre-commit. Какие два шага для этого нужны?
4. Коллега делает `git commit --no-verify` и коммитит секрет. Что вам **не** поможет? А что поможет?

Ответы — в конце поста.

---

## Что дальше

- **День 6** → `git bisect`: двоичный поиск коммита, сломавшего код
- **[Challenge](/posts/git-master-final-challenge/)** → сломанный репозиторий с 10 проблемами. Задача P5 — починить репо, где вредный commit-msg hook блокирует все коммиты
- **Системно с нуля** → «Курс молодого бойца» DevIT Academy, продвинутый Git в Неделе 3

---

## Ответы на мини-тест

1. **Бит `+x`**. Git запускает hook как обычный исполняемый файл — без права на исполнение он молча игнорируется. Проверьте: `ls -l .git/hooks/pre-commit`, должно быть `-rwxr-xr-x`. Если нет — `chmod +x`.

2. **pre-commit** вызывается **до** того, как Git спросит сообщение коммита; на вход ничего не получает (сам читает `git diff --cached`). **commit-msg** вызывается **после** ввода сообщения, но до его записи в историю; получает в `$1` путь к временному файлу с сообщением, может его читать и модифицировать.

3. (1) Положить hooks в папку в репозитории (`.githooks/`). (2) Каждый разработчик после `git clone` делает `git config core.hooksPath .githooks` — обычно это скрипт `./.githooks/install.sh`. После этого hooks общие и синхронизируются через `git pull`.

4. **Не поможет** никакой клиентский hook — `--no-verify` отключает все локальные hooks. **Поможет** серверный hook (`pre-receive` на стороне GitHub/GitLab) или secret-scanning в CI. Клиентские hooks — первая линия защиты от **забывчивости**, не от **злого умысла**.
