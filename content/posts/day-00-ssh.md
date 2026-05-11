---
title: "День 0: SSH — один ключ вместо пароля везде"
date: 2026-04-16T12:00:00+03:00
lastmod: 2026-04-16T12:00:00+03:00
draft: false
weight: 1
categories: ["DevOps основы"]
tags: ["git", "ssh", "github", "ed25519", "ssh-agent"]
author: "DevOps Way"
description: "Один SSH-ключ на GitHub, GitLab, прод-серверы. Ed25519, ssh-agent, ~/.ssh/config под несколько аккаунтов. Сандбокс-проверено: после урока git clone работает без паролей."
series: "Git Mastery"
aliases:
  - /posts/day-00-git/
  - /posts/day-00-git-basics/
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

После урока вы **умеете** создать Ed25519 SSH-ключ, подключить его к ssh-agent с автозагрузкой, добавить публичную часть в GitHub и клонировать приватный репозиторий без паролей. Понимаете, почему один ключ работает на десятке сервисов и как через `~/.ssh/config` держать рабочий и личный GitHub в одной системе.

| Параметр | Значение |
|----------|----------|
| Bloom | Применение |
| SFIA | Уровень 2 |
| Время | 30–40 минут |
| Артефакт | Рабочий `~/.ssh/id_ed25519` + `~/.ssh/config` + автозагрузка агента |
| Проверка | `ssh -T git@github.com` → приветствие от GitHub |

---

## Теория за 3 минуты

Пароль от GitHub вы вводите на клавиатуре у всех на виду — и его украдёт shoulder-surfing, phishing, случайный скриншот. SSH-ключ этот механизм убирает.

**Как это работает:**

1. Вы генерируете пару ключей: приватный (`id_ed25519`) остаётся у вас, публичный (`id_ed25519.pub`) отдаёте серверу.
2. Когда подключаетесь, сервер присылает challenge. Ваш клиент подписывает его приватным ключом. Сервер проверяет подпись публичным.
3. Приватный ключ **никогда не уходит** с вашей машины. Пароль не передаётся вообще.

**Почему Ed25519, а не RSA:**

| Алгоритм | Длина ключа | Безопасность | Скорость |
|----------|-------------|--------------|----------|
| RSA 2048 | 2048 бит | ок | медленно |
| RSA 4096 | 4096 бит | хорошо | медленнее |
| **Ed25519** | **256 бит** | **очень хорошо** | **очень быстро** |

Ed25519 — современный стандарт. Короче, быстрее, криптостойкость как у RSA 3000+. GitHub, GitLab, Bitbucket его поддерживают с 2021 года.

**Главная мысль:** один ключ — десятки сервисов. GitHub, GitLab, ваш VPS, CI-раннер, прод-сервер — везде вы кладёте **один и тот же `id_ed25519.pub`**. Не плодите ключи по одному на сервис — это миф.

---

## Практика 1: генерация Ed25519 ключа

### Шаг 1. Проверяем, нет ли уже ключа

```bash
ls -la ~/.ssh/ 2>/dev/null || echo "директории ~/.ssh нет"
```

Если видите `id_ed25519` и `id_ed25519.pub` — у вас уже есть ключ. Можете пропустить генерацию или создать новый с другим именем.

### Шаг 2. Генерируем ключ

```bash
ssh-keygen -t ed25519 -a 100 -C "your_email@example.com" -f ~/.ssh/id_ed25519 -N ""
```

Флаги:
- `-t ed25519` — тип ключа.
- `-a 100` — 100 раундов KDF для шифрования приватной части (замедляет bruteforce).
- `-C "..."` — комментарий, видно в публичной части, удобно для идентификации.
- `-f ~/.ssh/id_ed25519` — путь к файлу.
- `-N ""` — без passphrase (для сандбокса; в реальности замените на свой пароль или уберите флаг, ssh-keygen спросит).

**Про passphrase:** это пароль, которым шифруется сам приватный ключ на диске. Если ноутбук украдут — ключ не используют без этого пароля. Рекомендуется ставить. `ssh-agent` (следующая практика) будет помнить его в памяти.

### Шаг 3. Проверяем права доступа

```bash
ls -l ~/.ssh/id_ed25519 ~/.ssh/id_ed25519.pub
```

Ожидаем:
```
-rw------- 1 user user  411 ...  /root/.ssh/id_ed25519
-rw-r--r-- 1 user user   99 ...  /root/.ssh/id_ed25519.pub
```

Приватный ключ — `600` (только владелец). Если увидите `644` на приватном — `chmod 600 ~/.ssh/id_ed25519`. SSH откажется использовать ключ с открытыми правами.

### Шаг 4. Смотрим публичную часть

```bash
cat ~/.ssh/id_ed25519.pub
```

Вывод:
```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIKr... your_email@example.com
```

Это та строка, которую вы будете копировать в GitHub, серверы, CI.

---

## Практика 2: ssh-agent с автозагрузкой

### Шаг 0. Зачем агент

Без агента: каждый `git push` → ввод passphrase. Утомляет за пять минут.

Агент запускается один раз за сессию, держит расшифрованный ключ в памяти, SSH-клиент спрашивает агент, агент подписывает. Вы вводите passphrase один раз.

### Шаг 1. Запускаем агент вручную

```bash
eval "$(ssh-agent -s)"
```

Ответ:
```
Agent pid 12345
```

### Шаг 2. Добавляем ключ

```bash
ssh-add ~/.ssh/id_ed25519
```

Если есть passphrase — агент спросит его один раз. Дальше:

```bash
ssh-add -l
```

Ответ:
```
256 SHA256:... your_email@example.com (ED25519)
```

### Шаг 3. Автозагрузка при каждом входе

Ручной запуск надоедает. Добавьте в `~/.bashrc` (или `~/.zshrc`):

```bash
cat >> ~/.bashrc << 'EOF'

# --- ssh-agent autoload ---
if [ -z "$SSH_AUTH_SOCK" ]; then
  eval "$(ssh-agent -s)" > /dev/null
  ssh-add ~/.ssh/id_ed25519 2>/dev/null
fi
EOF
```

Проверяем, что блок добавлен:

```bash
tail -5 ~/.bashrc
```

Теперь каждая новая сессия — агент уже запущен, ключ добавлен.

**Для macOS** (коротко): вместо этого блока — `ssh-add --apple-use-keychain ~/.ssh/id_ed25519`, passphrase сохранится в Keychain.

---

## Практика 3: добавить ключ в GitHub и проверить

### Шаг 1. Копируем публичный ключ

**Linux:**
```bash
cat ~/.ssh/id_ed25519.pub
```
Выделите мышью, скопируйте. Или:
```bash
xclip -sel clip < ~/.ssh/id_ed25519.pub   # если установлен xclip
```

**macOS:**
```bash
pbcopy < ~/.ssh/id_ed25519.pub
```

**Windows (WSL):**
```bash
clip.exe < ~/.ssh/id_ed25519.pub
```

### Шаг 2. Добавляем в GitHub

1. Заходите на https://github.com/settings/keys
2. `New SSH key`
3. **Title**: `laptop-ubuntu-2026` (осмысленное имя — потом поймёте, какой ключ где)
4. **Key type**: Authentication Key
5. **Key**: вставляете содержимое `id_ed25519.pub`
6. `Add SSH key`

### Шаг 3. Тестируем подключение

```bash
ssh -T git@github.com
```

Первый раз GitHub спросит про неизвестный хост:
```
The authenticity of host 'github.com (140.82.121.4)' can't be established.
ED25519 key fingerprint is SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU.
Are you sure you want to continue connecting (yes/no/[fingerprint])?
```

**Сверьте fingerprint** с официальным: https://docs.github.com/en/authentication/keychain-fingerprints. Если совпадает — `yes`.

Ожидаемый ответ:
```
Hi username! You've successfully authenticated, but GitHub does not provide shell access.
```

Эта фраза — ваш сертификат. Всё работает.

### Шаг 4. Клонируем что-то и проверяем push

```bash
cd /tmp
git clone git@github.com:ваш-логин/любой-ваш-репо.git test-repo
cd test-repo
echo "ssh test $(date +%s)" >> README.md
git add README.md
git commit -m "test: ssh auth working"
git push
```

Ни один пароль не спросили. Урок пройден.

---

## Бонус: ~/.ssh/config для нескольких аккаунтов

Типичная ситуация: личный GitHub + рабочий GitHub. Один email на GitHub уникален, значит два аккаунта = два разных ключа.

```bash
ssh-keygen -t ed25519 -C "work@company.com" -f ~/.ssh/id_ed25519_work -N ""
```

И настраиваем `~/.ssh/config`:

```bash
cat > ~/.ssh/config << 'EOF'
# --- личный GitHub ---
Host github.com
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519
    IdentitiesOnly yes

# --- рабочий GitHub ---
Host github.com-work
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519_work
    IdentitiesOnly yes
EOF
chmod 600 ~/.ssh/config
```

Использование:
```bash
# личный
git clone git@github.com:личный/репо.git

# рабочий (подставляем github.com-work)
git clone git@github.com-work:компания/репо.git
```

`IdentitiesOnly yes` критично: без него SSH попробует **все** добавленные в агент ключи подряд. GitHub после 5 неудачных попыток блокирует на минуту — вы получите `Too many authentication failures`.

---

## Артефакт: ваш итоговый рабочий набор

После урока у вас есть:

1. `~/.ssh/id_ed25519` — приватный ключ (600)
2. `~/.ssh/id_ed25519.pub` — публичный ключ (644)
3. Блок в `~/.bashrc` с автозагрузкой ssh-agent
4. (Бонус) `~/.ssh/config` с именованными хостами

Проверка одной командой:

```bash
ssh -T git@github.com && ssh-add -l && ls -l ~/.ssh/config ~/.ssh/id_ed25519
```

Три зелёных вывода — комплект.

---

## Частые ошибки

| Ошибка | Причина | Что делать |
|--------|---------|-----------|
| `Permission denied (publickey)` | Ключ не добавлен в GitHub или не в агент | `ssh-add -l`; проверить GitHub Settings → SSH keys |
| `Bad owner or permissions on ~/.ssh/config` | Файл `644` или `755` | `chmod 600 ~/.ssh/config` |
| `Too many authentication failures` | Агент подсовывает 10 ключей подряд | `IdentitiesOnly yes` в `~/.ssh/config` |
| `Host key verification failed` | IP сервера изменился, старая запись в `known_hosts` | `ssh-keygen -R github.com`, подключиться заново |
| `Agent pid ... ssh-agent died` | Агент не живёт между сессиями без автозагрузки | Блок из Практики 2 в `~/.bashrc` |

---

## 📝 Документирование

Создайте `~/notes/day-00.md` и ответьте:

1. **Вашими словами**: почему приватный ключ никогда не уходит с машины, а авторизация всё равно работает?
2. **Разница Ed25519 vs RSA**: одной строкой — чем Ed25519 лучше для 2026 года?
3. **`IdentitiesOnly yes`** — зачем эта опция в `~/.ssh/config`?
4. **Ваш сценарий**: куда ещё вы положите `id_ed25519.pub` на этой неделе? (VPS, CI, GitLab, коллега…)

---

## Мини-тест

1. Вы сгенерировали ключ `~/.ssh/id_ed25519_hobby` с passphrase. `git push` просит пароль каждый раз. Что не сделано?
2. Публичный ключ попал в публичный репозиторий в `README.md`. Это утечка? Ответ «да/нет» + одна фраза почему.
3. Один ключ нельзя добавить в два разных GitHub-аккаунта. Как обойти это ограничение?
4. Права на `~/.ssh/id_ed25519` случайно стали `644`. Что произойдёт при `git push`?

Ответы — в конце поста.

---

## Что дальше

- **[День 1](/posts/day-01-three-states/)** → commits: три состояния (working / staging / committed), `git status` как компас, осознанный коммит вместо «git add .»
- **[Challenge](/posts/git-master-final-challenge/)** → сломанный репозиторий с 10 проблемами. Первая же задача использует SSH-ключ — проверите себя в бою
- **Системно с нуля** → «Курс молодого бойца» DevIT Academy — Linux + Git + Docker + K8s + CI/CD за 16 недель

---

## Ответы на мини-тест

1. Ключ не добавлен в `ssh-agent` **или** не прописан в `~/.ssh/config` через `IdentityFile`. Без этого `git` не знает, чем подписывать запрос, и фолбэчится на пароль. Проверка: `ssh-add -l`.

2. **Нет**, это не утечка. Публичный ключ на то и публичный — его задача быть всем видимым. Утечка — только приватный (`id_ed25519`, без `.pub`).

3. Два аккаунта = два разных SSH-ключа + `~/.ssh/config` с разными `Host`-алиасами (см. «Бонус»). GitHub проверяет ключ → аккаунт, и если один ключ зарегистрирован на двух, возникнет конфликт.

4. `git push` упадёт с ошибкой типа `Permissions 0644 for '~/.ssh/id_ed25519' are too open`. SSH отказывается использовать приватный ключ, если его может прочитать кто-то кроме владельца — это защита от случайных `chmod -R 755`. Чиним: `chmod 600 ~/.ssh/id_ed25519`.
