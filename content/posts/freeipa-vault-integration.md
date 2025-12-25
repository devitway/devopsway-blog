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

## 🏗️ Архитектура интеграции

```mermaid
graph TB
  A[Пользователь]
  B[Vault Server]
  C[FreeIPA LDAP]
  
  A -->|1. Логин| B
  B -->|2. Проверка| C
  C -->|3. OK| B
  B -->|4. Token| A
  A -->|5. Секреты| B
```

**Процесс аутентификации:**

1. Пользователь вводит LDAP учётные данные
2. Vault запрашивает FreeIPA LDAP
3. FreeIPA проверяет учётные данные
4. Vault выдаёт токен доступа
5. Пользователь работает с секретами

---

## 💻 Требования

| Компонент | Требования |
|---|---|
| FreeIPA | Настроен и работает |
| Vault Server | Linux, 2GB RAM |
| Клиенты | Vault CLI |
| Сеть | Доступ к FreeIPA:389 |

---

## 🚀 Часть 1: Установка Vault

### Установка на RHEL/CentOS

```bash
# Репозиторий HashiCorp
dnf config-manager --add-repo https://rpm.releases.hashicorp.com/RHEL/hashicorp.repo

# Установка
dnf install -y vault

# Проверка
vault --version
```

### Конфигурация Vault

```bash
mkdir -p /etc/vault.d
mkdir -p /opt/vault/data

cat > /etc/vault.d/vault.hcl << 'EOF'
# Vault конфигурация для интеграции с FreeIPA

storage "file" {
  path = "/opt/vault/data"
}

listener "tcp" {
  address     = "0.0.0.0:8200"
  tls_disable = 1
}

api_addr = "http://192.168.1.30:8200"
ui = true
EOF

chown -R vault:vault /opt/vault /etc/vault.d
chmod 640 /etc/vault.d/vault.hcl
```

⚠️ **Важно:** `tls_disable = 1` только для лаборатории! В production используйте TLS!

### Запуск Vault

```bash
# Systemd service
systemctl enable vault
systemctl start vault
systemctl status vault
```

### Firewall

```bash
firewall-cmd --permanent --add-port=8200/tcp
firewall-cmd --reload
```

### Инициализация

```bash
# Экспорт адреса
export VAULT_ADDR='http://127.0.0.1:8200'

# Инициализация
vault operator init -key-shares=5 -key-threshold=3

# СОХРАНИТЕ ВСЕ КЛЮЧИ И ROOT TOKEN!
```

**Вывод будет примерно такой:**

```
Unseal Key 1: xxx...
Unseal Key 2: yyy...
Unseal Key 3: zzz...
Unseal Key 4: aaa...
Unseal Key 5: bbb...

Initial Root Token: hvs.xxx...
```

⚠️ **КРИТИЧНО:** Сохраните ключи в безопасном месте!

### Распечатывание (Unseal)

```bash
# Используем 3 любых ключа из 5
vault operator unseal <key1>
vault operator unseal <key2>
vault operator unseal <key3>

# Проверка статуса
vault status
```

### Вход

```bash
vault login <root-token>
```

---

## 🔗 Часть 2: Интеграция с FreeIPA LDAP

### Создание учётной записи для Vault

**На FreeIPA сервере:**

```bash
kinit admin

# Создаём service account для Vault
ipa user-add vault-service \
    --first="Vault" \
    --last="Service" \
    --password

# Задаём постоянный пароль
ipa passwd vault-service
```

⚠️ **Важно:** Сохраните пароль в безопасном месте!

### Проверка LDAP подключения

**С Vault сервера:**

```bash
# Тест LDAP подключения
ldapsearch -x -H ldap://ipa-master.example.com \
    -D "uid=vault-service,cn=users,cn=accounts,dc=example,dc=com" \
    -W \
    -b "cn=users,cn=accounts,dc=example,dc=com" \
    "(uid=testuser)"
```

Должен вернуть информацию о пользователе ✅

### Включение LDAP аутентификации в Vault

```bash
# Включаем auth метод
vault auth enable ldap

# Настройка LDAP
vault write auth/ldap/config \
    url="ldap://ipa-master.example.com" \
    binddn="uid=vault-service,cn=users,cn=accounts,dc=example,dc=com" \
    bindpass="<пароль-vault-service>" \
    userdn="cn=users,cn=accounts,dc=example,dc=com" \
    userattr="uid" \
    groupdn="cn=groups,cn=accounts,dc=example,dc=com" \
    groupattr="cn" \
    groupfilter="(&(objectClass=posixGroup)(member={{.UserDN}}))"

# Проверка конфигурации
vault read auth/ldap/config
```

### Тест LDAP аутентификации

```bash
# Вход под FreeIPA пользователем
vault login -method=ldap username=testuser
# Введите пароль

# Проверка токена
vault token lookup
```

Успешный вход = интеграция работает! ✅

---

## 🔒 Часть 3: Политики доступа

### Создание политик

**Политика для разработчиков:**

```bash
cat > /tmp/dev-policy.hcl << 'EOF'
# Политика для разработчиков

# Чтение/запись в secret/dev/*
path "secret/data/dev/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

# Чтение secret/shared/*
path "secret/data/shared/*" {
  capabilities = ["read", "list"]
}

# Metadata
path "secret/metadata/*" {
  capabilities = ["list"]
}
EOF

vault policy write dev-policy /tmp/dev-policy.hcl
```

**Политика для администраторов:**

```bash
cat > /tmp/admin-policy.hcl << 'EOF'
# Политика для администраторов

# Полный доступ к secret/*
path "secret/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

# Управление политиками
path "sys/policies/acl/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

# Просмотр auth методов
path "sys/auth" {
  capabilities = ["read", "list"]
}
EOF

vault policy write admin-policy /tmp/admin-policy.hcl
```

### Привязка политик к группам LDAP

```bash
# Группа developers → dev-policy
vault write auth/ldap/groups/developers policies=dev-policy

# Группа sysadmins → admin-policy
vault write auth/ldap/groups/sysadmins policies=admin-policy

# Проверка
vault read auth/ldap/groups/developers
vault read auth/ldap/groups/sysadmins
```

### Проверка прав доступа

```bash
# Вход как разработчик
vault login -method=ldap username=alice
# alice в группе developers

# Проверка политик
vault token lookup | grep policies

# Тест доступа
vault kv put secret/dev/myapp password=secret123  # OK
vault kv get secret/dev/myapp                     # OK
vault kv put secret/prod/myapp password=test      # Denied!
```

---

## 🗄️ Часть 4: Управление секретами

### Включение KV секретов

```bash
# KV version 2
vault secrets enable -path=secret kv-v2

# Проверка
vault secrets list
```

### Создание секретов

```bash
# Простой секрет
vault kv put secret/dev/database \
    username=dbuser \
    password=SuperSecret123

# С метаданными
vault kv put secret/dev/api \
    api_key=abc123xyz \
    endpoint=https://api.example.com \
    created_by=admin

# Файл как секрет
vault kv put secret/dev/ssh-key value=@~/.ssh/id_rsa
```

### Чтение секретов

```bash
# Полный вывод
vault kv get secret/dev/database

# Только значения
vault kv get -field=password secret/dev/database

# JSON формат
vault kv get -format=json secret/dev/database
```

### Версии секретов

```bash
# Обновление (создаёт версию 2)
vault kv put secret/dev/database \
    username=dbuser \
    password=NewPassword456

# Просмотр версии 1
vault kv get -version=1 secret/dev/database

# Просмотр истории
vault kv metadata get secret/dev/database

# Откат к версии 1
vault kv rollback -version=1 secret/dev/database
```

### Удаление секретов

```bash
# Мягкое удаление (можно восстановить)
vault kv delete secret/dev/database

# Восстановление
vault kv undelete -versions=2 secret/dev/database

# Полное удаление
vault kv destroy -versions=1,2 secret/dev/database

# Удаление всех версий
vault kv metadata delete secret/dev/database
```

---

## 🔄 Часть 5: Динамические секреты

### Подключение к PostgreSQL (пример)

```bash
# Включаем database engine
vault secrets enable database

# Настройка подключения
vault write database/config/postgresql \
    plugin_name=postgresql-database-plugin \
    allowed_roles="dev-role" \
    connection_url="postgresql://{{username}}:{{password}}@postgres:5432/mydb" \
    username="vaultadmin" \
    password="vaultpass"

# Создание роли
vault write database/roles/dev-role \
    db_name=postgresql \
    creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}'; \
        GRANT SELECT ON ALL TABLES IN SCHEMA public TO \"{{name}}\";" \
    default_ttl="1h" \
    max_ttl="24h"
```

### Генерация динамических учётных данных

```bash
# Получение временных credentials
vault read database/creds/dev-role

# Вывод:
# Key                Value
# lease_id          database/creds/dev-role/xxx
# lease_duration    1h
# username          v-token-dev-role-yyy
# password          A1B2C3D4E5F6
```

Учётные данные действуют 1 час, затем автоматически удаляются!

---

## 📊 Часть 6: Мониторинг

### Проверка здоровья Vault

```bash
#!/bin/bash
# vault-health.sh

export VAULT_ADDR='http://127.0.0.1:8200'

echo "🔍 Проверка Vault"

# Статус
vault status

# Health endpoint
curl -s http://127.0.0.1:8200/v1/sys/health | jq

# Проверка LDAP
vault auth list | grep ldap

# Проверка секретов
vault secrets list

# Политики
vault policy list

echo "✅ Завершено"
```

### Аудит логи

```bash
# Включение файлового аудита
vault audit enable file file_path=/var/log/vault-audit.log

# Проверка
vault audit list

# Просмотр логов
tail -f /var/log/vault-audit.log | jq
```

---

## 🔧 Часть 7: Использование Vault CLI

### Настройка окружения

```bash
# В ~/.bashrc или ~/.zshrc
export VAULT_ADDR='http://vault-server:8200'
export VAULT_TOKEN='hvs.xxx...'  # Или используйте vault login

# Или создайте файл
cat > ~/.vault-env << 'EOF'
export VAULT_ADDR='http://192.168.1.30:8200'
EOF

source ~/.vault-env
```

### Часто используемые команды

```bash
# Статус
vault status

# Вход
vault login -method=ldap username=alice

# Чтение секрета
vault kv get secret/dev/myapp

# Запись секрета
vault kv put secret/dev/myapp key=value

# Список секретов
vault kv list secret/dev/

# Политики
vault policy list
vault policy read dev-policy

# Токены
vault token lookup
vault token renew
vault token revoke <token>
```

### Автоматизация с vault CLI

```bash
#!/bin/bash
# deploy-with-secrets.sh

# Вход
vault login -method=ldap username=deploy-user password=xxx

# Получение секретов
DB_PASS=$(vault kv get -field=password secret/prod/database)
API_KEY=$(vault kv get -field=api_key secret/prod/api)

# Использование в deployment
docker run -e DB_PASSWORD="$DB_PASS" -e API_KEY="$API_KEY" myapp
```

---

## 🔐 Часть 8: Best Practices

### Безопасность

1. **TLS обязателен в production:**

```bash
# В vault.hcl
listener "tcp" {
  address       = "0.0.0.0:8200"
  tls_cert_file = "/etc/vault.d/vault.crt"
  tls_key_file  = "/etc/vault.d/vault.key"
}
```

2. **Ротация root token:**

```bash
vault token revoke <old-root-token>
vault operator generate-root
```

3. **Минимальные привилегии:**
   - Используйте специфичные политики
   - Не давайте root доступ всем
   - Регулярно проверяйте права

4. **Аудит:**
   - Включите аудит логи
   - Мониторьте доступ
   - Настройте алерты

### Резервное копирование

```bash
#!/bin/bash
# vault-backup.sh

BACKUP_DIR="/backup/vault"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

# Остановка Vault
systemctl stop vault

# Backup данных
tar czf "${BACKUP_DIR}/vault-data-${DATE}.tar.gz" /opt/vault/data

# Backup конфигурации
tar czf "${BACKUP_DIR}/vault-config-${DATE}.tar.gz" /etc/vault.d

# Запуск
systemctl start vault

# Очистка старых (>30 дней)
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +30 -delete

echo "✅ Backup завершён: ${DATE}"
```

### High Availability

Для production рекомендуется:

- 3+ серверов Vault
- Consul или etcd backend
- Load balancer перед Vault
- Auto-unseal через облачные KMS

---

## 🔧 Решение проблем

<details>
<summary><b>❌ Проблема 1: Vault sealed</b></summary>

```bash
# Проверка
vault status
# Вывод: Sealed: true

# Unseal (нужны 3 ключа)
vault operator unseal <key1>
vault operator unseal <key2>
vault operator unseal <key3>

# Проверка
vault status
```

</details>

<details>
<summary><b>❌ Проблема 2: LDAP аутентификация не работает</b></summary>

```bash
# Проверка конфигурации
vault read auth/ldap/config

# Тест LDAP напрямую
ldapsearch -x -H ldap://ipa-master.example.com \
    -D "uid=vault-service,cn=users,cn=accounts,dc=example,dc=com" \
    -W -b "cn=users,cn=accounts,dc=example,dc=com"

# Проверка групп
vault read auth/ldap/groups/developers

# Логи
journalctl -u vault -n 100

# Debug mode
export VAULT_LOG_LEVEL=debug
vault login -method=ldap username=testuser
```

</details>

<details>
<summary><b>❌ Проблема 3: Permission denied при чтении секрета</b></summary>

```bash
# Проверка текущих политик
vault token lookup | grep policies

# Проверка политики
vault policy read dev-policy

# Проверка пути
vault kv list secret/

# Тест с root token
vault login <root-token>
vault kv get secret/dev/myapp
```

</details>

<details>
<summary><b>❌ Проблема 4: Token expired</b></summary>

```bash
# Проверка TTL
vault token lookup

# Renewal (если возможно)
vault token renew

# Повторный вход
vault login -method=ldap username=alice
```

</details>

---

## 📝 Полезные команды

```bash
# Статус и здоровье
vault status
vault operator members
curl http://vault:8200/v1/sys/health

# Auth методы
vault auth list
vault auth enable/disable <method>

# Secrets engines
vault secrets list
vault secrets enable/disable <engine>

# Политики
vault policy list
vault policy read <name>
vault policy write <name> <file>

# Токены
vault token lookup
vault token renew
vault token revoke

# KV операции
vault kv put/get/delete/list
vault kv metadata get
vault kv rollback
```

---

## 🎯 Заключение

Настроена полная интеграция Vault + FreeIPA:

**Результаты:**

- ✅ Централизованная аутентификация через FreeIPA LDAP
- ✅ Политики доступа на основе групп
- ✅ Безопасное хранение секретов
- ✅ Динамические учётные данные
- ✅ Аудит всех операций

**Ключевые принципы:**

1. LDAP интеграция упрощает управление доступом
2. Политики определяют права на основе групп FreeIPA
3. Секреты версионируются и могут быть восстановлены
4. Динамические credentials повышают безопасность
5. TLS обязателен в production

**Use cases:**

- Хранение паролей для приложений
- API ключи и токены
- Сертификаты и ключи
- Динамические database credentials
- Secrets для CI/CD
- Конфигурационные данные

---

## 📚 Дополнительное чтение

**Смотрите также:**
- [Установка FreeIPA](/posts/freeipa-setup/)
- [NFS + Autofs интеграция](/posts/freeipa-nfs-autofs/)

**Внешние ресурсы:**
- [Vault Documentation](https://www.vaultproject.io/docs)
- [LDAP Auth Method](https://www.vaultproject.io/docs/auth/ldap)
- [Vault Best Practices](https://www.vaultproject.io/docs/internals/security)

---

## 📞 КОНТАКТНАЯ ИНФОРМАЦИЯ

📱 **Telegram:** [@DevITWay](https://t.me/DevITWay)

🌐 **Сайт:** [devopsway.ru](https://devopsway.ru/)