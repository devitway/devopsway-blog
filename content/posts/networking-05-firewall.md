---
title: "Networking 20/80, уровень 5: Firewall и сетевая безопасность"
date: 2026-08-08T14:00:00+03:00
lastmod: 2026-08-08T14:00:00+03:00
draft: false
weight: 6
categories: ["DevOps основы"]
tags: ["networking", "firewall", "iptables", "networkpolicy", "security", "kubernetes", "linux", "devops", "собеседование"]
author: "DevOps Way"
series: "Networking 20/80"
seriesTotal: 7
description: "Шестой уровень: iptables (таблицы, цепочки, правила и почему их порядок критичен), DROP против REJECT, Kubernetes NetworkPolicy, Security Groups в облаках, чеклист диагностики межсетевого экрана. Подвохи с собеса и код-челлендж на написание NetworkPolicy."
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
    alt: "Networking 20/80: iptables, NetworkPolicy и Security Groups"
    caption: "Уровень 5 – фильтр, а не стена: DROP против REJECT и почему порядок правил решает"
    relative: false
    hidden: false
editPost:
    URL: "https://github.com/devitway/devopsway-blog/tree/main/content"
    Text: "Предложить изменения"
    appendFilePath: true
---

Шестой из семи уровней. Ты умеешь пускать трафик – теперь про то, как его фильтровать. Межсетевой экран (firewall) – не "стена", а решение для каждого пакета: пропустить, отбросить молча или отказать явно. Разница между DROP и REJECT однажды сэкономит тебе час отладки "зависшего" клиента.


> "Межсетевой экран – не стена, а фильтр. Он не "блокирует всё", а решает для каждого пакета: пропустить (ACCEPT), отбросить молча (DROP) или отказать явно (REJECT)."

---

## Откуда это пошло

**1988 – первый сетевой червь** (Morris Worm) заразил ~6000 машин из ~60000 подключённых к интернету, и мир осознал: сети нужна защита. К 1989–1992 в DEC и AT&T Bell Labs появились пакетные фильтры – проверять каждый пакет по правилам (src/dst IP, порт, протокол) и пропускать либо блокировать.

**1998 – Netfilter** (Rusty Russell). iptables вышел с ядром Linux 2.4 (2001), заменив ipchains, и стал стандартом на 20 лет. Netfilter – подсистема ядра, iptables – интерфейс к ней. С 2014 его сменяет nftables (единый синтаксис, атомарные обновления) – в 2026 стандарт в RHEL 9 и Debian 12.

**2017 – Kubernetes NetworkPolicy.** Межсетевой экран как код: YAML вместо правил iptables. Реализуют Calico, Cilium.

---

## iptables – фундамент (до сих пор на собесах)

### Архитектура: таблицы → цепочки → правила

Пакет проходит через цепочки Netfilter в строгом порядке – на каждой его можно отфильтровать или подменить ему адрес:

```
Пакет приходит
      │
      ▼
┌─────────────┐
│  PREROUTING │  ← DNAT (подменить dst IP)
└──────┬──────┘
       │
  ┌────▼────┐   Для этого хоста?
  │ Routing │───── Нет ──→ FORWARD → POSTROUTING → наружу
  └────┬────┘                  (транзит: хост как роутер)
       │ Да
       ▼
┌──────────────┐
│    INPUT     │  ← фильтрация входящего трафика
└──────┬───────┘
       │
   [Приложение]
       │
       ▼
┌──────────────┐
│    OUTPUT    │  ← фильтрация исходящего трафика
└──────┬───────┘
       ▼
┌──────────────┐
│ POSTROUTING  │  ← SNAT/MASQUERADE (подменить src IP)
└──────────────┘
```

Практическое правило: свои порты закрываешь в **INPUT**, а Docker/K8s и NAT живут в **FORWARD** и **POSTROUTING**. Транзитный трафик (когда хост работает маршрутизатором) минует INPUT/OUTPUT.

### Базовые команды

```bash
# Показать все правила:
sudo iptables -L -n -v --line-numbers
# -L = list, -n = числовые адреса, -v = verbose, --line-numbers = номера

# Показать NAT-правила:
sudo iptables -t nat -L -n -v

# Ответы на уже установленные соединения – СТАВИТЬ ПЕРВЫМ
# (большинство пакетов попадёт сюда, правила ниже не проверяются):
sudo iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
# (-m state --state ... – устаревший синоним, всё ещё работает)

# Разрешить SSH (порт 22):
sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT

# Разрешить HTTP/HTTPS:
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# Заблокировать всё остальное (доходят только новые входящие, не покрытые выше):
sudo iptables -A INPUT -j DROP

# Удалить правило по номеру:
sudo iptables -D INPUT 3

# Сбросить все правила:
sudo iptables -F

# Сохранить правила (по умолчанию они живут только в памяти ядра):
sudo iptables-save > /etc/iptables/rules.v4     # netfilter-persistent грузит их при boot
sudo iptables-restore < /etc/iptables/rules.v4  # восстановить вручную
```

### Порядок правил – КРИТИЧЕСКИ ВАЖЕН

```bash
# ПРАВИЛА ПРОВЕРЯЮТСЯ СВЕРХУ ВНИЗ, ПЕРВОЕ СОВПАДЕНИЕ ПОБЕЖДАЕТ

# Правильно:
iptables -A INPUT -p tcp --dport 22 -j ACCEPT     # 1. SSH – ОК
iptables -A INPUT -p tcp --dport 80 -j ACCEPT     # 2. HTTP – ОК
iptables -A INPUT -j DROP                          # 3. Всё остальное – DROP

# Неправильно (заблокирует ВСЁ, включая SSH):
iptables -A INPUT -j DROP                          # 1. DROP всё ← !!! SSH тоже
iptables -A INPUT -p tcp --dport 22 -j ACCEPT     # 2. Никогда не достигнется
```

> **20/80:** 90% iptables работы – это цепочка INPUT с ACCEPT для нужных портов и DROP/REJECT по умолчанию.

---

## DROP против REJECT – почему это важно

```bash
# DROP – молча отбросить пакет:
iptables -A INPUT -p tcp --dport 8080 -j DROP
# Клиент: "Connection timed out" (ждёт 30+ секунд)
# Атакующий: не знает, есть ли хост

# REJECT – отправить RST/ICMP:
iptables -A INPUT -p tcp --dport 8080 -j REJECT
# Клиент: "Connection refused" (мгновенно)
# Атакующий: знает, что хост жив

# Рекомендация:
# - Внешний firewall (internet-facing): DROP (не раскрывать информацию)
# - Внутренний firewall (между сервисами): REJECT (быстрая диагностика)
```

---

## Kubernetes NetworkPolicy

### Без NetworkPolicy – всё открыто

```
По умолчанию в K8s: ЛЮБОЙ pod может общаться с ЛЮБЫМ pod-ом.
Это как офис без дверей – удобно, но небезопасно.
```

### С NetworkPolicy – белый список (whitelist)

```yaml
# Разрешить трафик к api ТОЛЬКО от frontend (namespace=prod):
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-allow-frontend
  namespace: prod
spec:
  podSelector:
    matchLabels:
      app: api                  # применяется к pod-ам с label app=api
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: frontend     # разрешить от frontend
      ports:
        - protocol: TCP
          port: 8080
```

### Типичные NetworkPolicy для DevOps

```yaml
# 1. Deny all ingress (потом разрешать явно):
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-all-ingress
  namespace: prod
spec:
  podSelector: {}               # все pod-ы в namespace
  policyTypes:
    - Ingress                   # блокировать входящий
  # ingress: [] – пустой список = ничего не разрешено

---
# 2. Egress ТОЛЬКО на DNS. ВНИМАНИЕ: в одиночку эта политика отрежет ВЕСЬ
#    остальной исходящий трафик. Ставить как "дырку" для DNS в паре
#    с default-deny-egress (иначе pod-ы не резолвят имена):
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-dns
  namespace: prod
spec:
  podSelector: {}
  policyTypes:
    - Egress
  egress:
    - to: []
      ports:
        - protocol: UDP
          port: 53
        - protocol: TCP
          port: 53

---
# 3. Разрешить трафик из monitoring namespace:
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-prometheus-scrape
  namespace: prod
spec:
  podSelector: {}
  policyTypes:
    - Ingress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: monitoring
      ports:
        - protocol: TCP
          port: 9090
```

> **Важно:** NetworkPolicy работает только если CNI-плагин поддерживает их. **Calico**, **Cilium** – поддерживают. Flannel – НЕ поддерживает (политика создастся, но действовать не будет).

---

## Security Groups (облака) – межсетевой экран для виртуальных машин

| Правило Security Group (AWS) | Эквивалент в iptables |
|---|---|
| Inbound: TCP 22 из 0.0.0.0/0 | `iptables -A INPUT -p tcp --dport 22 -j ACCEPT` |
| Inbound: TCP 80 из 0.0.0.0/0 | `iptables -A INPUT -p tcp --dport 80 -j ACCEPT` |
| Inbound: TCP 8080 из 10.0.0.0/16 | `iptables -A INPUT -s 10.0.0.0/16 -p tcp --dport 8080 -j ACCEPT` |
| Outbound: всё из 0.0.0.0/0 | `iptables -A OUTPUT -j ACCEPT` |

**Ключевое отличие от iptables:**
- Security Groups – **с учётом состояния (stateful)**: если разрешён входящий TCP 80, ответные пакеты автоматически разрешены
- iptables по умолчанию – **без учёта состояния (stateless)**: нужно явно разрешать `ESTABLISHED,RELATED`

---

## Диагностика межсетевого экрана – чеклист

```bash
# 1. Проверить, есть ли подключение БЕЗ firewall:
nc -zv target-host 8080
# timeout → firewall DROP или хост недоступен; refused → порт не слушает
# (что значит timeout/refused по сути – разбирали в уровне 3)

# 2. Проверить iptables INPUT:
sudo iptables -L INPUT -n -v --line-numbers | grep 8080
# Если нет правила ACCEPT для порта → заблокировано

# 3. Проверить K8s NetworkPolicy:
kubectl get networkpolicy -n prod
kubectl describe networkpolicy api-allow-frontend -n prod

# 4. Снять блокировку для диагностики (ТОЛЬКО временно, ОПАСНО в production!):
sudo iptables -F INPUT           # сбросить ВСЕ правила цепочки INPUT
# "iptables -P INPUT ACCEPT" меняет лишь политику и НЕ поможет,
# если трафик режется явным правилом "-j DROP" (оно сработает раньше)

# 5. Логировать отбрасываемые пакеты. LOG не терминальный, поэтому
#    LOG обязан идти ПЕРЕД DROP – иначе пакет отбросится до записи в лог:
sudo iptables -A INPUT -j LOG --log-prefix "DROPPED: " --log-level 4
sudo iptables -A INPUT -j DROP
# Логи: dmesg | grep DROPPED
```

---

## Подвохи для собеса

### Подвох 1: "Чем iptables отличается от Security Groups?"

| | iptables | Security Groups |
|---|---|---|
| **Где** | Linux-хост | Облачная ВМ (AWS, GCP, Azure) |
| **Учёт состояния** | Без состояния (stateless) | С учётом состояния (stateful) |
| **Управление** | CLI (`iptables -A`) | API / консоль |
| **Сохранность** | Правила в памяти ядра; чтобы пережили reboot – сохранить (iptables-save + netfilter-persistent, nftables.conf, Ansible) | Persistent by design (хранит облако) |
| **Детализация** | Пакет, интерфейс, цепочка | Только правила входящего/исходящего |
| **Производительность** | Деградирует при >10K правил | Оптимизировано облаком |

**На собесе:** "iptables – firewall на уровне хоста в ядре Linux, stateless по умолчанию, требует явно разрешать ответные пакеты. Security Groups – облачный firewall, stateful, ответы разрешает сам. NetworkPolicy – третий уровень, на уровне подов через CNI (Calico/Cilium)."

---

### Подвох 2: "Почему после добавления NetworkPolicy pod перестал работать?"

**Ответ:**

NetworkPolicy – **белый список**. Как только хотя бы одна политика применяется к pod-у, **весь не-описанный трафик блокируется**.

```yaml
# Добавили deny-all → pod не может:
# - резолвить DNS (нет egress на UDP 53)
# - ходить к другим сервисам (нет egress rules)
# - получать health check от kubelet (нет ingress от node)
```

**Частые ошибки:**
1. Забыли разрешить DNS (UDP 53)
2. Забыли разрешить health check от kubelet
3. Забыли разрешить egress к внешним сервисам
4. Неправильный селектор меток – политика не применяется к нужным pod-ам

**На собесе:** "NetworkPolicy – аддитивный белый список: первая же политика блокирует всё неявное. Классика – забыть DNS egress: pod не резолвит имена, HTTP-вызовы падают с "Name or service not known" – похоже на DNS, а виновата сеть."

---

### Подвох 3: "Почему `iptables -F` иногда полностью закрывает сервер?"

**Ответ:**

`-F` (flush) убирает ПРАВИЛА из цепочки, но НЕ трогает её политику по умолчанию (default policy). Если политика выставлена в DROP, после flush исчезают все ACCEPT-правила – и остаётся голый DROP на всю цепочку. Итог: сервер отрезан, вместе с SSH.

```bash
iptables -P INPUT DROP                          # политика по умолчанию – блокировать
iptables -A INPUT -p tcp --dport 22 -j ACCEPT   # разрешили SSH
iptables -F INPUT                               # ← убрали ACCEPT; остался DROP-policy → SSH отвалился
```

**На собесе:** "`-F` сбрасывает правила, но не политику цепочки. При `-P INPUT DROP` flush оставляет только запрет – доступ теряется. Поэтому на удалённом сервере сначала `iptables -P INPUT ACCEPT`, потом `-F`; и всегда держи под рукой консоль или IPMI."

---

## Код-челлендж

**Задача:** напиши Kubernetes NetworkPolicy, которая:

1. Применяется к pod-ам с меткой `app: database` в namespace `prod`
2. Разрешает ingress ТОЛЬКО от pod-ов с меткой `app: api` на порту TCP 5432
3. Разрешает ingress от Prometheus (namespace `monitoring`) на порту TCP 9187
4. Блокирует весь остальной ingress

<details>
<summary>Решение</summary>

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: database-ingress
  namespace: prod
spec:
  podSelector:
    matchLabels:
      app: database
  policyTypes:
    - Ingress
  ingress:
    # Разрешить API → Database:
    - from:
        - podSelector:
            matchLabels:
              app: api
      ports:
        - protocol: TCP
          port: 5432
    # Разрешить Prometheus → Database (metrics):
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: monitoring
      ports:
        - protocol: TCP
          port: 9187
    # Всё остальное неявно заблокировано
    # (потому что policyTypes содержит Ingress)
```

</details>

---

## Дальше → Уровень 6

Ты умеешь настраивать межсетевой экран: iptables для хостов, NetworkPolicy для K8s. Понимаешь DROP против REJECT, stateful против stateless, подход белого списка.

Но в проде трафик идёт не напрямую к pod-у. Между клиентом и приложением – балансировщик нагрузки (L4 или L7), обратный прокси (reverse proxy, nginx), Ingress-контроллер. В сервисной сетке (service mesh) – ещё и прокси-контейнер (sidecar, Envoy). Как всё это работает вместе?

**→ Уровень 6: Балансировка нагрузки и сети Kubernetes**
