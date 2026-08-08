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
description: "Шестой уровень: iptables (таблицы, цепочки, правила и почему их порядок критичен), DROP против REJECT, Kubernetes NetworkPolicy, Security Groups в облаках, чеклист диагностики файрвола. Подвохи с собеса и код-челлендж на написание NetworkPolicy."
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

Шестой из семи уровней. Ты умеешь пускать трафик – теперь про то, как его фильтровать. Firewall – не "стена", а решение для каждого пакета: пропустить, отбросить молча или отказать явно. Разница между DROP и REJECT однажды сэкономит тебе час дебага "зависшего" клиента.


> "Firewall – не стена, а фильтр. Он не "блокирует всё", а решает для каждого пакета: пропустить (ACCEPT), отбросить молча (DROP) или отказать явно (REJECT)."

---

## Откуда это пошло

**1988 – первый сетевой червь** (Morris Worm). Заразил ~6000 машин из ~60000 подключённых к интернету. Мир осознал: сети нужна защита.

**1989–1992 – packet filter firewalls.** DEC, AT&T Bell Labs. Идея: проверять каждый пакет по набору правил (src/dst IP, порт, протокол). Если правило совпало – пропустить или заблокировать.

**1998 – iptables** (Rusty Russell). Замена ipchains, в ядре с Linux 2.4 (2001). Стал стандартом на 20 лет. Netfilter – подсистема ядра, iptables – интерфейс к ней.

**2014 – nftables.** Замена iptables: единый синтаксис, лучшая производительность, атомарные обновления. В 2026 году – стандарт в RHEL 9, Debian 12.

**2017 – Kubernetes NetworkPolicy.** Firewall как код: YAML вместо iptables rules. Calico, Cilium – реализации.

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

Практическое правило: свои порты закрываешь в **INPUT**, а Docker/K8s и NAT живут в **FORWARD** и **POSTROUTING**. Транзитный трафик (когда хост работает роутером) минует INPUT/OUTPUT.

### Базовые команды

```bash
# Показать все правила:
sudo iptables -L -n -v --line-numbers
# -L = list, -n = числовые адреса, -v = verbose, --line-numbers = номера

# Показать NAT-правила:
sudo iptables -t nat -L -n -v

# Разрешить SSH (порт 22):
sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT

# Разрешить HTTP/HTTPS:
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# Разрешить ответы на исходящие соединения:
sudo iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# Заблокировать всё остальное:
sudo iptables -A INPUT -j DROP

# Удалить правило по номеру:
sudo iptables -D INPUT 3

# Сбросить все правила:
sudo iptables -F
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

> **20/80:** 90% iptables работы – это INPUT chain с ACCEPT для нужных портов и DROP/REJECT по умолчанию.

---

## DROP vs REJECT – почему это важно

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

### С NetworkPolicy – whitelist

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
# 2. Разрешить DNS (без этого pod-ы не смогут резолвить имена!):
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
              name: monitoring
      ports:
        - protocol: TCP
          port: 9090
```

> **Важно:** NetworkPolicy работает только если CNI-плагин поддерживает их. **Calico**, **Cilium** – поддерживают. Flannel – НЕ поддерживает (policy будет создана, но не будет enforced).

---

## Security Groups (облака) – firewall для VM

| Правило Security Group (AWS) | Эквивалент в iptables |
|---|---|
| Inbound: TCP 22 из 0.0.0.0/0 | `iptables -A INPUT -p tcp --dport 22 -j ACCEPT` |
| Inbound: TCP 80 из 0.0.0.0/0 | `iptables -A INPUT -p tcp --dport 80 -j ACCEPT` |
| Inbound: TCP 8080 из 10.0.0.0/16 | `iptables -A INPUT -s 10.0.0.0/16 -p tcp --dport 8080 -j ACCEPT` |
| Outbound: всё из 0.0.0.0/0 | `iptables -A OUTPUT -j ACCEPT` |

**Ключевое отличие от iptables:**
- Security Groups – **stateful**: если разрешён входящий TCP 80, ответные пакеты автоматически разрешены
- iptables по умолчанию – **stateless**: нужно явно разрешать `ESTABLISHED,RELATED`

---

## Troubleshooting firewall – чеклист

```bash
# 1. Проверить, есть ли подключение БЕЗ firewall:
nc -zv target-host 8080
# timeout → firewall DROP или хост недоступен
# refused → порт не слушает (firewall не при чём)

# 2. Проверить iptables INPUT:
sudo iptables -L INPUT -n -v --line-numbers | grep 8080
# Если нет правила ACCEPT для порта → заблокировано

# 3. Проверить K8s NetworkPolicy:
kubectl get networkpolicy -n prod
kubectl describe networkpolicy api-allow-frontend -n prod

# 4. Временно отключить (ТОЛЬКО для диагностики!):
sudo iptables -P INPUT ACCEPT    # ← ОПАСНО в production!

# 5. Логирование заблокированных пакетов:
sudo iptables -A INPUT -j LOG --log-prefix "DROPPED: " --log-level 4
# Логи: dmesg | grep DROPPED
```

---

## Подвохи для собеса

### Подвох 1: "Чем iptables отличается от Security Groups?"

| | iptables | Security Groups |
|---|---|---|
| **Где** | Linux хост | Cloud VM (AWS, GCP, Azure) |
| **Statefulness** | Stateless (по умолчанию) | Stateful (автоматически) |
| **Управление** | CLI (`iptables -A`) | API / Console |
| **Persistence** | Не сохраняется при reboot | Всегда persistent |
| **Granularity** | Пакет, интерфейс, chain | Только inbound/outbound rules |
| **Performance** | Деградирует при >10K правил | Оптимизировано облаком |

**На собесе:** "iptables – host-level firewall в Linux ядре, stateless по умолчанию, требует явного разрешения ответных пакетов. Security Groups – облачный firewall, stateful, автоматически разрешает ответы. В K8s NetworkPolicy – ещё один уровень, работающий на pod-level через CNI (Calico/Cilium)."

---

### Подвох 2: "Почему после добавления NetworkPolicy pod перестал работать?"

**Ответ:**

NetworkPolicy – **whitelist**. Как только хотя бы одна NetworkPolicy применяется к pod-у, **весь не-описанный трафик блокируется**.

```yaml
# Добавили deny-all → pod не может:
# - резолвить DNS (нет egress на UDP 53)
# - ходить к другим сервисам (нет egress rules)
# - получать health check от kubelet (нет ingress от node)
```

**Частые ошибки:**
1. Забыли разрешить DNS (UDP 53)
2. Забыли разрешить health check от kubelet
3. Забыли разрешить egress к external services
4. Неправильный label selector (policy не применяется к нужным pod-ам)

**На собесе:** "NetworkPolicy – additive whitelist. Первая политика блокирует всё неявное. Типичная ошибка – забыть DNS egress: pod не может резолвить имена и все HTTP-вызовы падают с "Name or service not known", хотя это проблема сети, а не DNS."

---

## Код-челлендж

**Задача:** напиши Kubernetes NetworkPolicy, которая:

1. Применяется к pod-ам с label `app: database` в namespace `prod`
2. Разрешает ingress ТОЛЬКО от pod-ов с label `app: api` на порту TCP 5432
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
              name: monitoring
      ports:
        - protocol: TCP
          port: 9187
    # Всё остальное неявно заблокировано
    # (потому что policyTypes содержит Ingress)
```

</details>

---

## Дальше → Уровень 6

Ты умеешь настраивать firewall: iptables для хостов, NetworkPolicy для K8s. Понимаешь DROP vs REJECT, stateful vs stateless, whitelist-подход.

Но в production трафик идёт не напрямую к pod-у. Между клиентом и приложением – балансировщик нагрузки (L4 или L7), reverse proxy (nginx), Ingress controller. В service mesh – ещё и sidecar proxy (Envoy). Как всё это работает вместе?

**→ Уровень 6: Load Balancing и K8s networking**
