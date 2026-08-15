---
title: "Networking 20/80, уровень 6: Балансировка нагрузки и сети Kubernetes"
date: 2026-08-08T14:30:00+03:00
lastmod: 2026-08-08T14:30:00+03:00
draft: false
weight: 7
categories: ["DevOps основы"]
tags: ["networking", "loadbalancing", "kubernetes", "ingress", "nginx", "service-mesh", "linux", "devops", "собеседование"]
author: "DevOps Way"
series: "Networking 20/80"
seriesTotal: 7
description: "Финал мини-курса: L4 против L7 балансировки, четыре типа Service в Kubernetes, Ingress и обратный прокси (reverse proxy) на nginx, алгоритмы балансировки, обзор сервисной сетки (service mesh) и чеклист диагностики сети в K8s. Три подвоха с собеса и итог всего курса."
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
    alt: "Networking 20/80: L4/L7 балансировка, Service, Ingress в Kubernetes"
    caption: "Уровень 6 (финал) – как трафик снаружи попадает в pod и делится между репликами"
    relative: false
    hidden: false
editPost:
    URL: "https://github.com/devitway/devopsway-blog/tree/main/content"
    Text: "Предложить изменения"
    appendFilePath: true
---

Седьмой, финальный уровень мини-курса "Networking 20/80". Всё предыдущее сходится здесь: адреса, DNS, TCP, HTTP и межсетевые экраны складываются в то, как запрос снаружи попадает в pod и распределяется между репликами. L4 против L7, четыре типа Service, Ingress – и общая картина сети в Kubernetes целиком.


> "В Kubernetes нет понятия "сервер". Есть pod-ы, которые рождаются и умирают. Service – абстракция, которая превращает хаос в стабильную точку доступа (endpoint). Ingress – дверь снаружи."

---

## Откуда это пошло

**1997 – F5 Networks** выпускает аппаратный балансировщик BIG-IP (компания основана в 1996). Стоит $50,000+. Задача: распределить HTTP-запросы между несколькими серверами.

**2004 – nginx** (Игорь Сысоев). Создавался как HTTP-сервер для Rambler.ru (один из крупнейших российских порталов). Стал де-факто стандартом для обратного прокси (reverse proxy) и балансировки нагрузки. Бесплатный, быстрый, конфигурируемый.

**2001 – HAProxy** (Willy Tarreau). Специализированный L4/L7 балансировщик. GitHub, Reddit, Stack Overflow – все используют HAProxy.

**2014 – Kubernetes Services.** Абстракция поверх iptables/IPVS: стабильный ClusterIP, который распределяет трафик по pod-ам на L4. Свой nginx/haproxy ради этого держать больше не нужно – kube-proxy балансирует сам. (HTTP-маршрутизация снаружи – это уже L7/Ingress, о нём ниже.)

**2016 – Envoy** (Lyft). Прокси-контейнер (sidecar) для сервисной сетки (service mesh). Основа Istio, AWS App Mesh. Балансировка на L7 с размыканием цепи (circuit breaking), повторами (retries), наблюдаемостью (observability).

---

## Балансировка L4 против L7

```
L4 (Transport):
  Решение на основе: IP + порт
  Не знает: HTTP, URL, заголовки, cookies
  Скорость: очень быстрая (просто перенаправляет пакеты)
  Примеры: HAProxy (mode tcp), AWS NLB, K8s Service (ClusterIP)

L7 (Application):
  Решение на основе: URL path, Host header, cookies, HTTP method
  Знает: весь HTTP-запрос
  Скорость: медленнее (разбирает HTTP)
  Примеры: nginx, HAProxy (mode http), AWS ALB, K8s Ingress
```

### Когда что использовать

| Сценарий | Уровень | Почему |
|----------|---------|--------|
| TCP-балансировка (PostgreSQL, Redis) | L4 | Не HTTP, нет URL для маршрутизации |
| Маршрутизация по URL: `/api` → бэкенд, `/` → фронтенд | L7 | Нужен разбор HTTP |
| Терминация TLS (SSL termination) | L7 | Нужно расшифровать TLS |
| Липкие сессии (sticky sessions, по cookie) | L7 | Нужен разбор cookies |
| Максимальная производительность | L4 | Минимальные накладные расходы (overhead) |
| gRPC, WebSocket | L7 | gRPC – поверх HTTP/2, WebSocket – через Upgrade; нужен L7-прокси, понимающий эти протоколы |

---

## Сеть в Kubernetes – полная картина

```
Интернет
    │
    ▼
┌──────────────────────┐
│  Ingress Controller  │  L7: маршрутизация по Host/Path
│  (nginx-ingress)     │  терминация TLS
└──────────┬───────────┘
           │
    ┌──────▼──────┐
    │   Service    │  L4: ClusterIP, стабильный виртуальный IP
    │ (ClusterIP)  │  правила iptables/IPVS для распределения
    └──────┬──────┘
           │
    ┌──────┼──────┐
    │      │      │
  ┌─▼─┐ ┌─▼─┐ ┌─▼─┐
  │Pod│ │Pod│ │Pod│  Реальные контейнеры
  │ 1 │ │ 2 │ │ 3 │  Каждый с уникальным IP
  └───┘ └───┘ └───┘
```

---

## K8s Service – 4 типа

### 1. ClusterIP (по умолчанию)

```yaml
apiVersion: v1
kind: Service
metadata:
  name: api
spec:
  type: ClusterIP              # виртуальный IP внутри кластера
  selector:
    app: api
  ports:
    - port: 8080               # порт Service
      targetPort: 8080         # порт Pod
```

```bash
kubectl get svc api
# NAME  TYPE        CLUSTER-IP    PORT(S)
# api   ClusterIP   10.96.45.12   8080/TCP

# Доступен ТОЛЬКО внутри кластера:
# curl http://10.96.45.12:8080  (из pod-а)
# curl http://api:8080          (DNS резолвит в ClusterIP)
```

**Как работает:** kube-proxy создаёт правила iptables/IPVS, которые перенаправляют трафик с ClusterIP на реальные IP pod-ов. Выбор pod-а: в режиме iptables – случайный с равной вероятностью, в IPVS – round-robin по умолчанию.

### 2. NodePort

```yaml
spec:
  type: NodePort
  ports:
    - port: 8080
      targetPort: 8080
      nodePort: 30080          # 30000–32767
```

```
Снаружи: curl http://<любая-нода>:30080
  → DNAT → ClusterIP → Pod
```

### 3. LoadBalancer

```yaml
spec:
  type: LoadBalancer           # облачный LB (AWS ELB, GCP LB)
  ports:
    - port: 80
      targetPort: 8080
```

```
Снаружи: curl http://<cloud-lb-ip>:80
  → Cloud LB → NodePort → ClusterIP → Pod
```

### 4. ExternalName (DNS-алиас)

```yaml
spec:
  type: ExternalName
  externalName: rds.amazonaws.com    # CNAME → внешний сервис
```

---

## Ingress – маршрутизация на L7

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: app-ingress
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - api.example.com
      secretName: api-tls-cert        # TLS-сертификат в Secret
  rules:
    - host: api.example.com
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: api-service
                port:
                  number: 8080
          - path: /
            pathType: Prefix
            backend:
              service:
                name: frontend-service
                port:
                  number: 3000
```

### Как это работает

```
1. DNS: api.example.com → IP Ingress Controller
2. TLS: Ingress Controller терминирует TLS (расшифровывает)
3. HTTP: Host=api.example.com, Path=/api
4. Routing: Ingress Controller → Service api-service:8080 → Pod
```

> **⚠️ Статус на 2026:** сообщество вывело контроллер **ingress-nginx** в отставку
> (март 2026) – репозиторий заморожен, без релизов и security-патчей. Планировавшийся
> преемник InGate не взлетел. Направление развития – **Gateway API** (эволюция Ingress).
> При этом сам nginx как reverse proxy и Ingress API как таковой живы – на пенсию
> отправлен именно этот один Kubernetes-контроллер. Для новых кластеров – Gateway API
> или другой ingress-контроллер (Traefik, HAProxy, облачные). Концепции ниже (L4/L7,
> Service, терминация TLS, upstream) переносятся на любой из них.

---

## nginx как обратный прокси (reverse proxy) – конфигурация для DevOps

```nginx
# /etc/nginx/conf.d/api.conf

upstream api_backend {
    server 10.0.0.10:8080 weight=3;    # 3 из 4 запросов
    server 10.0.0.11:8080 weight=1;    # 1 из 4 запросов
    server 10.0.0.12:8080 backup;      # только если первые два упали

    # Health check (nginx plus) или passive:
    # server 10.0.0.10:8080 max_fails=3 fail_timeout=30s;
}

server {
    listen 443 ssl http2;
    server_name api.example.com;

    ssl_certificate     /etc/letsencrypt/live/api.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.example.com/privkey.pem;

    # Security headers:
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Content-Type-Options "nosniff" always;

    location /api/ {
        proxy_pass http://api_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts:
        proxy_connect_timeout 5s;
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }

    location / {
        proxy_pass http://frontend:3000;
    }

    # Health check endpoint:
    location /healthz {
        return 200 "OK";
        access_log off;
    }
}
```

---

## Алгоритмы балансировки

| Алгоритм | Как работает | Когда использовать |
|----------|-------------|-------------------|
| **Round Robin** | По очереди: 1, 2, 3, 1, 2, 3... | По умолчанию, одинаковые серверы |
| **Weighted RR** | С весами: 1 получает 70%, 2 – 30% | Серверы разной мощности |
| **Least Connections** | К серверу с наименьшим числом соединений | Запросы разной длительности |
| **IP Hash** | hash(client_ip) → сервер | Липкие сессии без cookie |
| **Random** | Случайный сервер | Простейший, неплохое распределение |
| **Consistent Hash** | hash(key) → кольцо серверов | Кеширование (минимум перебалансировки) |

```nginx
# Метод балансировки задаётся ОДНОЙ директивой на upstream
# (по умолчанию – Round Robin). Раскомментируй НУЖНЫЙ –
# методы нельзя смешивать в одном upstream:
upstream backend {
    # least_conn;          # к серверу с наименьшим числом активных соединений
    # ip_hash;             # закрепить клиента по его IP (sticky без cookie)
    # hash $request_uri consistent;   # consistent hashing (ketama) по ключу – удобно для кеширования

    server 10.0.0.1:8080;
    server 10.0.0.2:8080;
}
```

---

## Сервисная сетка (service mesh) – следующий уровень (обзор)

```
Без mesh:              С mesh (Istio/Linkerd):
Pod → Pod              Pod → Sidecar → Sidecar → Pod
                           (Envoy)    (Envoy)

Что даёт sidecar:
- mTLS между сервисами (автоматическое шифрование)
- Retries, timeouts, circuit breaking
- Traffic splitting (canary: 5% → новая версия)
- Observability (метрики, traces) без изменения кода
```

> **20/80 для джуна и выше:** знать, что сервисная сетка (service mesh) существует и зачем. Не нужно уметь настраивать Istio – это уже сеньорский уровень.

---

## Диагностика сети в Kubernetes – чеклист

```bash
# 1. Pod → Pod (в одном namespace):
kubectl exec pod-a -- curl http://pod-b-ip:8080
# Работает? → сеть между pod-ами ОК

# 2. Pod → Service:
kubectl exec pod-a -- curl http://service-name:8080
# Не работает? → проблема с DNS или Service selector

# 3. DNS внутри pod-а:
kubectl exec pod-a -- nslookup service-name
# NXDOMAIN? → Service не существует или неправильный namespace
# Timeout? → CoreDNS не отвечает

# 4. Service selector совпадает с pod labels?
kubectl get svc api -o yaml | grep -A3 selector
kubectl get pods -l app=api
# Если pod-ов нет → Endpoints пустые → Service не знает, куда слать

# 5. Endpoints:
kubectl get endpoints api
# Если пустые → selector не матчит ни один pod

# 6. Ingress → Service:
kubectl describe ingress app-ingress
# Проверить: backend service существует? Порт правильный?
# Events: "error obtaining endpoints" → Service/Endpoints проблема

# 7. Извне → Ingress:
curl -v https://api.example.com
# Проверить: DNS → IP Ingress Controller? TLS-сертификат валидный?
```

---

## Подвохи для собеса

### Подвох 1: "Чем Service (ClusterIP) отличается от Ingress?"

| | Service (ClusterIP) | Ingress |
|---|---|---|
| **Уровень** | L4 (TCP/UDP) | L7 (HTTP/HTTPS) |
| **Доступность** | Только внутри кластера | Снаружи кластера |
| **Маршрутизация** | По IP + порт | По заголовку Host и URL path |
| **TLS** | Нет (или через pod) | Да (терминация TLS) |
| **Протоколы** | Любой TCP/UDP | HTTP/HTTPS/gRPC |

**На собесе:** "ClusterIP – балансировка на L4 внутри кластера через iptables/IPVS. Ingress – маршрутизация HTTP-трафика на L7 снаружи через Ingress Controller (nginx, traefik). Ingress – это как виртуальный хост в nginx, а Service – как upstream."

---

### Подвох 2: "Как pod получает IP-адрес?"

**Ответ через CNI:**

1. Kubelet создаёт pod
2. Kubelet вызывает CNI-плагин (Calico, Cilium, Flannel)
3. CNI назначает IP из pod CIDR ноды (например, `10.244.1.0/24` для node-1)
4. CNI создаёт veth pair (виртуальный кабель): один конец в pod, другой – в хостовой сети
5. CNI настраивает маршрут: `10.244.1.15 → veth-pod-api`

```bash
# Pod CIDR ноды:
kubectl get node worker-1 -o jsonpath='{.spec.podCIDR}'
# 10.244.1.0/24

# Pod IP:
kubectl get pod api-xxx -o jsonpath='{.status.podIP}'
# 10.244.1.15

# На ноде – veth pair:
ip link show | grep veth
# vethc49c832@if3: <BROADCAST,MULTICAST,UP>
```

**На собесе:** "Pod IP назначается CNI-плагином. Каждая нода получает свой pod CIDR (подсеть). CNI создаёт veth pair – виртуальный кабель между сетевым namespace pod-а и хостовой сетью. Между нодами трафик маршрутизируется через overlay (VXLAN в Flannel) или через BGP (в Calico)."

---

### Подвох 3: "Почему kube-proxy – не proxy?"

**Ответ:**

Название вводит в заблуждение. kube-proxy НЕ проксирует трафик (в текущих версиях). Он **программирует правила** в iptables/IPVS:

```bash
# kube-proxy создаёт правила вроде:
# Если dst = 10.96.45.12:8080 (ClusterIP)
# → DNAT к одному из: 10.244.1.15:8080, 10.244.2.8:8080, 10.244.3.22:8080

# Пакет идёт НАПРЯМУЮ от pod к pod, через iptables DNAT
# kube-proxy не участвует в пути данных!
```

**На собесе:** "kube-proxy – это агент на каждой ноде (не control plane), который синхронизирует Endpoints с правилами iptables/IPVS. Трафик идёт через iptables DNAT, не через процесс kube-proxy. Поэтому kube-proxy можно убить, и существующие соединения продолжат работать – пока не изменятся Endpoints."

---

## Код-челлендж

**Финальный проект:** нарисуй (текстом) полный путь HTTP-запроса от пользователя до pod-а в K8s:

```
Пользователь вводит: https://api.example.com/users
```

Опиши каждый шаг: DNS, TCP, TLS, Ingress, Service, Pod. Укажи, на каком уровне OSI/TCP-IP происходит каждый шаг.

<details>
<summary>Решение</summary>

```
1. DNS (L7 Application):
   Браузер → DNS resolver → "api.example.com" = 34.56.78.90 (IP Ingress Controller)

2. TCP Handshake (L4 Transport):
   Браузер → SYN → 34.56.78.90:443 → SYN-ACK → ACK
   Соединение установлено

3. TLS Handshake (L5-6):
   ClientHello → ServerHello + Certificate → Key Exchange → Finished
   Зашифрованный канал

4. HTTP Request (L7):
   GET /users HTTP/1.1
   Host: api.example.com

5. Ingress Controller (nginx-ingress pod):
   - Терминирует TLS (расшифровывает)
   - Смотрит Host: api.example.com, Path: /users
   - Находит правило: /users → Service "api-service:8080"
   - Резолвит Service → Endpoints (реальные pod IP)

6. Service / iptables (L4):
   - Ingress Controller отправляет запрос на ClusterIP 10.96.45.12:8080
   - iptables DNAT: 10.96.45.12 → 10.244.1.15 (pod IP, случайный выбор)

7. Pod Network (L3):
   - CNI маршрутизирует пакет к ноде, где живёт pod
   - veth pair доставляет в сетевой namespace pod-а

8. Application (L7):
   - Pod (container) получает: GET /users HTTP/1.1
   - Обрабатывает → 200 OK + JSON

9. Обратный путь:
   Pod → veth → CNI → iptables (reverse DNAT) → Ingress → TLS encrypt → TCP → клиент
```

</details>

---

## Итог курса: что ты теперь знаешь

| Ур. | Навык | Инструмент | Для собеса |
|-------|-------|-----------|-----------|
| 0 | TCP/IP модель, инкапсуляция | `ip`, `ping`, `traceroute` | "Что происходит при curl" |
| 1 | IP-адреса, CIDR, подсети | `ip addr`, подсчёт | "Сколько хостов в /24" |
| 2 | DNS: иерархия, записи, диагностика | `dig`, `nslookup` | "Почему не резолвится" |
| 3 | TCP/UDP, порты, состояния | `ss`, `tcpdump`, `nc` | "Connection refused vs timeout" |
| 4 | HTTP, TLS, сертификаты | `curl -v`, `openssl` | "Что такое 502" |
| 5 | Firewall: iptables, NetworkPolicy | `iptables`, YAML | "Настрой NetworkPolicy" |
| 6 | LB, Ingress, сети K8s | `kubectl`, nginx | "Путь запроса от user до pod" |

### Что дальше

- **Практика:** настрой полный путь на своём кластере: Ingress → Service → Pod с NetworkPolicy
- **Актуальное (2026):** маршрутизация в K8s смещается с Ingress на **Gateway API** – после отставки ingress-nginx это направление по умолчанию для новых кластеров
- **Глубже:** Julia Evans Zines (wizardzines.com) – DNS, HTTP, сети в картинках
- **Практикум:** [Kubernetes the Hard Way](https://github.com/kelseyhightower/kubernetes-the-hard-way) – настроить K8s вручную, понять каждый сетевой компонент
- **Сертификация:** CKA (Certified Kubernetes Administrator) – 30% вопросов про сети
