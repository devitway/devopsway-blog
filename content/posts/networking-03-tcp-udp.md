---
title: "Networking 20/80, уровень 3: TCP и UDP – анатомия соединения"
date: 2026-07-23T12:00:00+03:00
lastmod: 2026-07-23T12:00:00+03:00
draft: false
weight: 4
categories: ["DevOps основы"]
tags: ["networking", "tcp", "udp", "ss", "tcpdump", "linux", "devops", "собеседование"]
author: "DevOps Way"
series: "Networking 20/80"
description: "Четвёртый уровень: чем TCP отличается от UDP, трёхстороннее рукопожатие и состояния соединения, порты, ss и tcpdump, TIME_WAIT. Почему 'Connection refused' и 'Connection timeout' – это разные диагнозы. Три подвоха с собеса и чеклист 'почему не подключается'."
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
    alt: "Networking 20/80: TCP-рукопожатие, состояния соединения, ss и tcpdump"
    caption: "Уровень 3 – анатомия соединения: refused против timeout и три пакета рукопожатия"
    relative: false
    hidden: false
editPost:
    URL: "https://github.com/devitway/devopsway-blog/tree/main/content"
    Text: "Предложить изменения"
    appendFilePath: true
---

Четвёртый из семи уровней. Адреса и имена уже пройдены – данные знают, куда ехать. Теперь про то, КАК они едут: TCP с гарантией доставки против UDP без гарантий, трёхстороннее рукопожатие, состояния соединения и два самых частых диагноза на дежурстве, которые новички путают – "refused" и "timeout".


> ""Connection refused" и "Connection timeout" – две самых частых ошибки в DevOps. Они означают совершенно разные вещи, и различие – в TCP."

---

## Откуда это пошло

**1974 – Vint Cerf и Bob Kahn публикуют TCP** (Transmission Control Protocol). Проблема: IP-пакеты могут теряться, дублироваться, приходить не в том порядке. TCP решает: надёжная, упорядоченная доставка поверх ненадёжной сети.

**1980 – UDP** (User Datagram Protocol, RFC 768). Иногда надёжность не нужна, а скорость – критична. DNS-запрос: один вопрос – один ответ, зачем рукопожатие? Видеозвонок: лучше пропустить кадр, чем ждать повторной передачи.

**Аналогия:** TCP – заказное письмо с уведомлением о вручении. UDP – открытка без обратного адреса.

---

## TCP vs UDP – фундаментальное различие

| | TCP | UDP |
|---|---|---|
| **Соединение** | Да (handshake) | Нет (fire and forget) |
| **Надёжность** | Гарантированная доставка | Нет гарантий |
| **Порядок** | Гарантирован | Не гарантирован |
| **Контроль потока** | Да (flow control, congestion) | Нет |
| **Overhead** | Высокий (20+ байт заголовок) | Низкий (8 байт) |
| **Примеры** | HTTP, SSH, SMTP, PostgreSQL | DNS, NTP, DHCP, видео, игры |
| **Для DevOps** | 95% трафика | DNS-запросы, мониторинг (StatsD) |

---

## TCP Handshake – трёхстороннее рукопожатие

```
Клиент (curl)                          Сервер (nginx:8080)
     │                                       │
     │──── SYN (seq=100) ──────────────────→│  1. "Привет, хочу подключиться"
     │                                       │
     │←─── SYN-ACK (seq=300, ack=101) ─────│  2. "ОК, я тоже готов"
     │                                       │
     │──── ACK (seq=101, ack=301) ──────────→│  3. "Подтверждаю, начинаем"
     │                                       │
     │         ═══ СОЕДИНЕНИЕ УСТАНОВЛЕНО ═══│
     │                                       │
     │──── DATA: "GET /health HTTP/1.1" ───→│  4. Отправка данных
     │                                       │
```

### Что происходит при ошибках

```
"Connection refused" (мгновенная ошибка):
     │──── SYN ──────────────→│
     │←─── RST ──────────────│  Сервер АКТИВНО отказывает:
     │                         │  - Порт не слушается
     │                         │  - Firewall с REJECT

"Connection timeout" (ожидание 30+ секунд):
     │──── SYN ──────────────→│ ... тишина ...
     │──── SYN (retry 1) ───→│ ... тишина ...
     │──── SYN (retry 2) ───→│ ... тишина ...
     │──── TIMEOUT ──────────│  Пакет пропал:
     │                         │  - Firewall с DROP (не REJECT)
     │                         │  - Хост выключен
     │                         │  - Нет маршрута
```

> **20/80 для troubleshooting:**
> - **Connection refused** → сервис не запущен ИЛИ слушает на другом порту/интерфейсе
> - **Connection timeout** → firewall DROP, хост недоступен, неправильный IP/порт

---

## Порты – адреса для приложений

```
IP-адрес = адрес компьютера (как адрес дома)
Порт = номер квартиры (какое приложение)

Полный адрес: 10.0.0.5:8080
              └─IP────┘ └порт┘
```

### Well-known порты (0–1023)

| Порт | Протокол | Сервис |
|------|---------|--------|
| 22 | TCP | SSH |
| 53 | TCP/UDP | DNS |
| 80 | TCP | HTTP |
| 443 | TCP | HTTPS |
| 5432 | TCP | PostgreSQL |
| 6379 | TCP | Redis |
| 9090 | TCP | Prometheus |
| 3000 | TCP | Grafana |
| 8080 | TCP | HTTP (альтернативный) |
| 9000 | TCP | ClickHouse (native) |
| 8123 | TCP | ClickHouse (HTTP) |
| 2379 | TCP | etcd (K8s) |
| 6443 | TCP | K8s API server |
| 10250 | TCP | kubelet |

### Ephemeral порты (32768–60999)

```bash
# Клиент использует случайный порт:
curl http://api:8080

# В TCP-пакете:
# src_port = 54321 (ephemeral – случайный)
# dst_port = 8080  (well-known – целевой)

# Диапазон ephemeral портов:
cat /proc/sys/net/ipv4/ip_local_port_range
# 32768   60999
```

---

## ss – современная замена netstat

```bash
# Все слушающие TCP-порты:
ss -tlnp
# State  Local Address:Port  Process
# LISTEN 0.0.0.0:22          sshd
# LISTEN 0.0.0.0:8080        nginx
# LISTEN 127.0.0.1:5432      postgres    ← только localhost!
# LISTEN [::]:80              nginx       ← IPv4 + IPv6

# Расшифровка флагов:
# -t = TCP
# -l = LISTEN (слушающие)
# -n = числовые порты (не резолвить имена)
# -p = показать процесс (нужен root)

# Все активные TCP-соединения:
ss -tnp
# State       Local Address:Port    Peer Address:Port    Process
# ESTAB       10.0.0.5:8080        10.0.0.10:54321      nginx
# TIME-WAIT   10.0.0.5:8080        10.0.0.11:54322

# UDP:
ss -ulnp
# LISTEN  0.0.0.0:53    coredns

# Статистика:
ss -s
# TCP: 45 (estab 12, closed 5, timewait 8)

# Фильтр по порту:
ss -tnp dst :8080
ss -tnp src :22
```

> **netstat vs ss:** `netstat` – пакет `net-tools` (deprecated). `ss` – пакет `iproute2` (современный, быстрее). На собесе используй `ss`.

---

## Состояния TCP-соединения

```
             ┌─────────┐
             │  CLOSED  │
             └────┬─────┘
        SYN sent  │  SYN received
             ┌────▼─────┐
             │ SYN_SENT │ (клиент ждёт SYN-ACK)
             └────┬─────┘
          SYN-ACK │
             ┌────▼──────┐
             │ESTABLISHED │ ← рабочее состояние
             └────┬──────┘
           FIN    │
             ┌────▼──────┐
             │ FIN_WAIT  │ (закрытие инициировано)
             └────┬──────┘
                  │
             ┌────▼──────┐
             │ TIME_WAIT │ ← ожидание 2×MSL (60 сек)
             └────┬──────┘
                  │
             ┌────▼─────┐
             │  CLOSED  │
             └──────────┘
```

### TIME_WAIT – частая проблема

```bash
# Много TIME_WAIT = нормально для высоконагруженных серверов
ss -tn state time-wait | wc -l
# 1500 ← если < 10000 – ОК

# Проблема: если > 28000 (лимит ephemeral портов)
# → "Cannot assign requested address"

# Решение (в /etc/sysctl.conf):
net.ipv4.tcp_tw_reuse = 1          # переиспользовать TIME_WAIT сокеты
net.core.somaxconn = 65535         # увеличить backlog
```

---

## tcpdump – "рентген" для сетевого трафика

```bash
# Весь трафик на интерфейсе eth0:
sudo tcpdump -i eth0

# Только TCP на порт 8080:
sudo tcpdump -i eth0 tcp port 8080

# TCP handshake (SYN, SYN-ACK, ACK):
sudo tcpdump -i eth0 'tcp[tcpflags] & (tcp-syn|tcp-ack) != 0' -c 10

# DNS-запросы:
sudo tcpdump -i eth0 udp port 53

# HTTP-запросы (ASCII):
sudo tcpdump -i eth0 -A tcp port 80

# Сохранить в файл для анализа в Wireshark:
sudo tcpdump -i eth0 -w capture.pcap tcp port 8080

# Фильтр по IP:
sudo tcpdump -i eth0 host 10.0.0.5
sudo tcpdump -i eth0 src 10.0.0.5 and dst port 8080
```

### Чтение вывода tcpdump

```
10:05:23.456789 IP 10.0.0.5.54321 > 10.0.0.10.8080: Flags [S], seq 12345
│               │  └── src:port  ┘   └── dst:port ┘  └─ SYN ┘  └── seq ┘
│               └── протокол (IP)
└── timestamp

Flags:
[S]     = SYN (начало соединения)
[S.]    = SYN-ACK (ответ на SYN)
[.]     = ACK
[P.]    = PUSH-ACK (данные)
[F.]    = FIN-ACK (закрытие)
[R.]    = RST (сброс – "connection refused")
```

---

## Практика: "Почему не подключается?"

### Чеклист диагностики (от L1 к L7)

```bash
# 1. Сеть доступна? (L3)
ping 10.0.0.10
# Если timeout → проблема маршрутизации или firewall

# 2. Порт открыт? (L4)
ss -tlnp | grep 8080
# Если пусто → сервис не слушает

# 3. TCP-соединение устанавливается?
# Быстрая проверка:
nc -zv 10.0.0.10 8080
# Connection to 10.0.0.10 8080 port [tcp/*] succeeded!  ← ОК
# nc: connect to 10.0.0.10 port 8080: Connection refused  ← порт закрыт
# nc: connect to 10.0.0.10 port 8080: Connection timed out  ← firewall DROP

# 4. Что на проводе?
sudo tcpdump -i eth0 host 10.0.0.10 and port 8080 -c 5

# 5. Приложение отвечает? (L7)
curl -v http://10.0.0.10:8080/health
```

---

## Подвохи для собеса

### Подвох 1: "Чем "Connection refused" отличается от "Connection timeout"?"

**Ответ через TCP:**

```
Connection refused:
  Клиент отправил SYN → получил RST (reset)
  Значит: пакет ДОШЁЛ до хоста, но порт НЕ слушает
  Время: мгновенно (< 1мс)
  Причины: сервис не запущен, слушает другой порт, firewall REJECT

Connection timeout:
  Клиент отправил SYN → тишина → retry → тишина → timeout
  Значит: пакет НЕ ДОШЁЛ или ответ потерялся
  Время: 30–120 секунд (зависит от tcp_syn_retries)
  Причины: firewall DROP, хост выключен, неправильный IP, нет маршрута
```

**На собесе:** "Refused – RST пришёл, хост жив, но порт закрыт. Timeout – ответа нет, пакет не дошёл или заблокирован. Разница принципиальна: refused = проблема на хосте (сервис), timeout = проблема в сети (маршрутизация/firewall)."

---

### Подвох 2: "Зачем нужен трёхстороннее рукопожатие? Почему не двустороннее?"

**Ответ:**

Двустороннее: SYN → SYN-ACK. Проблема: клиент отправил SYN, но не получил SYN-ACK (потерялся). Клиент думает, что нет соединения. Сервер думает, что есть. **Рассинхронизация.**

Трёхстороннее: SYN → SYN-ACK → ACK. Обе стороны подтвердили, что обе стороны получили подтверждение.

```
Двустороннее (сломанное):
  Client → SYN → Server       ✓ Сервер знает о клиенте
  Client ← SYN-ACK ← Server   ✓ Клиент знает о сервере
  Но сервер НЕ знает, получил ли клиент SYN-ACK!

Трёхстороннее (рабочее):
  Client → SYN → Server       ✓ Сервер знает о клиенте
  Client ← SYN-ACK ← Server   ✓ Клиент знает о сервере
  Client → ACK → Server       ✓ Сервер знает, что клиент получил
```

**На собесе:** "Трёхстороннее рукопожатие гарантирует, что обе стороны синхронизировали начальные sequence numbers и обе подтвердили готовность. Без третьего ACK – half-open connections и ресурсная утечка на сервере (SYN flood атака эксплуатирует именно это)."

---

### Подвох 3: "Когда UDP лучше TCP?"

**Ответ:**

1. **DNS** – один запрос, один ответ, < 512 байт. TCP overhead (handshake) больше самих данных
2. **Мониторинг** (StatsD, syslog) – потеря одной метрики некритична, а задержка TCP – критична
3. **Видео/аудио** – лучше пропустить кадр, чем ждать ретрансмиссии (TCP Retransmit = задержка)
4. **Игры** – латентность > надёжность
5. **QUIC/HTTP3** – Google построил надёжный протокол ПОВЕРХ UDP (вместо TCP), потому что TCP handshake = лишний RTT

**На собесе:** "UDP выбирают, когда потеря отдельных пакетов допустима, а задержка – нет. Или когда request-response укладывается в один пакет (DNS). Современный тренд – QUIC: надёжность TCP + скорость UDP, потому что рукопожатие совмещено с TLS handshake."

---

## Код-челлендж

**Задача:** на любой Linux-машине выполни диагностику и ответь:

1. Какие порты слушает nginx? (`ss -tlnp`)
2. Сколько активных TCP-соединений к PostgreSQL (порт 5432)?
3. Перехвати DNS-запрос с помощью tcpdump при выполнении `dig google.com`
4. Проверь, доступен ли порт 6443 (K8s API) на master-ноде

<details>
<summary>Решение</summary>

```bash
# 1. Порты nginx:
ss -tlnp | grep nginx
# LISTEN 0.0.0.0:80  nginx
# LISTEN 0.0.0.0:443 nginx

# 2. Активные соединения к PostgreSQL:
ss -tnp dst :5432 | grep ESTAB | wc -l

# 3. Перехват DNS:
# Терминал 1:
sudo tcpdump -i eth0 udp port 53 -c 4
# Терминал 2:
dig google.com
# Увидишь: запрос (Query) и ответ (Response)

# 4. K8s API порт:
nc -zv <master-ip> 6443 -w 3
# succeeded! → доступен
# Connection timed out → firewall блокирует
```

</details>

---

## Дальше → Уровень 4

Ты понимаешь TCP: рукопожатие, порты, состояния, умеешь диагностировать `ss` и `tcpdump`. Ты знаешь, ПОЧЕМУ "Connection refused" отличается от "timeout".

Но TCP – транспорт. Данные, которые по нему передаются – это HTTP: запросы, ответы, заголовки, статус-коды. А с 2015 года почти весь HTTP – зашифрован TLS (HTTPS). Когда ты видишь `502 Bad Gateway` или `ERR_CERT_DATE_INVALID` – это проблемы на уровне HTTP/TLS.

**→ Уровень 4: HTTP и TLS – протокол, на котором всё держится**
