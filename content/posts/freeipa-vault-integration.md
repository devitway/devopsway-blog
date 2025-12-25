---
title: "🔐 Интеграция Hashicorp Vault с FreeIPA: Управление секретами в DevOps"
date: 2025-12-15T10:00:00+03:00
lastmod: 2025-12-15T10:00:00+03:00
draft: false
weight: 4
categories: ["Security", "DevOps Essentials", "Secrets Management"]
tags: ["vault", "hashicorp", "freeipa", "ldap", "secrets", "security", "devops", "kubernetes"]
author: "DevOps Way"
description: "Полное руководство по интеграции Hashicorp Vault с FreeIPA для централизованного управления секретами. LDAP аутентификация, динамические учетные данные, PKI интеграция."
canonical: ""
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
UseHugoToc: true
cover:
    image: ""
    alt: "Hashicorp Vault с FreeIPA интеграция"
    caption: "Централизованное управление секретами"
    relative: false
    hidden: false
editPost:
    URL: ""
    Text: "Предложить изменения"
    appendFilePath: true
---

🔒 Категория: DevOps Essentials / Security & Secrets Management  
💡 Цель: Построить защищенную систему управления секретами с интеграцией FreeIPA для аутентификации и авторизации

🧠 Чему вы научитесь:

- Установка и настройка Hashicorp Vault
- Интеграция Vault с FreeIPA через LDAP
- Настройка политик доступа на основе FreeIPA групп
- Динамические учетные данные для баз данных
- PKI интеграция с FreeIPA Certificate Authority
- Интеграция с Kubernetes и GitLab CI/CD
- Автоматическая ротация секретов
- Audit logging и мониторинг

⚠️ Критично перед стартом:

- Работающий FreeIPA сервер (см. первую статью)
- Сервер для Vault (минимум 2GB RAM, 20GB диск)
- Понимание PKI и сертификатов
- РЕД ОС 7.3 или CentOS Stream 9 / AlmaLinux 9

{{< alert "info" >}}
**Связанные статьи:**
1. [Настройка FreeIPA сервера](/posts/freeipa-setup/)
2. [FreeIPA + NFS + autofs](/posts/freeipa-nfs-autofs/)
3. Hashicorp Vault + FreeIPA (эта статья)
{{< /alert >}}

---

## 🏗️ Архитектура решения

### 📊 Общая схема интеграции

{{< mermaid >}}
graph TB
    subgraph "Пользователи"
        Dev[Разработчики]
        DevOps[DevOps инженеры]
        Apps[Приложения]
    end
    
    subgraph "Аутентификация"
        IPA[FreeIPA LDAP]
        Kerberos[Kerberos KDC]
    end
    
    subgraph "Vault"
        VaultAPI[Vault API]
        LDAP_Auth[LDAP Auth]
        KV[KV Secrets]
        DB[Database Secrets]
        PKI[PKI Engine]
        Transit[Transit Encryption]
    end
    
    subgraph "Инфраструктура"
        K8s[Kubernetes]
        GitLab[GitLab CI/CD]
        DB_Servers[Базы данных]
        Apps_Servers[App Servers]
    end
    
    Dev -->|Аутентификация| IPA
    DevOps -->|Аутентификация| IPA
    Apps -->|AppRole| VaultAPI
    
    IPA --> LDAP_Auth
    LDAP_Auth --> VaultAPI
    
    VaultAPI --> KV
    VaultAPI --> DB
    VaultAPI --> PKI
    VaultAPI --> Transit
    
    K8s -->|Vault Agent| VaultAPI
    GitLab -->|JWT Auth| VaultAPI
    DB_Servers <-->|Dynamic Creds| DB
    Apps_Servers <-->|Certificates| PKI
{{< /mermaid >}}

### 🔄 Процесс получения секрета

{{< mermaid >}}
sequenceDiagram
    participant User as Пользователь
    participant IPA as FreeIPA
    participant Vault as Vault Server
    participant Secret as Secret Backend
    
    User->>IPA: LDAP bind (username + password)
    IPA-->>User: LDAP auth success
    User->>Vault: Login with LDAP credentials
    Vault->>IPA: Verify user + get groups
    IPA-->>Vault: User verified, groups: [devops, developers]
    Vault-->>User: Vault token with policies
    User->>Vault: Read secret (with token)
    Vault->>Vault: Check policy
    Vault->>Secret: Retrieve secret
    Secret-->>Vault: Secret data
    Vault-->>User: Encrypted secret
{{< /mermaid >}}

---

## 🚀 1. Установка Hashicorp Vault

### 📦 Установка на AlmaLinux

```bash
# Добавление репозитория HashiCorp
sudo dnf install -y dnf-plugins-core
sudo dnf config-manager --add-repo https://rpm.releases.hashicorp.com/RHEL/hashicorp.repo

# Установка Vault
sudo dnf install -y vault

# Проверка версии
vault version
```

### 🔧 Базовая конфигурация Vault

```bash
# Создание директорий
sudo mkdir -p /etc/vault.d
sudo mkdir -p /opt/vault/data
sudo mkdir -p /opt/vault/logs

# Создание конфигурационного файла
sudo tee /etc/vault.d/vault.hcl << 'EOF'
# Vault configuration

ui = true

# Listener для API
listener "tcp" {
  address       = "0.0.0.0:8200"
  tls_cert_file = "/etc/vault.d/tls/vault.crt"
  tls_key_file  = "/etc/vault.d/tls/vault.key"
}

# Storage backend - Integrated Storage (Raft)
storage "raft" {
  path    = "/opt/vault/data"
  node_id = "vault-1"
}

# HA configuration
api_addr = "https://vault.devops.local:8200"
cluster_addr = "https://vault.devops.local:8201"

# Telemetry
telemetry {
  prometheus_retention_time = "30s"
  disable_hostname = true
}

# Logging
log_level = "info"
log_file = "/opt/vault/logs/vault.log"
EOF

# Права доступа
sudo chown -R vault:vault /opt/vault
sudo chown -R vault:vault /etc/vault.d
sudo chmod 640 /etc/vault.d/vault.hcl
```

### 🔐 Создание TLS сертификатов через FreeIPA

```bash
# На FreeIPA сервере: создание service principal
kinit admin
ipa service-add HTTP/vault.devops.local

# На Vault сервере: получение сертификата
sudo mkdir -p /etc/vault.d/tls

sudo ipa-getcert request \
    -k /etc/vault.d/tls/vault.key \
    -f /etc/vault.d/tls/vault.crt \
    -N CN=vault.devops.local \
    -K HTTP/vault.devops.local \
    -D vault.devops.local \
    -g 4096

# Проверка сертификата
sudo getcert list

# Копирование CA сертификата
sudo cp /etc/ipa/ca.crt /etc/vault.d/tls/ca.crt

# Права доступа
sudo chown vault:vault /etc/vault.d/tls/*
sudo chmod 600 /etc/vault.d/tls/vault.key
sudo chmod 644 /etc/vault.d/tls/vault.crt
```

### 🚀 Запуск Vault

```bash
# Создание systemd service
sudo tee /etc/systemd/system/vault.service << 'EOF'
[Unit]
Description="HashiCorp Vault - A tool for managing secrets"
Documentation=https://www.vaultproject.io/docs/
Requires=network-online.target
After=network-online.target
ConditionFileNotEmpty=/etc/vault.d/vault.hcl
StartLimitIntervalSec=60
StartLimitBurst=3

[Service]
User=vault
Group=vault
ProtectSystem=full
ProtectHome=read-only
PrivateTmp=yes
PrivateDevices=yes
SecureBits=keep-caps
AmbientCapabilities=CAP_IPC_LOCK
CapabilityBoundingSet=CAP_SYSLOG CAP_IPC_LOCK
NoNewPrivileges=yes
ExecStart=/usr/bin/vault server -config=/etc/vault.d/vault.hcl
ExecReload=/bin/kill --signal HUP $MAINPID
KillMode=process
KillSignal=SIGINT
Restart=on-failure
RestartSec=5
TimeoutStopSec=30
LimitNOFILE=65536
LimitMEMLOCK=infinity

[Install]
WantedBy=multi-user.target
EOF

# Включение и запуск
sudo systemctl daemon-reload
sudo systemctl enable vault
sudo systemctl start vault

# Проверка статуса
sudo systemctl status vault
```

### 🔓 Инициализация Vault

```bash
# Установка переменных окружения
export VAULT_ADDR='https://vault.devops.local:8200'
export VAULT_CACERT='/etc/ipa/ca.crt'

# Инициализация Vault (получаем unseal keys и root token)
vault operator init -key-shares=5 -key-threshold=3

# ВАЖНО: Сохраните ключи и root token в безопасном месте!
# Пример вывода:
# Unseal Key 1: ...
# Unseal Key 2: ...
# Unseal Key 3: ...
# Unseal Key 4: ...
# Unseal Key 5: ...
# Initial Root Token: ...

# Распечатывание Vault (нужно 3 ключа из 5)
vault operator unseal <key1>
vault operator unseal <key2>
vault operator unseal <key3>

# Проверка статуса
vault status

# Аутентификация root токеном
vault login <root_token>
```

### 🔥 Настройка firewall

```bash
# Открытие портов Vault
sudo firewall-cmd --permanent --add-port=8200/tcp  # API
sudo firewall-cmd --permanent --add-port=8201/tcp  # Cluster
sudo firewall-cmd --reload
```

---

## 🔗 2. Интеграция с FreeIPA через LDAP

### 📋 Подготовка FreeIPA

```bash
# На FreeIPA сервере
kinit admin

# Создание service account для Vault
ipa user-add vault-sa \
    --first="Vault" \
    --last="Service Account" \
    --password

# Создание групп для Vault политик
ipa group-add vault-admins --desc="Vault Administrators"
ipa group-add vault-developers --desc="Developers with Vault access"
ipa group-add vault-devops --desc="DevOps with Vault access"
ipa group-add vault-readonly --desc="Read-only Vault access"

# Добавление пользователей в группы
ipa group-add-member vault-admins --users=admin
ipa group-add-member vault-developers --users=jdoe,alice
ipa group-add-member vault-devops --users=bob,charlie
```

### 🔌 Настройка LDAP auth в Vault

```bash
# Включение LDAP auth метода
vault auth enable ldap

# Конфигурация LDAP
vault write auth/ldap/config \
    url="ldaps://ipa.devops.local" \
    userdn="cn=users,cn=accounts,dc=devops,dc=local" \
    groupdn="cn=groups,cn=accounts,dc=devops,dc=local" \
    binddn="uid=vault-sa,cn=users,cn=accounts,dc=devops,dc=local" \
    bindpass="VaultServiceAccountPassword" \
    userattr="uid" \
    groupattr="cn" \
    groupfilter="(&(objectClass=groupOfNames)(member={{.UserDN}}))" \
    certificate=@/etc/ipa/ca.crt \
    insecure_tls=false \
    starttls=false

# Проверка конфигурации
vault read auth/ldap/config

# Тестовый вход
vault login -method=ldap username=jdoe
```

---

## 📜 3. Создание политик доступа

### 🔐 Политики на основе FreeIPA групп

```bash
# Политика для администраторов
vault policy write vault-admins - <<EOF
# Полный доступ ко всему
path "*" {
  capabilities = ["create", "read", "update", "delete", "list", "sudo"]
}
EOF

# Политика для DevOps команды
vault policy write vault-devops - <<EOF
# Доступ к секретам приложений
path "secret/data/apps/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

# Доступ к инфраструктурным секретам
path "secret/data/infrastructure/*" {
  capabilities = ["create", "read", "update", "list"]
}

# Генерация динамических DB credentials
path "database/creds/*" {
  capabilities = ["read"]
}

# Доступ к PKI
path "pki/issue/*" {
  capabilities = ["create", "update"]
}
EOF

# Политика для разработчиков
vault policy write vault-developers - <<EOF
# Только чтение секретов приложений
path "secret/data/apps/*" {
  capabilities = ["read", "list"]
}

# Доступ к dev окружению
path "secret/data/dev/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

# Генерация токенов для CI/CD
path "auth/token/create" {
  capabilities = ["create", "update"]
}
EOF

# Read-only политика
vault policy write vault-readonly - <<EOF
path "secret/data/*" {
  capabilities = ["read", "list"]
}
EOF
```

### 🔗 Привязка политик к LDAP группам

```bash
# Привязка групп к политикам
vault write auth/ldap/groups/vault-admins policies=vault-admins
vault write auth/ldap/groups/vault-devops policies=vault-devops
vault write auth/ldap/groups/vault-developers policies=vault-developers
vault write auth/ldap/groups/vault-readonly policies=vault-readonly

# Проверка маппинга
vault list auth/ldap/groups
vault read auth/ldap/groups/vault-devops
```

---

## 🗄️ 4. Настройка Secrets Engines

### 📁 KV Secrets Engine (Key-Value)

```bash
# Включение KV v2 engine
vault secrets enable -path=secret kv-v2

# Создание секретов
vault kv put secret/apps/webapp \
    db_password="SuperSecretPass123" \
    api_key="abc123xyz789" \
    redis_password="RedisPass456"

# Чтение секретов
vault kv get secret/apps/webapp
vault kv get -field=db_password secret/apps/webapp

# Версионирование секретов
vault kv put secret/apps/webapp db_password="NewPassword456"
vault kv get -version=1 secret/apps/webapp
vault kv get -version=2 secret/apps/webapp

# Rollback к предыдущей версии
vault kv rollback -version=1 secret/apps/webapp

# Удаление (soft delete)
vault kv delete secret/apps/webapp

# Восстановление
vault kv undelete -versions=2 secret/apps/webapp

# Полное удаление всех версий
vault kv metadata delete secret/apps/webapp
```

### 🗃️ Database Secrets Engine (Динамические учетные данные)

```bash
# Включение database engine
vault secrets enable database

# Конфигурация PostgreSQL подключения
vault write database/config/postgresql-prod \
    plugin_name=postgresql-database-plugin \
    allowed_roles="readonly","readwrite" \
    connection_url="postgresql://{{username}}:{{password}}@postgres.devops.local:5432/production?sslmode=require" \
    username="vault-admin" \
    password="VaultAdminDBPass"

# Создание роли для read-only доступа
vault write database/roles/readonly \
    db_name=postgresql-prod \
    creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}'; \
        GRANT SELECT ON ALL TABLES IN SCHEMA public TO \"{{name}}\";" \
    default_ttl="1h" \
    max_ttl="24h"

# Создание роли для read-write доступа
vault write database/roles/readwrite \
    db_name=postgresql-prod \
    creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}'; \
        GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO \"{{name}}\";" \
    default_ttl="30m" \
    max_ttl="2h"

# Генерация динамических credentials
vault read database/creds/readonly
# Вывод:
# Key                Value
# lease_id          database/creds/readonly/abc123
# lease_duration    1h
# username          v-ldap-jdoe-readonly-xyz789
# password          A1b2C3d4E5f6...

# Использование в приложении
PGUSER=$(vault read -field=username database/creds/readonly)
PGPASS=$(vault read -field=password database/creds/readonly)
psql -h postgres.devops.local -U $PGUSER -d production
```

### 🔑 PKI Engine (Certificate Authority)

```bash
# Включение PKI engine
vault secrets enable pki

# Настройка максимального TTL
vault secrets tune -max-lease-ttl=87600h pki

# Генерация root CA (или импорт из FreeIPA)
vault write pki/root/generate/internal \
    common_name="Vault Internal CA" \
    ttl=87600h

# Конфигурация URLs
vault write pki/config/urls \
    issuing_certificates="https://vault.devops.local:8200/v1/pki/ca" \
    crl_distribution_points="https://vault.devops.local:8200/v1/pki/crl"

# Создание роли для выпуска сертификатов
vault write pki/roles/devops-local \
    allowed_domains="devops.local" \
    allow_subdomains=true \
    max_ttl="720h"

# Выпуск сертификата
vault write pki/issue/devops-local \
    common_name="app.devops.local" \
    ttl="168h"

# Сохранение сертификата
vault write -format=json pki/issue/devops-local \
    common_name="app.devops.local" | \
    jq -r '.data.certificate' > app.crt
vault write -format=json pki/issue/devops-local \
    common_name="app.devops.local" | \
    jq -r '.data.private_key' > app.key
```

---

## 🔄 5. Интеграция с Kubernetes

### 🐳 Установка Vault Agent Injector

```bash
# Добавление Helm репозитория
helm repo add hashicorp https://helm.releases.hashicorp.com
helm repo update

# Установка Vault в Kubernetes
helm install vault hashicorp/vault \
    --set "server.ha.enabled=false" \
    --set "injector.enabled=true" \
    --set "injector.externalVaultAddr=https://vault.devops.local:8200"

# Проверка установки
kubectl get pods -n default | grep vault
```

### 🔐 Настройка Kubernetes Auth

```bash
# На Vault сервере
vault auth enable kubernetes

# Конфигурация Kubernetes auth
vault write auth/kubernetes/config \
    kubernetes_host="https://k8s-api.devops.local:6443" \
    kubernetes_ca_cert=@/etc/kubernetes/ca.crt \
    token_reviewer_jwt="<k8s_service_account_token>"

# Создание роли для приложений
vault write auth/kubernetes/role/webapp \
    bound_service_account_names=webapp \
    bound_service_account_namespaces=production \
    policies=vault-developers \
    ttl=1h
```

### 📦 Пример Deployment с Vault Agent

```yaml
# webapp-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: webapp
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: webapp
  template:
    metadata:
      labels:
        app: webapp
      annotations:
        vault.hashicorp.com/agent-inject: "true"
        vault.hashicorp.com/agent-inject-secret-database: "database/creds/readonly"
        vault.hashicorp.com/agent-inject-template-database: |
          {{- with secret "database/creds/readonly" -}}
          export DB_USER="{{ .Data.username }}"
          export DB_PASS="{{ .Data.password }}"
          {{- end }}
        vault.hashicorp.com/role: "webapp"
    spec:
      serviceAccountName: webapp
      containers:
      - name: webapp
        image: webapp:latest
        command: ["/bin/sh"]
        args: ["-c", "source /vault/secrets/database && ./start-app.sh"]
```

---

## 🔄 6. Интеграция с GitLab CI/CD

### 🦊 Настройка JWT Auth для GitLab

```bash
# Включение JWT auth
vault auth enable jwt

# Конфигурация для GitLab
vault write auth/jwt/config \
    jwks_url="https://gitlab.devops.local/-/jwks" \
    bound_issuer="gitlab.devops.local"

# Создание роли для CI/CD
vault write auth/jwt/role/gitlab-ci \
    role_type="jwt" \
    bound_claims="project_id=123" \
    user_claim="user_email" \
    policies="vault-developers" \
    ttl="1h"
```

### 📝 Пример .gitlab-ci.yml

```yaml
# .gitlab-ci.yml
variables:
  VAULT_ADDR: "https://vault.devops.local:8200"
  VAULT_AUTH_ROLE: "gitlab-ci"
  VAULT_AUTH_PATH: "jwt"

stages:
  - build
  - deploy

get-secrets:
  stage: build
  image: vault:latest
  script:
    # Получение Vault token через JWT
    - export VAULT_TOKEN=$(vault write -field=token auth/jwt/login role=$VAULT_AUTH_ROLE jwt=$CI_JOB_JWT)
    
    # Получение секретов
    - export DB_PASSWORD=$(vault kv get -field=db_password secret/apps/webapp)
    - export API_KEY=$(vault kv get -field=api_key secret/apps/webapp)
    
    # Использование секретов в сборке
    - echo "Building with secrets..."
    - ./build.sh
  artifacts:
    paths:
      - build/

deploy:
  stage: deploy
  image: alpine:latest
  script:
    - echo "Deploying application..."
    # Vault Agent автоматически обновляет секреты
  dependencies:
    - get-secrets
```

---

## 🔄 7. Автоматическая ротация секретов

### 🔁 Скрипт ротации Database Credentials

```bash
#!/bin/bash
# rotate-db-credentials.sh

VAULT_ADDR="https://vault.devops.local:8200"
VAULT_TOKEN="<your_token>"

# Получение списка активных leases
vault list -format=json sys/leases/lookup/database/creds/readonly | \
  jq -r '.[]' | while read lease_id; do
    
    # Получение информации о lease
    lease_info=$(vault lease lookup $lease_id)
    
    # Проверка времени до истечения
    ttl=$(echo "$lease_info" | grep "ttl" | awk '{print $2}')
    
    if [ "$ttl" -lt 300 ]; then
        echo "Lease $lease_id expires in $ttl seconds, renewing..."
        vault lease renew $lease_id
    fi
done
```

### ⏰ Cron для автоматической ротации

```bash
# Добавление в crontab
crontab -e

# Каждые 15 минут проверять и обновлять credentials
*/15 * * * * /root/scripts/rotate-db-credentials.sh >> /var/log/vault-rotation.log 2>&1
```

---

## 📊 8. Мониторинг и Audit

### 📝 Включение Audit логирования

```bash
# Включение file audit
vault audit enable file file_path=/opt/vault/logs/audit.log

# Включение syslog audit
vault audit enable syslog tag="vault" facility="AUTH"

# Просмотр audit устройств
vault audit list -detailed
```

### 📈 Prometheus мониторинг

```bash
# vault-exporter.service (уже встроен в Vault)
# Метрики доступны на https://vault.devops.local:8200/v1/sys/metrics
```

**Prometheus config:**
```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'vault'
    metrics_path: '/v1/sys/metrics'
    params:
      format: ['prometheus']
    bearer_token: '<vault_token>'
    static_configs:
      - targets: ['vault.devops.local:8200']
```

### 📊 Grafana Dashboard

```json
{
  "dashboard": {
    "title": "Vault Monitoring",
    "panels": [
      {
        "title": "Active Tokens",
        "targets": [{
          "expr": "vault_token_count_by_auth"
        }]
      },
      {
        "title": "Secret Engine Requests",
        "targets": [{
          "expr": "rate(vault_secret_kv_count[5m])"
        }]
      },
      {
        "title": "Failed Authentication Attempts",
        "targets": [{
          "expr": "rate(vault_audit_log_request_failure[5m])"
        }]
      }
    ]
  }
}
```

---

## 🔍 9. Troubleshooting

### ❌ Проблема: LDAP аутентификация не работает

```bash
# Проверка LDAP подключения
vault read auth/ldap/config

# Тестирование LDAP bind
ldapsearch -x -H ldaps://ipa.devops.local \
    -D "uid=vault-sa,cn=users,cn=accounts,dc=devops,dc=local" \
    -w "password" \
    -b "cn=users,cn=accounts,dc=devops,dc=local" \
    "(uid=jdoe)"

# Проверка логов Vault
sudo journalctl -u vault -f

# Увеличение verbose логирования
vault write auth/ldap/config \
    ... \
    request_timeout=10s \
    connection_timeout=10s
```

### ❌ Проблема: Sealed Vault после перезагрузки

```bash
# Проверка статуса
vault status

# Unseal Vault
vault operator unseal <key1>
vault operator unseal <key2>
vault operator unseal <key3>

# Автоматический unseal с помощью автоматизации
# Создайте скрипт auto-unseal.sh:
#!/bin/bash
UNSEAL_KEYS=(
    "key1"
    "key2"
    "key3"
)

for key in "${UNSEAL_KEYS[@]}"; do
    vault operator unseal "$key"
done
```

### ❌ Проблема: Истекли динамические credentials

```bash
# Проверка lease
vault list sys/leases/lookup/database/creds/readonly

# Продление lease
vault lease renew database/creds/readonly/abc123

# Отзыв lease
vault lease revoke database/creds/readonly/abc123

# Генерация новых credentials
vault read database/creds/readonly
```

---

## 📋 10. Best Practices

### ✅ Безопасность

1. **Никогда не используйте root token** в production
2. **Ротируйте unseal keys** регулярно
3. **Используйте short-lived tokens** где возможно
4. **Включите audit logging** на всех окружениях
5. **Храните backup unseal keys** в разных безопасных местах

### ✅ Производительность

1. **Используйте Vault Agent** для кэширования
2. **Настройте batch tokens** для высоконагруженных приложений
3. **Мониторьте lease usage**
4. **Настройте rate limiting**

### ✅ Операционные практики

```bash
# Регулярный backup Vault data
vault operator raft snapshot save backup.snap

# Восстановление из backup
vault operator raft snapshot restore backup.snap

# Ротация encryption key
vault operator rotate

# Проверка здоровья
vault status
vault operator raft list-peers
```

---

## 🎯 Полезные команды

```bash
# Просмотр политик пользователя
vault token lookup

# Список всех секретов
vault list secret/

# Рекурсивное удаление
vault kv metadata delete -mount=secret apps

# Экспорт секретов (для миграции)
vault kv get -format=json secret/apps/webapp > webapp-secrets.json

# Импорт секретов
cat webapp-secrets.json | jq -r '.data.data' | \
  vault kv put secret/apps/webapp -

# Проверка политики
vault policy read vault-devops

# Создание периодического токена
vault token create -policy=vault-devops -period=24h

# Список активных токенов
vault list auth/token/accessors
```

---

## ✅ Чек-лист после настройки

- [ ] Vault установлен и инициализирован
- [ ] Unseal keys сохранены в безопасном месте
- [ ] TLS сертификаты от FreeIPA настроены
- [ ] LDAP аутентификация работает
- [ ] Политики созданы и привязаны к группам
- [ ] KV secrets engine настроен
- [ ] Database secrets engine работает
- [ ] PKI engine интегрирован
- [ ] Kubernetes аутентификация настроена
- [ ] GitLab CI/CD интеграция работает
- [ ] Audit logging включен
- [ ] Monitoring настроен
- [ ] Backup процедура документирована

---

## 📚 Дополнительные ресурсы

- [Vault Documentation](https://www.vaultproject.io/docs)
- [Vault Tutorials](https://learn.hashicorp.com/vault)
- [Vault GitHub](https://github.com/hashicorp/vault)

---

## 📞 КОНТАКТНАЯ ИНФОРМАЦИЯ

📱 **Telegram:** [@DevITWay](https://t.me/DevITWay)

🌐 **Сайт:** [devopsway.ru](https://devopsway.ru/)
