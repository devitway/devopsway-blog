---
title: "Networking 20/80, уровень 4: HTTP и TLS – протокол, на котором всё держится"
date: 2026-07-30T12:00:00+03:00
lastmod: 2026-07-30T12:00:00+03:00
draft: false
weight: 5
categories: ["DevOps основы"]
tags: ["networking", "http", "tls", "https", "curl", "letsencrypt", "linux", "devops", "собеседование"]
author: "DevOps Way"
series: "Networking 20/80"
seriesTotal: 7
description: "Пятый уровень: анатомия HTTP-запроса и ответа, методы и статус-коды по группам, curl как инструмент диагностики, TLS-рукопожатие и сертификаты, Let's Encrypt, различия HTTP/1.1/2/3. Три подвоха с собеса: 401 против 403, дебаг 502 Bad Gateway, зачем TLS внутри VPC."
showToc: true
TocOpen: false
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
cover:
    image: ""
    alt: "Networking 20/80: HTTP-запрос, статус-коды, TLS-рукопожатие и сертификаты"
    caption: "Уровень 4 – HTTP как язык и TLS как конверт: читаем статус-коды и curl -v как родной текст"
    relative: false
    hidden: false
editPost:
    URL: "https://github.com/devitway/devopsway-blog/tree/main/content"
    Text: "Предложить изменения"
    appendFilePath: true
---

Пятый из семи уровней. Соединение установлено – теперь про то, что по нему говорят. HTTP как язык, на котором общается почти весь веб, и TLS как конверт, в который этот язык заворачивается. Читать статус-коды и вывод `curl -v` как родной текст – базовый навык любого дежурного.


> "HTTP – язык, на котором общается 99% веб-сервисов. TLS – конверт, в который этот язык заворачивается. DevOps должен читать HTTP как родной."

---

## Откуда это пошло

**1991 – Tim Berners-Lee (CERN) создаёт HTTP/0.9.** Одна команда: `GET /page.html`. Одно соединение – один документ. Никаких заголовков, только текст.

**1995 – SSL (Netscape).** Kipp Hickman разрабатывает Secure Sockets Layer (работы с 1994; SSL 1.0 публично не выходил). SSL 2.0 → SSL 3.0 → TLS 1.0 (1999) → TLS 1.2 (2008) → **TLS 1.3 (2018)** – текущий стандарт.

**1996 – HTTP/1.0 (RFC 1945).** Заголовки, методы POST/HEAD, статус-коды. Каждый запрос – новое TCP-соединение (медленно).

**1997 – HTTP/1.1 (RFC 2068).** Keep-alive: одно TCP-соединение для нескольких запросов. Заголовок `Host`: виртуальные хосты. До сих пор используется.

**2015 – HTTP/2 (RFC 7540).** Мультиплексирование: несколько запросов одновременно по одному соединению. Бинарный протокол (не текстовый). Сжатие заголовков.

**2022 – HTTP/3 (RFC 9114).** Поверх QUIC (UDP), а не TCP. Транспорт и TLS объединены в один round-trip (1-RTT); 0-RTT – только при возобновлении сессии.

---

## HTTP-запрос и ответ – анатомия

### Запрос

```
GET /api/health HTTP/1.1        ← метод, путь, версия
Host: api.example.com           ← обязательный заголовок (с HTTP/1.1)
User-Agent: curl/7.88.1        ← кто отправляет
Accept: application/json        ← какой формат хочу получить
Authorization: Bearer eyJ...    ← аутентификация
Content-Type: application/json  ← формат тела (для POST/PUT)
                                ← пустая строка = конец заголовков
{"name": "test"}                ← тело (body) – только для POST/PUT/PATCH
```

### Ответ

```
HTTP/1.1 200 OK                 ← версия, статус-код, причина
Content-Type: application/json  ← формат тела
Content-Length: 27              ← размер тела в байтах
Cache-Control: no-cache         ← не кешировать
X-Request-Id: abc-123           ← пользовательский заголовок (трассировка)
Set-Cookie: session=xyz         ← установить cookie
                                ← пустая строка
{"status": "healthy"}           ← тело ответа
```

---

## HTTP-методы – 20% покрывают 80%

| Метод | Что делает | Идемпотентный | Тело | Пример |
|-------|-----------|--------------|------|--------|
| **GET** | Получить данные | Да | Нет | `GET /api/users` |
| **POST** | Создать ресурс | Нет | Да | `POST /api/users` |
| **PUT** | Заменить ресурс целиком | Да | Да | `PUT /api/users/42` |
| **PATCH** | Частичное обновление | Нет | Да | `PATCH /api/users/42` |
| **DELETE** | Удалить ресурс | Да | Нет | `DELETE /api/users/42` |
| **HEAD** | GET без тела (только заголовки) | Да | Нет | Проверки живости (health checks) |
| **OPTIONS** | Какие методы поддерживает URL | Да | Нет | Предзапрос CORS (preflight) |

> **Идемпотентность** = повторный запрос даёт тот же результат. GET `/users/42` дважды → одно и то же. POST `/users` дважды → два пользователя. Это важно для логики повторов и проектирования API.

---

## Статус-коды – выучить группы, не конкретные коды

| Группа | Значение | Частые коды |
|--------|---------|------------|
| **1xx** | Информационные | `101 Switching Protocols` (WebSocket) |
| **2xx** | Успех | `200 OK`, `201 Created`, `204 No Content` |
| **3xx** | Перенаправление | `301 Moved Permanently`, `302 Found`, `304 Not Modified` |
| **4xx** | Ошибка клиента | `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`, `429 Too Many Requests` |
| **5xx** | Ошибка сервера | `500 Internal Server Error`, `502 Bad Gateway`, `503 Service Unavailable`, `504 Gateway Timeout` |

### Коды, которые DevOps видит каждый день

```
502 Bad Gateway:
  nginx (reverse proxy) не может подключиться к backend-у
  → backend упал, неправильный upstream, порт не слушается

503 Service Unavailable:
  Сервер перегружен или на обслуживании
  → слишком много запросов, deployment в процессе

504 Gateway Timeout:
  nginx ждал ответ от backend-а, но не дождался
  → backend тормозит, timeout слишком маленький

401 Unauthorized:
  Нет или невалидный токен аутентификации
  → протухший JWT, неправильный API key

403 Forbidden:
  Аутентифицирован, но нет прав
  → RBAC, недостаточные permissions

429 Too Many Requests:
  Rate limiting
  → слишком частые запросы, нужен backoff
```

---

## curl – швейцарский нож DevOps

```bash
# Базовый GET:
curl http://api:8080/health

# Verbose (показать ВСЁ: DNS, TCP, TLS, HTTP):
curl -v https://api.example.com/health

# Только HTTP-код:
curl -s -o /dev/null -w "%{http_code}" http://api:8080/health
# 200

# POST с JSON:
curl -X POST http://api:8080/users \
  -H "Content-Type: application/json" \
  -d '{"name": "test", "email": "test@example.com"}'

# С авторизацией:
curl -H "Authorization: Bearer eyJ..." http://api:8080/admin

# Тайминги (для диагностики латентности):
curl -w "\n  DNS: %{time_namelookup}s\n  TCP: %{time_connect}s\n  TLS: %{time_appconnect}s\n  TTFB: %{time_starttransfer}s\n  Total: %{time_total}s\n" \
  -o /dev/null -s https://api.example.com
#   DNS: 0.012s       ← время резолвинга
#   TCP: 0.025s       ← время TCP handshake
#   TLS: 0.089s       ← время TLS handshake
#   TTFB: 0.102s      ← Time To First Byte (до первого байта ответа)
#   Total: 0.115s

# Следовать редиректам:
curl -L http://example.com     # 301 → https://example.com → 200
```

---

## TLS – как работает HTTPS

### TLS-рукопожатие (handshake, упрощённо)

```
Клиент                                    Сервер
   │                                         │
   │── ClientHello ─────────────────────────→│  "Умею TLS 1.3, шифры + мой ключ (key share)"
   │                                         │
   │←─ ServerHello + сертификат + Finished ──│  "Мой ключ, серт и подпись – уже шифрованно"
   │                                         │
   │   [Клиент проверяет сертификат:         │
   │     - подписан доверенным CA?           │
   │     - не просрочен?                     │
   │     - совпадает имя домена?]            │
   │                                         │
   │── Finished ────────────────────────────→│  "Проверил – готов"
   │                                         │
   │═══ ШИФРОВАННЫЙ КАНАЛ (1 round-trip) ════│
   │                                         │
   │── GET /health HTTP/1.1 (зашифровано) ──→│
```

### Сертификаты – что проверяется

```bash
# Посмотреть сертификат сервера:
openssl s_client -connect api.example.com:443 -servername api.example.com </dev/null 2>/dev/null | openssl x509 -text -noout

# Ключевые поля:
# Subject: CN=api.example.com            ← для какого домена
# Issuer: C=US, O=Let's Encrypt          ← кто выдал (CA)
# Not Before: May 1 00:00:00 2024 GMT    ← начало действия
# Not After:  Jul 30 00:00:00 2024 GMT   ← конец действия (!)
# Subject Alternative Name:
#   DNS:api.example.com, DNS:*.example.com  ← все допустимые имена

# Проверить дату истечения:
echo | openssl s_client -connect api.example.com:443 -servername api.example.com 2>/dev/null | openssl x509 -noout -dates
# notBefore=May  1 00:00:00 2024 GMT
# notAfter=Jul 30 00:00:00 2024 GMT

# Одной командой – сколько дней до истечения:
echo | openssl s_client -connect api.example.com:443 -servername api.example.com 2>/dev/null \
  | openssl x509 -noout -enddate -checkend 2592000
# Certificate will expire  ← если меньше 30 дней (2592000 сек)
```

### Let's Encrypt – бесплатные сертификаты

```bash
# Получить сертификат:
certbot certonly --standalone -d api.example.com

# Автообновление (cron):
0 0 * * * certbot renew --quiet

# Сертификаты:
# /etc/letsencrypt/live/api.example.com/fullchain.pem  ← сертификат + chain
# /etc/letsencrypt/live/api.example.com/privkey.pem    ← приватный ключ
```

---

## HTTP/1.1 vs HTTP/2 vs HTTP/3

```
HTTP/1.1:
  [TCP connect] → [TLS] → [GET /] → [response] → [GET /style.css] → [response]
  Последовательно! Head-of-line blocking.

HTTP/2:
  [TCP connect] → [TLS] → [GET / + GET /style.css + GET /app.js] → [responses]
  Мультиплексирование: все запросы одновременно по одному соединению.

HTTP/3 (QUIC):
  [QUIC connect + TLS одновременно] → [requests] → [responses]
  Поверх UDP. Нет TCP head-of-line blocking. Быстрее при потере пакетов.
```

---

## Подвохи для собеса

### Подвох 1: "В чём разница между 401 и 403?"

```
401 Unauthorized (плохое название – на самом деле "Unauthenticated"):
  "Я не знаю, кто ты. Покажи удостоверение."
  → Нет токена, или токен невалидный/просроченный
  → Решение: залогиниться, обновить токен

403 Forbidden:
  "Я знаю, кто ты, но тебе сюда нельзя."
  → Токен валидный, но у пользователя нет прав
  → Решение: выдать роль/permission, проверить RBAC
```

**На собесе:** 401 – аутентификация (кто ты?), 403 – авторизация (что тебе разрешено?). Название 401 Unauthorized вводит в заблуждение – по смыслу это Unauthenticated, и часть фреймворков путают эти коды.

---

### Подвох 2: "Что такое 502 Bad Gateway и как его дебажить?"

**Ответ через архитектуру:**

```
Клиент → nginx → backend (app)

502 = nginx получил невалидный ответ от backend-а (или не смог подключиться)
```

**Чеклист:**
```bash
# 1. Backend жив?
curl http://backend:8080/health     # из того же хоста, где nginx

# 2. Backend слушает?
ss -tlnp | grep 8080               # на хосте backend-а

# 3. Сеть между nginx и backend?
nc -zv backend 8080                 # с хоста nginx

# 4. Логи nginx:
tail -f /var/log/nginx/error.log
# "upstream prematurely closed connection" → backend упал mid-request
# "connect() failed (111: Connection refused)" → backend не слушает
# "upstream timed out (110: Connection timed out)" → backend тормозит → 504

# 5. Логи backend-а:
docker logs backend --tail 50
```

**На собесе:** 502 – nginx не смог получить валидный ответ от апстрима. Причины помимо очевидных: файрвол блокирует, OOM-kill бэкенда. Диагностика – по чеклисту выше: curl к бэкенду мимо nginx, ss на бэкенде, error.log.

---

### Подвох 3: "Зачем нужен TLS, если трафик идёт внутри VPC?"

**Ответ:**

1. **Соответствие требованиям** – PCI DSS, HIPAA, GDPR требуют шифрование данных при передаче
2. **Zero Trust** – модель "не доверяй сети": VPC может быть скомпрометирован
3. **Горизонтальное перемещение (lateral movement)** – закрепившийся на одном хосте атакующий может снифать незашифрованный трафик соседних сервисов
4. **mTLS (mutual TLS)** – обе стороны предъявляют сертификат. Service mesh (Istio, Linkerd) автоматизирует это

**На собесе:** в Zero Trust шифрование нужно даже внутри VPC, а service mesh (Istio/Linkerd) внедряет mTLS между сервисами без изменения кода – текущий отраслевой стандарт для K8s.

---

## Код-челлендж

**Задача:** выполни HTTP-диагностику:

1. Получи HTTP-код ответа от `https://github.com` без тела (только код)
2. Измерь время DNS, TCP, TLS и TTFB для `https://google.com`
3. Проверь, когда истекает TLS-сертификат `github.com`
4. Отправь POST-запрос с JSON на httpbin.org: `curl -X POST https://httpbin.org/post -H "Content-Type: application/json" -d '{"test":true}'`

<details>
<summary>Решение</summary>

```bash
# 1. HTTP-код:
curl -s -o /dev/null -w "%{http_code}\n" https://github.com
# 200

# 2. Тайминги:
curl -w "DNS:%{time_namelookup}s TCP:%{time_connect}s TLS:%{time_appconnect}s TTFB:%{time_starttransfer}s Total:%{time_total}s\n" \
  -o /dev/null -s https://google.com

# 3. Сертификат:
echo | openssl s_client -connect github.com:443 2>/dev/null | openssl x509 -noout -dates

# 4. POST:
curl -X POST https://httpbin.org/post \
  -H "Content-Type: application/json" \
  -d '{"test":true}'
```

</details>

---

## Дальше → Уровень 5

Ты владеешь HTTP: методы, коды, заголовки, curl для диагностики. Понимаешь TLS: рукопожатие, сертификаты, openssl для проверки. Это "прикладной" уровень сетей.

Но кто решает, КАКОЙ трафик может пройти, а какой – нет? Файрвол. В Linux – iptables/nftables. В облаках – Security Groups. В K8s – NetworkPolicy. Сетевая безопасность – следующий слой.

**→ Уровень 5: Firewall и сетевая безопасность**
