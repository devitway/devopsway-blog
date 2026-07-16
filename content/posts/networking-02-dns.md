---
title: "Networking 20/80, уровень 2: DNS – как имена становятся адресами"
date: 2026-07-16T12:00:00+03:00
lastmod: 2026-07-16T12:00:00+03:00
draft: false
weight: 3
categories: ["DevOps основы"]
tags: ["networking", "dns", "coredns", "kubernetes", "ttl", "linux", "devops", "собеседование"]
author: "DevOps Way"
series: "Networking 20/80"
description: "Третий уровень мини-курса по сетям для DevOps: иерархия DNS и порядок резолвинга на Linux, ключевые типы записей, TTL, dig и CoreDNS в Kubernetes (включая ловушку ndots:5). Три подвоха с собеседования и чеклист диагностики 'почему не резолвится'."
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
    alt: "Networking 20/80: как работает DNS, dig и CoreDNS в Kubernetes"
    caption: "Уровень 2 – телефонная книга интернета: иерархия, TTL и почему 'виноват всегда DNS'"
    relative: false
    hidden: false
editPost:
    URL: "https://github.com/devitway/devopsway-blog/tree/main/content"
    Text: "Предложить изменения"
    appendFilePath: true
---

Третий из семи уровней мини-курса "Networking 20/80". На прошлом уровне научились считать подсети и адреса. Но в реальной работе ты пишешь `curl http://api.example.com`, а не голый IP. Сегодня – как имя превращается в адрес (кеш браузера → `/etc/hosts` → кеш ОС → DNS-сервер)[^resolv], почему это одна из самых частых причин инцидентов и как за минуту находить, где именно порвалось.


> "DNS – это телефонная книга интернета. Но в отличие от телефонной книги, она распределена по миллионам серверов и обновляется каждую секунду. И когда она ломается – ломается всё."

---

## Откуда это пошло

**1973 – HOSTS.TXT.** Весь ARPANET – несколько сотен компьютеров. Все имена и адреса хранятся в одном файле `HOSTS.TXT` на сервере SRI-NIC (Stanford Research Institute). Каждый администратор скачивает этот файл по FTP, чтобы обновить таблицу имён. Работает, пока хостов мало.

**1983 – Проблема масштаба.** ARPANET растёт. HOSTS.TXT обновляется раз в несколько дней. Конфликты имён. Один файл не масштабируется.

**1983 – Paul Mockapetris (USC) изобретает DNS (RFC 882, 883).** Идея: иерархическая распределённая система. Вместо одного файла – дерево серверов. Каждый отвечает за свою зону. `.com` знает про `example.com`, `example.com` знает про `api.example.com`.

**Наследие:** файл `/etc/hosts` – прямой потомок HOSTS.TXT. ОС до сих пор проверяет его ПЕРЕД DNS-запросом.

---

## Иерархия DNS

```
                    . (root)
                    │
        ┌───────────┼───────────┐
        │           │           │
       com         org         ru
        │           │           │
    ┌───┴───┐   ┌──┴──┐    ┌──┴──┐
 example  google  wiki   yandex  yadro
    │       │      │       │       │
   api    mail    en      mail     hr
```

### Как резолвится `api.example.com`

```
1. Приложение: "мне нужен IP для api.example.com"
   └─ Проверяет свой кеш (браузер/приложение) → не найдено
   └─ Проверяет /etc/hosts → не найдено
   └─ Проверяет кеш ОС (резолвер: systemd-resolved / nscd) → не найдено
   └─ Отправляет запрос DNS-серверу из /etc/resolv.conf

2. Recursive resolver (обычно 8.8.8.8 или провайдер):
   └─ Кеш? Нет → спрашивает root server (.)

3. Root server (.): "я не знаю api.example.com,
   но .com обслуживают серверы a.gtld-servers.net"

4. TLD server (.com): "я не знаю api.example.com,
   но example.com обслуживают ns1.example.com (93.184.216.1)"

5. Authoritative server (ns1.example.com):
   "api.example.com = 93.184.216.34, TTL=300"

6. Recursive resolver кеширует на 300 секунд,
   возвращает ответ приложению.
```

### Порядок резолвинга на Linux

```
/etc/nsswitch.conf:
hosts: files dns        ← СНАЧАЛА файл (/etc/hosts), ПОТОМ DNS

/etc/hosts:             ← Проверяется первым!
127.0.0.1   localhost
10.0.0.5    api.local   ← Этот адрес вернётся БЕЗ DNS-запроса

/etc/resolv.conf:       ← DNS-серверы
nameserver 8.8.8.8
nameserver 8.8.4.4
search example.com      ← При запросе "api" дополнит до "api.example.com"
```

---

## Типы DNS-записей – 20% покрывают 80%

| Тип | Что хранит | Пример | Когда используется |
|-----|-----------|--------|-------------------|
| **A** | IPv4-адрес | `api.example.com → 93.184.216.34` | Основная запись |
| **AAAA** | IPv6-адрес | `api.example.com → 2606:2800:220:1:...` | IPv6 |
| **CNAME** | Алиас → другое имя | `www.example.com → example.com` | Перенаправление |
| **MX** | Mail-сервер | `example.com → mail.example.com (pri 10)` | Почта |
| **TXT** | Текст | `example.com → "v=spf1 ..."` | SPF, DKIM, верификация |
| **NS** | DNS-сервер зоны | `example.com → ns1.example.com` | Делегирование |
| **SRV** | Сервис + порт | `_http._tcp.example.com → 0 5 8080 api.example.com` | Обнаружение сервисов (service discovery) |
| **PTR** | Обратная запись (IP → имя) | `34.216.184.93 → api.example.com` | Обратный DNS (reverse DNS) |
| **SOA** | Start of Authority | Serial, refresh, retry, expire | Метаданные зоны |

---

## dig – главный инструмент DNS-диагностики

```bash
# Базовый запрос:
dig api.example.com

# ;; ANSWER SECTION:
# api.example.com.  300  IN  A  93.184.216.34
#                    │        │  └── IP-адрес
#                    │        └── тип записи
#                    └── TTL (секунд до протухания кеша)

# Короткий формат (только ответ):
dig +short api.example.com
# 93.184.216.34

# Конкретный тип записи:
dig MX example.com
dig TXT example.com
dig NS example.com
dig AAAA api.example.com

# Конкретный DNS-сервер:
dig @8.8.8.8 api.example.com
dig @1.1.1.1 api.example.com    # Cloudflare DNS

# Reverse DNS (IP → имя):
dig -x 93.184.216.34

# Трассировка (весь путь от root до ответа):
dig +trace api.example.com
# .                   NS    a.root-servers.net
# com.                NS    a.gtld-servers.net
# example.com.        NS    ns1.example.com
# api.example.com.    A     93.184.216.34

# Все записи:
dig ANY example.com
```

### nslookup – старый инструмент (но спрашивают на собесе)

```bash
nslookup api.example.com
# Server:    8.8.8.8          ← какой DNS отвечал
# Address:   93.184.216.34    ← результат

nslookup -type=MX example.com
```

> **20/80:** используй `dig`, не `nslookup`. `dig` показывает TTL, раздел авторитетных серверов (authority section), время запроса (query time) – всё, что нужно для диагностики (troubleshooting). `nslookup` – устаревший (deprecated), но знай его для собеса.

---

## TTL – Time To Live

```bash
dig +short api.example.com
# 93.184.216.34

dig api.example.com | grep -A1 "ANSWER"
# api.example.com.  300  IN  A  93.184.216.34
#                    ^^^
#                    TTL = 300 секунд = 5 минут

# Через 5 минут кеш протухнет, resolver спросит authoritative заново.
```

### Почему TTL важен для DevOps

```
Сценарий: миграция api.example.com на новый сервер

Старый IP: 10.0.0.5
Новый IP:  10.0.0.50
TTL: 86400 (24 часа)

Проблема: после смены DNS-записи – 24 ЧАСА часть клиентов
          ходит на старый сервер (кеш не протух).

Решение: ЗА ДЕНЬ до миграции снизить TTL до 60 секунд.
         После миграции – вернуть TTL обратно.

Порядок:
1. TTL = 86400 → 60 (и подождать 24 часа, пока старый кеш протухнет)
2. Изменить A-запись: 10.0.0.5 → 10.0.0.50
3. Подождать 60 секунд (новый TTL)
4. Проверить: dig +short api.example.com → 10.0.0.50
5. TTL = 60 → 3600 (вернуть нормальное значение)
```

---

## DNS в Kubernetes – CoreDNS

### Как K8s резолвит имена

```
Pod → /etc/resolv.conf внутри pod-а:
  nameserver 10.96.0.10          ← CoreDNS ClusterIP
  search default.svc.cluster.local svc.cluster.local cluster.local
  ndots:5
```

```bash
# Из pod-а можно обращаться к сервису по короткому имени:
curl http://api:8080           # → api.default.svc.cluster.local
curl http://api.prod:8080      # → api.prod.svc.cluster.local
curl http://api.prod.svc:8080  # → api.prod.svc.cluster.local
```

### Формат DNS-имён в K8s

```
<service>.<namespace>.svc.cluster.local

Примеры:
api.default.svc.cluster.local         → ClusterIP сервиса api в namespace default
postgres.database.svc.cluster.local   → ClusterIP postgres в namespace database
```

### ndots:5 – ловушка для DevOps

```bash
# Внутри pod-а: curl http://api.example.com
# ndots:5 означает: если в имени меньше 5 точек – добавь search domain

# "api.example.com" содержит 2 точки (< 5) →
# K8s сначала попробует:
#   api.example.com.default.svc.cluster.local    ← промах
#   api.example.com.svc.cluster.local            ← промах
#   api.example.com.cluster.local                ← промах
#   api.example.com.                             ← успех!

# Это 4 лишних DNS-запроса! На высоконагруженных сервисах – bottleneck.
```

**Решение:**
```bash
# Добавить точку в конце (FQDN – Fully Qualified Domain Name):
curl http://api.example.com.     # ← точка = "не добавляй search domains"

# Или в K8s pod spec:
spec:
  dnsConfig:
    options:
      - name: ndots
        value: "2"
```

---

## Диагностика DNS (troubleshooting) – чеклист

```bash
# 1. Резолвится ли имя вообще?
dig +short api.example.com
# Пусто = не резолвится

# 2. Какой DNS-сервер используется?
cat /etc/resolv.conf
# nameserver 10.96.0.10

# 3. Отвечает ли DNS-сервер?
dig @10.96.0.10 api.example.com
# ;; connection timed out → DNS-сервер недоступен

# 4. Authoritative сервер знает запись?
dig +trace api.example.com
# Покажет, на каком уровне обрыв

# 5. Кеш устарел? Проверить TTL:
dig api.example.com | grep TTL
# Подождать TTL секунд и проверить снова

# 6. /etc/hosts перебивает DNS?
getent hosts api.example.com
# Показывает финальный результат (hosts + DNS)

# 7. CoreDNS в K8s работает?
kubectl -n kube-system get pods -l k8s-app=kube-dns
kubectl -n kube-system logs -l k8s-app=kube-dns --tail=20
```

---

## Подвохи для собеса

### Подвох 1: "Чем A-запись отличается от CNAME?"

**Ответ:**

```
A-запись: имя → IP-адрес
  api.example.com  →  93.184.216.34

CNAME: имя → другое имя (алиас)
  www.example.com  →  example.com  →  93.184.216.34
                       (ещё один lookup!)
```

**Ограничения CNAME:**
1. CNAME **нельзя** ставить на корень домена (apex, `example.com` без www). Только на поддомены. Причина: CNAME конфликтует с SOA и NS записями на корне (apex).
2. CNAME – дополнительный DNS-запрос, а значит задержка (latency)

**Альтернатива:** AWS Route53 и Cloudflare поддерживают ALIAS/ANAME – работают как CNAME, но на корне домена (apex).

**На собесе:** "A-запись возвращает IP напрямую. CNAME – перенаправление на другое имя, требующее дополнительного разрешения (resolve). CNAME нельзя на корень домена (apex). Для балансировки – используют несколько A-записей (циклическая выдача, round-robin) или ALIAS."

---

### Подвох 2: "Почему после смены DNS-записи часть пользователей видит старый адрес?"

**Ответ:** TTL кеширования.

DNS – система с согласованностью в конечном счёте (**eventually consistent**). Запись кешируется на TTL секунд:
- В резолвере (resolver, 8.8.8.8): до TTL
- В ОС: до TTL (или перезагрузки)
- В браузере: до TTL (Chrome кеширует до 60 секунд)
- В Java приложении: **НАВСЕГДА** (по умолчанию JVM кеширует DNS бесконечно!)

```bash
# Проверить текущий TTL:
dig api.example.com | grep -E "^api"
# api.example.com.  127  IN  A  93.184.216.34
#                    ^^^ осталось 127 секунд до протухания
```

**На собесе:** "DNS кешируется на каждом уровне: резолвер (resolver), ОС, приложение. TTL определяет, как долго кеш жив. После смены записи нужно ждать TTL – или заранее снизить его. Особый случай – JVM, который по умолчанию кеширует DNS навсегда: нужен `networkaddress.cache.ttl=30` в политике безопасности (security policy)."

---

### Подвох 3: "Что произойдёт, если DNS-сервер недоступен?"

**Ответ:**

1. **Кешированные записи** продолжат работать (до истечения TTL)
2. **Новые запросы** к неразрешённым именам – ошибка (fail)
3. **Ошибки:** `getaddrinfo: Name or service not known`, `NXDOMAIN` (или таймаут)
4. `/etc/hosts` записи работают всегда (не зависят от DNS)

```bash
# Симуляция: заблокировать DNS
sudo iptables -A OUTPUT -p udp --dport 53 -j DROP

# Кеш ещё работает:
dig +short api.example.com    # ответ из кеша

# Новый домен – fail:
dig +short new-service.example.com    # timeout!

# Восстановить:
sudo iptables -D OUTPUT -p udp --dport 53 -j DROP
```

**На собесе:** "Если DNS-сервер недоступен, кешированные записи продолжают работать до истечения TTL. Новые DNS-запросы будут отваливаться по таймауту. Поэтому в продакшене (production) всегда два DNS-сервера в resolv.conf. В K8s – CoreDNS с несколькими репликами."

---

## Код-челлендж

**Задача:** выполни DNS-диагностику и ответь:

1. Какие DNS-серверы настроены на твоей машине? (`/etc/resolv.conf`)
2. Какой IP у `kubernetes.default.svc.cluster.local`? (из pod-а)
3. Сколько A-записей у `google.com`? (round-robin)
4. Какой MX-сервер у `gmail.com`?
5. Какой TTL у A-записи `github.com`?

<details>
<summary>Решение</summary>

```bash
# 1. DNS-серверы:
cat /etc/resolv.conf
# nameserver 10.96.0.10

# 2. kubernetes ClusterIP (из pod-а):
dig +short kubernetes.default.svc.cluster.local
# 10.96.0.1

# 3. A-записи google.com:
dig +short google.com
# Обычно 1 IP, но может быть несколько (anycast)

# 4. MX gmail.com:
dig MX gmail.com +short
# 5 gmail-smtp-in.l.google.com.
# 10 alt1.gmail-smtp-in.l.google.com.
# ...

# 5. TTL github.com:
dig github.com | grep -E "^github"
# github.com.  60  IN  A  140.82.121.3
# TTL = 60 секунд
```

</details>

---

## Дальше → Уровень 3

Ты понимаешь DNS: иерархию, типы записей, dig для диагностики, CoreDNS в K8s. Ты знаешь, что `curl http://api:8080` сначала резолвит имя через DNS, потом подключается по IP.

Но что значит "подключается"? Когда ты видишь "Connection refused" – что именно не сработало? Когда "Connection timeout" – почему ждать 30 секунд, а не получить ошибку сразу?

Ответ – в протоколе TCP: трёхстороннее рукопожатие, порты, состояния соединения. Понимание TCP – это понимание *почему* вообще работает сетевое общение между программами.

**→ Уровень 3: TCP и UDP – анатомия соединения**

[^resolv]: Порядок канонический – так резолвит `systemd-resolved` (и это ответ, который ждут на собесе). Краевой случай: `nscd` кеширует сам результат NSS-запроса, включая `files`, и может "встать" перед `/etc/hosts`, так что точный порядок зависит от резолвера.
