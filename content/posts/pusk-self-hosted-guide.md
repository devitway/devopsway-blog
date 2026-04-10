---
title: "Pusk — свой алерт-мессенджер за 5 команд. Гайд от нуля до рабочего сервиса"
date: 2026-04-10
draft: false
description: "Ставим Pusk в Docker на свой сервер: от установки Docker до работающего мессенджера с ботами и вебхуками. Пошаговая инструкция."
categories: ["DevOps", "Self-Hosted", "Tutorial"]
tags: ["pusk", "docker", "self-hosted", "alerting", "monitoring", "telegram-alternative"]
---

У тебя есть сервер (или просто машина с Ubuntu), и тебе нужен свой мессенджер для алертов. Не Telegram (который блокируют), не Slack (который SaaS), а что-то своё, на своём железе, без зависимостей.

[Pusk](https://github.com/getpusk/pusk) — это ровно оно. Один бинарник, SQLite внутри, веб-интерфейс из коробки, API совместимый с Telegram Bot API. Ставится в Docker за пару минут.

Ниже — пошаговая установка от чистого сервера до работающего сервиса с организацией, каналами и ботами.

## Что нам понадобится

- Сервер или машина с **Ubuntu** (22.04 / 24.04). Подойдёт и Debian.
- **Root-доступ** или пользователь с `sudo`.
- Сеть — чтобы скачать Docker и образ Pusk.

Всё. Больше ничего не нужно. Ни Go, ни Node.js, ни база данных.

## Шаг 1. Ставим Docker

Docker — это штука, которая запускает приложения в изолированных контейнерах. Не надо ставить зависимости, настраивать окружение — всё уже упаковано в образ.

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-v2
```

Включаем Docker, чтобы он стартовал при загрузке системы:

```bash
sudo systemctl enable --now docker
```

Проверяем, что Docker работает:

```bash
docker --version
```

Должно показать что-то вроде `Docker version 29.x.x`. Если видишь версию — всё в порядке.

### Запуск без sudo (опционально)

По умолчанию Docker требует `sudo` для каждой команды. Чтобы не набирать его постоянно:

```bash
sudo usermod -aG docker $USER
```

После этого **выйди из терминала и зайди заново** (или перелогинься). Иначе группа не подхватится.

## Шаг 2. Создаём папку для Pusk

```bash
mkdir -p ~/pusk/data
cd ~/pusk
```

`data` — здесь Pusk будет хранить базу данных и файлы. Эту папку потом бэкапим.

## Шаг 3. Пишем конфиг

Создаём файл `docker-compose.yml`:

```bash
cat > docker-compose.yml << 'EOF'
services:
  pusk:
    image: ghcr.io/getpusk/pusk:latest
    ports:
      - "8443:8443"
    volumes:
      - ./data:/app/data
    environment:
      - PUSK_ADDR=:8443
    restart: unless-stopped
EOF
```

Что тут написано:
- `image` — берём готовый образ Pusk из GitHub Container Registry.
- `ports` — пробрасываем порт 8443 наружу. По этому порту будет веб-интерфейс.
- `volumes` — папка `data` на хосте монтируется внутрь контейнера. Данные живут на диске, а не внутри контейнера.
- `restart: unless-stopped` — если сервер перезагрузится, Pusk запустится автоматически.

## Шаг 4. Разбираемся с правами на папку

Внутри контейнера Pusk работает от пользователя `pusk` (uid=100). А папку `data` мы создали от своего пользователя (uid=1000). Контейнер не сможет в неё писать — получит Permission denied.

Фиксим:

```bash
sudo chown -R 100:101 ~/pusk/data
```

Это говорит системе: "владелец папки `data` — пользователь с uid=100", что совпадает с пользователем внутри контейнера.

> Почему так? Docker-контейнеры работают в своём пространстве пользователей. Если uid внутри не совпадает с uid снаружи — файловая система говорит "нет доступа". Это нормально и правильно с точки зрения безопасности. `chmod 777` — не решение, а заметание проблемы под ковёр.

## Шаг 5. Запускаем

```bash
cd ~/pusk
docker compose up -d
```

Docker скачает образ (один раз) и запустит контейнер в фоне (`-d` = detach).

Проверяем, что контейнер живой:

```bash
docker compose ps
```

Должен показать статус `Up`. Ещё можно дёрнуть health-эндпоинт:

```bash
curl -s http://localhost:8443/api/health
```

Ответ вида `{"status":"ok","version":"v0.7.0"}` — значит, всё работает.

## Шаг 6. Открываем в браузере

Заходим по адресу:

```
http://IP-АДРЕС-СЕРВЕРА:8443
```

Если ставишь на локальную машину — `http://localhost:8443`.

Увидишь лендинг — команда для запуска, список фич, демо-бот справа:

![Лендинг Pusk после запуска](/images/pusk-guide/pusk-landing.png)

Жмём **"Create organization"** и заполняем:

- **Organization ID** — латиницей, без пробелов (например, `myteam`)
- **Name** — название (например, `My Team`)
- **Admin username** — логин админа
- **Password** — пароль

![Форма создания организации](/images/pusk-guide/pusk-create-org.png)

Жмём **Create**. Готово — ты внутри. Канал `#general` создан автоматически, бот готов к работе, онбординг предложит создать канал `#alerts`:

![Дашборд Pusk после создания организации](/images/pusk-guide/pusk-dashboard.png)

## Что дальше

### Подключить мониторинг

У Pusk есть вебхуки. Можно подключить Alertmanager, Grafana, Zabbix, Uptime Kuma — что угодно, что умеет слать HTTP POST.

Токен бота видно на главной странице (кнопка "Show token" под ботом). URL вебхука:

```
http://IP-СЕРВЕРА:8443/hook/ТОКЕН-БОТА?format=alertmanager
```

Форматы: `alertmanager`, `grafana`, `zabbix`, `raw`.

### Дать доступ коллегам

Settings → Invite → скопировать ссылку-приглашение. Человек перейдёт по ней и зарегистрируется.

### Бэкап

Вся база данных — в папке `~/pusk/data`. Бэкапим её:

```bash
cp -r ~/pusk/data ~/pusk-backup-$(date +%Y%m%d)
```

### Обновить на новую версию

```bash
cd ~/pusk
docker compose pull
docker compose up -d
```

### Посмотреть логи

```bash
docker compose logs -f
```

`-f` — следить в реальном времени. `Ctrl+C` — выйти.

### Остановить

```bash
docker compose down
```

Данные в `data/` останутся на месте. При следующем `docker compose up -d` всё поднимется как было.

## Доступ из интернета

Из локальной сети Pusk доступен сразу — по IP сервера и порту 8443.

Если нужен доступ из интернета, есть варианты:

**Вариант 1. Проброс порта на роутере.** Заходишь в админку роутера → Port Forwarding → пробрасываешь внешний порт 8443 на внутренний IP:8443 сервера.

**Вариант 2. Reverse proxy.** Если есть домен и хочется нормальный HTTPS — ставишь nginx или Caddy перед Pusk. Caddy проще всего — автоматически получает сертификат от Let's Encrypt:

```bash
# Пример Caddyfile
pusk.example.com {
    reverse_proxy localhost:8443
}
```

## Итого

Весь процесс — 6 команд:

```bash
sudo apt install -y docker.io docker-compose-v2   # Docker
sudo systemctl enable --now docker                  # Включить
mkdir -p ~/pusk/data && cd ~/pusk                   # Папка
cat > docker-compose.yml << 'EOF'                   # Конфиг
# ... содержимое выше
EOF
sudo chown -R 100:101 ~/pusk/data                  # Права
docker compose up -d                                 # Запуск
```

Один контейнер, один порт, один файл конфигурации. Данные на диске, бэкап — копирование папки. Обновление — `pull && up -d`.

---

*Ссылки:*
- [Pusk на GitHub](https://github.com/getpusk/pusk)
- [Документация](https://github.com/getpusk/pusk#readme)
- [Миграция с Telegram](https://github.com/getpusk/pusk#migrating-from-telegram)
