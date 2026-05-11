---
title: "Linux: 10 принципов — 1. Автоматизация"
date: 2026-05-07T14:00:00+03:00
lastmod: 2026-05-07T14:00:00+03:00
draft: true
weight: 1
categories: ["Linux"]
tags: ["linux", "bash", "cron", "systemd", "automation"]
author: "DevOps Way"
series: "Linux: 10 принципов"
description: "Первый принцип из 10: автоматизация. Bash-скрипты, cron, systemd timers. Пишем health-check.sh, который следит за сервером пока вы спите."
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
    alt: "Linux: Автоматизация"
    caption: "Принцип 1/10: пусть машина работает за вас"
    relative: false
    hidden: false
editPost:
    URL: ""
    Text: "Предложить изменения"
    appendFilePath: true

---

| Параметр | Значение |
|----------|----------|
| Bloom | L2–L3 (Понимание → Применение) |
| SFIA | Уровень 1–2 |
| Артефакт | health-check.sh + systemd timer |
| Проверка | `systemctl status health-check.timer` → active |

---

## Сервер упал в 3 ночи

Вы проснулись от звонка. "Сайт не открывается". Полусонный, подключаетесь по SSH, смотрите логи. Диск заполнен на 100% -- контейнерные логи съели всё за ночь.

А теперь альтернативная реальность: скрипт каждые 5 минут проверял диск. Когда заполнение перевалило за 85%, в journalctl появилась строка WARN. Утром вы открыли логи, увидели проблему и спокойно почистили -- без звонков и паники.

Разница -- один bash-скрипт и systemd timer.

**Автоматизация** -- это не "напиши скрипт когда-нибудь". Это принцип: всё, что делаешь руками второй раз, должна делать машина.

---

## Bash: основы за 10 минут

Если вы знаете командную строку Linux, вы уже знаете 80% bash. Скрипт -- это файл с командами, которые выполняются по порядку.

### Первый скрипт

```bash
#!/bin/bash
# hello.sh — первый скрипт

echo "Hostname: $(hostname)"
echo "Uptime:   $(uptime -p)"
echo "Date:     $(date '+%Y-%m-%d %H:%M')"
```

```bash
chmod +x hello.sh
./hello.sh
# Hostname: web-server-01
# Uptime:   up 14 days, 3 hours
# Date:     2026-05-07 14:30
```

Ключевые моменты:
- `#!/bin/bash` -- shebang, указывает какой интерпретатор использовать
- `chmod +x` -- сделать файл исполняемым
- `$(команда)` -- подставить результат команды

### Переменные и условия

```bash
#!/bin/bash
# check-disk.sh — проверка диска

THRESHOLD=80
USAGE=$(df / | tail -1 | awk '{print $5}' | tr -d '%')

if [ "$USAGE" -gt "$THRESHOLD" ]; then
    echo "WARN: Disk usage ${USAGE}% (threshold: ${THRESHOLD}%)"
    exit 1
else
    echo "OK: Disk usage ${USAGE}%"
    exit 0
fi
```

Обратите внимание на `exit 1` и `exit 0`. Код возврата -- это язык, на котором скрипты общаются с системой: 0 = всё хорошо, не-0 = проблема.

### Функции

```bash
#!/bin/bash
# health-check.sh — проверка здоровья сервера

check_disk() {
    local threshold="${1:-80}"
    local usage
    usage=$(df / | tail -1 | awk '{print $5}' | tr -d '%')

    if [ "$usage" -gt "$threshold" ]; then
        echo "WARN disk=${usage}%"
        return 1
    fi
    echo "OK disk=${usage}%"
}

check_memory() {
    local threshold="${1:-500}"
    local available
    available=$(free -m | awk '/Mem:/{print $7}')

    if [ "$available" -lt "$threshold" ]; then
        echo "WARN memory=${available}MB free"
        return 1
    fi
    echo "OK memory=${available}MB free"
}

check_load() {
    local threshold="${1:-4}"
    local load
    load=$(awk '{printf "%.0f", $1}' /proc/loadavg)

    if [ "$load" -gt "$threshold" ]; then
        echo "WARN load=${load}"
        return 1
    fi
    echo "OK load=${load}"
}

# Запускаем все проверки
echo "=== Health Check $(date '+%H:%M:%S') ==="
FAILED=0
check_disk  80  || FAILED=$((FAILED + 1))
check_memory 500 || FAILED=$((FAILED + 1))
check_load  4   || FAILED=$((FAILED + 1))

if [ "$FAILED" -gt 0 ]; then
    echo "=== $FAILED check(s) failed ==="
    exit 1
else
    echo "=== All checks passed ==="
    exit 0
fi
```

```bash
chmod +x health-check.sh
./health-check.sh
# === Health Check 14:35:12 ===
# OK disk=45%
# OK memory=2048MB free
# OK load=1
# === All checks passed ===
```

---

## Cron: запуск по расписанию

Cron -- классический планировщик в Linux. Формат расписания:

```
┌───────── минута (0-59)
│ ┌─────── час (0-23)
│ │ ┌───── день месяца (1-31)
│ │ │ ┌─── месяц (1-12)
│ │ │ │ ┌─ день недели (0-7, 0 и 7 = воскресенье)
│ │ │ │ │
* * * * *  команда
```

Добавляем проверку каждые 5 минут:

```bash
crontab -e
```

```
*/5 * * * * /home/ubuntu/health-check.sh >> /var/log/health-check.log 2>&1
```

Проверяем:

```bash
crontab -l
# */5 * * * * /home/ubuntu/health-check.sh >> /var/log/health-check.log 2>&1
```

### Типичные ошибки с cron

| Ошибка | Причина | Решение |
|--------|---------|---------|
| Скрипт не запускается | Нет `chmod +x` | `chmod +x script.sh` |
| Команда не найдена | cron не знает PATH | Указывайте полный путь: `/usr/bin/curl` |
| Нет вывода | stdout/stderr не перенаправлены | `>> /var/log/file.log 2>&1` |
| Запускается не вовремя | Timezone сервера | `timedatectl` для проверки |

---

## Systemd timers: современная альтернатива cron

Systemd timers -- это cron на стероидах. Преимущества:

- Логи через `journalctl` (не разбросаны по файлам)
- Зависимости (запустить после сети, после диска)
- Можно запустить вручную: `systemctl start unit.service`
- Видно статус: когда запускался, когда следующий

### Создаём service unit

```ini
# /etc/systemd/system/health-check.service
[Unit]
Description=Server health check
After=network.target

[Service]
Type=oneshot
ExecStart=/home/ubuntu/health-check.sh
User=ubuntu
```

### Создаём timer unit

```ini
# /etc/systemd/system/health-check.timer
[Unit]
Description=Run health check every 5 minutes

[Timer]
OnBootSec=1min
OnUnitActiveSec=5min
AccuracySec=10s

[Install]
WantedBy=timers.target
```

### Активируем

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now health-check.timer
```

### Проверяем

```bash
# Статус таймера
systemctl status health-check.timer
# ● health-check.timer - Run health check every 5 minutes
#   Active: active (waiting)
#   Trigger: Wed 2026-05-07 14:40:00 MSK; 2min left

# Список всех таймеров
systemctl list-timers

# Логи последнего запуска
journalctl -u health-check.service -n 20

# Запустить вручную (для отладки)
sudo systemctl start health-check.service
journalctl -u health-check.service --no-pager
```

### Cron vs Systemd Timer

| Параметр | Cron | Systemd Timer |
|----------|------|---------------|
| Логи | Файл (сами настраиваете) | journalctl (из коробки) |
| Зависимости | Нет | After=network.target и т.д. |
| Ручной запуск | Нет (только ждать) | `systemctl start unit` |
| Статус | Нет | `systemctl status` |
| Рандомизация | Нет | RandomizedDelaySec |
| Удобство | Одна строка | Два файла (.service + .timer) |

Для простых задач cron проще. Для production -- systemd timer надёжнее.

---

## Мини-тест

**1. Чем `exit 0` отличается от `exit 1` и зачем это нужно?**

<details>
<summary>Ответ</summary>

`exit 0` -- скрипт завершился успешно. `exit 1` -- с ошибкой. Код возврата используется другими инструментами: cron, systemd, CI/CD pipeline, другие скрипты через `&&` и `||`. Это способ сообщить "всё хорошо" или "что-то не так" без парсинга текста.

</details>

**2. Почему в cron нужно писать полный путь `/usr/bin/curl` вместо просто `curl`?**

<details>
<summary>Ответ</summary>

Cron запускает команды с минимальным окружением, PATH обычно содержит только `/usr/bin:/bin`. Если `curl` установлен в `/usr/local/bin/`, cron его не найдёт. Полный путь решает проблему. Альтернатива -- задать PATH в начале crontab.

</details>

**3. В чём преимущество `OnUnitActiveSec=5min` перед `*/5 * * * *`?**

<details>
<summary>Ответ</summary>

`OnUnitActiveSec` отсчитывает время от завершения предыдущего запуска. Если скрипт выполняется 2 минуты, следующий запуск будет через 5 минут после окончания, а не по часам. Это гарантирует, что два экземпляра не перекроют друг друга. Cron всегда запускает по расписанию, даже если предыдущий ещё работает.

</details>

---

## Артефакт

Три файла, которые после этого поста должны быть на вашем сервере:

1. `/home/ubuntu/health-check.sh` -- скрипт проверки (из секции "Функции")
2. `/etc/systemd/system/health-check.service` -- service unit
3. `/etc/systemd/system/health-check.timer` -- timer unit

Проверка что всё работает:

```bash
# Таймер активен?
systemctl is-active health-check.timer
# active

# Когда следующий запуск?
systemctl list-timers health-check.timer
# NEXT                         LEFT
# Wed 2026-05-07 14:45:00 MSK  3min left

# Логи работают?
journalctl -u health-check.service -n 5 --no-pager
# May 07 14:40:01 web-server health-check.sh: === Health Check 14:40:01 ===
# May 07 14:40:01 web-server health-check.sh: OK disk=45%
# ...
```

---

## Принцип

Автоматизация -- не навык, а привычка мышления:

- Делаешь что-то **второй раз** → напиши скрипт
- Скрипт запускаешь **руками** → добавь в cron/systemd
- Результат скрипта **читаешь глазами** → добавь алерт

Каждый уровень убирает человека из цепочки. Цель -- чтобы проблема фиксировалась автоматически, а не когда вы вручную зашли и посмотрели.

---

Это принцип 1 из 10. Следующий -- **Идемпотентность**: почему `mkdir -p` лучше `mkdir`, и как писать скрипты, которые безопасно запускать повторно.

Все 10 принципов -- в полном курсе **КМБ (курс молодого бойца)**. [Подробнее о курсе](https://devopsway.ru/kmb/)

---

Telegram: [@DevITWay](https://t.me/DevITWay)
Сайт: [devopsway.ru](https://devopsway.ru/)
