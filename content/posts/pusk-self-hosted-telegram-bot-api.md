---
title: "Страх и ненависть в Telegram: Как я написал свой Bot API на рельсах НОРЫ"
date: 2026-03-19
categories: ["Инфраструктура"]
tags: ["devops", "golang", "telegram", "self-hosted", "artais"]
description: "РКН замедляет мессенджер, мониторинг 50+ компаний под угрозой. Рассказываю, как за неделю собрать автономный бот-шлюз на Go, когда в штате нет лишних девопсов."
---

> «У нас было два бинарника на 22 МБ, 75 SQLite-файлов, 5 петабайт ИИ-данных в НОРЕ и целое множество энкодеров всех сортов и расцветок...»

Мы оказались где-то посреди цифровой пустыни между Лас-Вегасом и Бейкерсфилдом, когда до нас начало доходить: Telegram — всё. С 10 февраля медиа тормозят, а 1 апреля маячит полная блокировка.

### Боль: Мониторинг на грани слепоты

У товарища на поддержке **50+ организаций** (кино, вещание, живые эфиры). Вся инфраструктура мониторинга — это **Zabbix + Python-боты**. Они годами слали в Telegram всё: от SNMP-статусов железа до скриншотов эфира и алертов по битрейту.

**Проблема:** В штате этих компаний **нет собственных DevOps-инженеров**. Тяжелые решения вроде Mattermost или Rocket.Chat с их PostgreSQL/MongoDB кластерами — это «кирпич» в перспективе месяца. Кто будет чинить базу в 3 часа ночи, когда упадет эфир?

### Решение: Операция «Pusk»

Я не стал менять ботов. Я просто заменил им среду обитания. На тех же рельсах и пайплайнах, на которых я строю [**НОРУ**](https://github.com/getnora-io/nora) (artifact registry на Rust), я запустил производство [**Pusk**](https://github.com/getpusk/pusk).

Это **Telegram Bot API без Telegram**. Полностью автономный сервер на Go.

#### Почему это сработало:
* **Миграция в одну строку:** В коде бота меняется только `base_url`. Всё. aiogram, telegraf и прочие думают, что они в ТГ.
* **Webhook Relay:** Моя любимая фича. Бот подключается через WebSocket. **ngrok больше не нужен** — алерты долетают до бота за NAT мгновенно по исходящему соединению.
* **Железная стабильность:** 42 E2E + 98 unit-тестов и аудит безопасности. 22 МБ бинарника, который «кушает» 3 МБ RAM при старте.
* **Multi-tenant:** Каждая организация живет в своей изолированной SQLite базе. Бэкап? Просто `cp pusk.db`.

### Как выглядит миграция

```python
# Было (Telegram)
bot = Bot(token="123:ABC", base_url="https://api.telegram.org")

# Стало (Pusk)
bot = Bot(token="my-token", base_url="https://pusk.company.ru")
```

Один diff. aiogram, python-telegram-bot, telegraf (Node.js), curl — всё работает. JSON-формат `sendMessage`, `InlineKeyboardMarkup`, `CallbackQuery` — идентичен Telegram. Бот даже не узнает, что переехал.

### Архитектура: что внутри 22 МБ

```
pusk (22 MB binary)
├── Bot API    /bot/{token}/{method}    ← Telegram-совместимый
├── Client API /api/*                   ← PWA backend
├── WebSocket  /api/ws                  ← real-time push
├── Relay      /bot/{token}/relay       ← webhook без ngrok
├── Files      /file/{id}              ← медиа
├── PWA        /                        ← встроенный веб-клиент
└── SQLite     data/orgs/{slug}/pusk.db ← per-tenant
```

7900 строк Go. 6 прямых зависимостей: gorilla/websocket, modernc.org/sqlite (pure Go, без CGO), webpush-go, golang-jwt, prometheus, x/crypto. БД — один файл. Бинарник работает на любом Linux без libc.

### Webhook Relay: почему ngrok больше не нужен

Каждый, кто разрабатывал Telegram-бота с вебхуками, знает эту боль:

```
До:  Telegram → HTTP POST → ngrok → localhost:3000
                              ↑
                     платный, ненадёжный, корпоративный файрвол

После: Pusk ← WebSocket ← localhost:3000
                ↑
       исходящее соединение, работает за NAT/VPN
```

Бот открывает исходящее WebSocket-соединение к Pusk. Сервер пушит Updates через этот канал — именно server-push, а не long polling. Latency минимальный, лишнего трафика нет. Работает за NAT, VPN, корпоративным файрволом.

Аналог: Stripe CLI (`stripe listen --forward-to localhost:3000`), но встроен в платформу.

### Multi-tenant: изоляция из коробки

Каждая организация — отдельная SQLite база:

```
data/orgs/broadcaster-1/pusk.db
data/orgs/studio-xyz/pusk.db
data/orgs/live-event-co/pusk.db
```

Регистрация — один POST. Ответ — JWT с `org: "studio-xyz"`. При создании org автоматически создаётся системный бот, канал #general и welcome-сообщение с curl-примером. Новый клиент подключается за 2 минуты.

### Что под капотом: честные цифры

Я не строю авианосец там, где нужен катер. Условия бенчмарка: 4 vCPU, 16 GB RAM, NVMe SSD. wrk (reads), hey (writes).

| Операция | Скорость | Latency (p50) |
|----------|----------|---------------|
| Health (no DB) | 228,000 req/s | 0.5 ms |
| **Reads (JWT + SQLite)** | **15,300 req/s** | 7.9 ms |
| Chat messages (JWT + SQLite) | 10,000 req/s | 11.6 ms |
| **Writes (последовательно)** | **64 req/s** | 15 ms |

SQLite — single-writer, 64 req/s на записи. Для контекста: Telegram лимитирует ботов на 30 msg/s. Pusk перекрывает с запасом.

**RAM:** 3 MB при старте → 27 MB под нагрузкой. Всё равно в 100 раз меньше Mattermost.

При 50 concurrent writers SQLite отдаёт busy. В roadmap — write queue (Go channel перед SQLite writer). Для 500+ org — переход на PostgreSQL.

### А что насчёт official Telegram Bot API Server?

У Telegram есть [официальный self-hosted сервер](https://github.com/tdlib/telegram-bot-api) (4.1K stars). Но это **прокси к серверам Telegram**. Для запуска нужны `api_id` и `api_hash`, и он постоянно стучит в `api.telegram.org`.

Если Telegram заблокирован — official server бесполезен. Pusk работает полностью автономно: никаких Telegram-аккаунтов, никакого подключения к внешним серверам.

### Безопасность: не «потом допилим»

Security audit прошёл параллельно с разработкой. 27 issues найдено, 20+ закрыто до релиза:

- bcrypt для PIN-кодов, random JWT secret
- Rate limiting per IP (token bucket)
- IDOR-защита: проверка владельца чата
- SSRF: URL-парсинг + DNS-resolve + проверка IsPrivate/IsLoopback
- XSS: markdown только http/https, JS-контексты экранированы
- Файлы требуют JWT, WebSocket — origin-validation
- Graceful shutdown: SIGTERM → 5s grace → SQLite flush

42 E2E Playwright + 98 unit-тестов: auth, IDOR, rate limit, multi-tenant isolation, Bot API.

### CI/CD: те же рельсы, что у NORA

Self-hosted runner, те же пайплайны:

- **CI:** go build → vet → staticcheck → gofmt → JS integrity → gitleaks
- **Pre-commit hooks:** блок приватных IP и бинарников до коммита
- **Release:** Docker multi-stage build (Alpine) → GHCR → версия через ldflags
- **OpenSSF Scorecard** + **Dependabot** — security на автопилоте

Один подход к CI/security/релизам для Rust-проекта и Go-проекта. Инфра окупается: второй продукт на тех же рельсах — за неделю.

### Что Pusk НЕ делает

Честность важнее маркетинга:

- Нет тредов, видеозвонков, LDAP/SSO
- Нет нативного мобильного приложения (PWA работает)
- Не тестировалось на 10,000+ пользователей
- SQLite не потянет 1000+ msg/sec — нужен PostgreSQL

**Кому подойдёт:** мониторинг оборудования, CI/CD нотификации, broadcast/media, ITSM — любой сценарий, где Telegram-боты использовались для алертов.

**Кому НЕ подойдёт:** корпоративный мессенджер на 10К человек, SSO/LDAP, primary чат для всей компании.

### Сравнение: катер vs авианосец

| | Pusk | Mattermost | Rocket.Chat | Matrix |
|---|---|---|---|---|
| Размер | 22 MB | ~800 MB | ~400 MB | ~200 MB |
| RAM | 3-27 MB | 4+ GB | 2+ GB | 1-4 GB |
| БД | SQLite | PostgreSQL | MongoDB (replica!) | PostgreSQL |
| Настройка | `./pusk` | docker-compose | MongoDB + конфиг | homeserver.yaml |
| Telegram API | Да | Нет | Нет | Нет |
| Миграция ботов | 1 строка | Переписать | Переписать | Переписать |
| Лицензия | BSL 1.1 | MIT (Team) | MIT | Apache 2.0 |

BSL 1.1, как у Sentry и CockroachDB. Self-hosted для своей команды — бесплатно. Ограничение только на перепродажу как SaaS. MIT после 2030.

### Roadmap

- **Write queue** — буферизация записей для burst-сценариев
- **PostgreSQL** — когда 500+ org
- **RBAC** — роли внутри организации
- **Audit log** — для compliance

---

### Итог: Непрерывность бизнеса своими руками

Внедрение идет прямо сейчас. Мы не просто спасаем мониторинг — мы строим автономную экосистему **АРТАИС**, где инфраструктура не зависит от капризов внешних API и блокировок.

**Хотите попробовать?**
* **Demo с AI-ботом:** [getpusk.ru](https://getpusk.ru) (кнопка «Попробовать демо», DemoBot отвечает в реальном времени)
* **Source:** [github.com/getpusk/pusk](https://github.com/getpusk/pusk)

```bash
# Или запустите за 10 секунд
git clone https://github.com/getpusk/pusk.git
cd pusk && go build -o pusk ./cmd/pusk/
./pusk
```
