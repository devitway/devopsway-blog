---
title: "🔐 FreeIPA: руководство по установке централизованной системы управления идентификацией"
date: 2025-06-01T10:00:00+03:00
lastmod: 2025-12-15T10:00:00+03:00
draft: false
weight: 1
categories: ["Security", "DevOps Essentials", "System Administration"]
tags: ["freeipa", "ldap", "kerberos", "dns", "ca", "linux", "security", "authentication", "rhel", "almalinux", "identity-management"]
author: "DevOps Way"
description: "Production-ready руководство по FreeIPA: установка, настройка, мониторинг."
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
    alt: "FreeIPA production installation"
    caption: "Enterprise централизованная аутентификация"
    relative: false
    hidden: false
editPost:
    URL: ""
    Text: "Предложить изменения"
    appendFilePath: true
---

🔒 **Категория:** DevOps Essentials / Identity Management  
💡 **Цель:** Развернуть production-ready FreeIPA сервер с учётом всех подводных камней

🧠 **Чему вы научитесь:**

- Установка FreeIPA без типичных ошибок
- Правильная конфигурация LDAP, CA, DNS, Kerberos
- Управление пользователями и группами
- Мониторинг и troubleshooting
- Backup и disaster recovery
- Security best practices

⚠️ **Критично перед стартом:**

- RHEL 8-9, CentOS Stream 8-9, AlmaLinux 8-9 или Rocky Linux 8-9
- **Минимум 4GB RAM** (2GB только для лаборатории!)
- Статический IP и правильный FQDN
- Root доступ (без sudo)
- Понимание DNS, LDAP, Kerberos основ

---

## 🏗️ Архитектура FreeIPA

### 🗂️ Компоненты системы

{{< mermaid >}}
graph TD
  Client["Linux Clients"]
  Server["FreeIPA Server"]
  DevOps["DevOps Tools<br/>(GitLab, Vault, Ansible)"]

  Client --> Server
  DevOps --> Server

  Server --> LDAP["389 Directory Server<br/>(LDAP)"]
  Server --> Kerberos["MIT Kerberos<br/>(KDC)"]
  Server --> DNS["BIND<br/>(DNS)"]
  Server --> CA["Dogtag<br/>(CA)"]
  Server --> WebAPI["Web UI / JSON-RPC API"]
{{< /mermaid >}}

---

### 🔐 Аутентификация

{{< mermaid >}}
flowchart LR
  Client[SSSD Client] -->|Kerberos| KDC[(KDC)]
  Client -->|LDAP via GSSAPI| LDAP[(389 DS)]
  Client -->|HTTPS| WebUI[(Web UI)]

  KDC -->|TGT| Client
  LDAP -->|User Data| Client
  CA -->|Certs| Client
{{< /mermaid >}}

---

### 🌐 Сетевые порты

{{< mermaid >}}
graph LR
  subgraph "FreeIPA Server"
    LDAP["LDAP: 389/TCP<br/>LDAPS: 636/TCP"]
    KRB["Kerberos: 88/TCP,UDP<br/>Kadmin: 464/TCP,UDP"]
    DNS["DNS: 53/TCP,UDP"]
    WEB["HTTP: 80/TCP<br/>HTTPS: 443/TCP"]
  end
{{< /mermaid >}}

⚠️ **Примечание:** Порт NTP (123/UDP) нужен ТОЛЬКО если FreeIPA раздаёт NTP. Для обычной синхронизации времени входящий 123 не требуется.

---

## 📋 Что такое FreeIPA?

FreeIPA — **enterprise open-source** решение для централизованного управления идентификацией в Linux/Unix.

### 🎯 Компоненты

- **389 Directory Server** - LDAP база пользователей/групп
- **MIT Kerberos** - SSO аутентификация
- **Dogtag CA** - встроенный центр сертификации
- **BIND DNS** - DNS с динамическими обновлениями
- **SSSD** - клиентская интеграция
- **Web UI** - графический интерфейс
- **JSON-RPC API** - частичный API (основной интерфейс - `ipa` CLI)

### ✨ Возможности

- 🔐 Централизованная аутентификация
- 🎫 Kerberos SSO
- 📜 Встроенный CA
- 🌐 Интегрированный DNS
- 👥 Управление пользователями
- 🔑 SSH ключи
- ⚡ Sudo правила
- 🔄 Multi-master репликация LDAP/Kerberos (CA с ограничениями)

⚠️ **Важно об API:** FreeIPA имеет JSON-RPC API, но он неполный. Часть операций доступна только через `ipa` CLI. Не ожидайте полноценного versioned REST API как у Vault.

---

## 💻 Требования к системе

### Поддерживаемые ОС:

| ОС | Статус | Рекомендация |
|---|---|---|
| RHEL 8, 9 | ✅ Поддерживается | Production |
| CentOS Stream 8, 9 | ✅ Поддерживается | Production |
| AlmaLinux 8, 9 | ✅ Поддерживается | Production |
| Rocky Linux 8, 9 | ✅ Поддерживается | Production |
| Fedora 38+ | ⚠️ Поддерживается | **Только тесты/лаборатория!** |
| CentOS Linux 7/8 | ❌ EOL/Мёртв | Не использовать |

⚠️ **Fedora WARNING:** Fedora технически поддерживается, но НЕ рекомендуется для production:
- Не LTS
- Частые поломки плагинов и Web UI
- Red Hat сам не рекомендует для прода

### Ресурсы сервера

| Параметр | Лаборатория | Production минимум | Комфорт |
|---|---|---|---|
| **RAM** | 2 GB | 4 GB | 8 GB |
| **CPU** | 2 cores | 4 cores | 8 cores |
| **Диск** | 10 GB | 20 GB | 50 GB+ |

⚠️ **Правда о RAM:**
- **2 GB** — PoC может взлететь, но при репликации/росте базы = OOM
- **4 GB** — минимально адекватно для production
- **8 GB** — комфортная работа

### ⚠️ Критичные требования:

- ✅ **FQDN hostname** (например, `ipa-master.example.com`)
- ✅ **Статический IP** адрес
- ✅ **Forward и reverse DNS** резолвинг
- ✅ **Синхронизация времени** (chrony)
- ✅ **Firewall** правила
- ✅ **SELinux Enforcing** (рекомендуется)

---

## 🚀 1. Подготовка системы

### 🏷️ Настройка hostname

```bash
# Установка FQDN hostname
hostnamectl set-hostname ipa-master.example.com

# Проверка
hostnamectl status
```

**Проверка корректности:**

```bash
# Это покажет статический hostname
hostnamectl status

# Проверка, что hostname резолвится
getent hosts ipa-master.example.com
```

---

### 📝 Настройка /etc/hosts

⚠️ **Важно:** `/etc/hosts` используется ТОЛЬКО для bootstrap установки. После настройки DNS FreeIPA, резолвинг должен идти через DNS!

```bash
# Проверяем, что запись ещё не добавлена
grep -q ipa-master.example.com /etc/hosts || \
cat >> /etc/hosts << EOF
192.168.1.10   ipa-master.example.com ipa-master
EOF

# Проверка
ping -c 2 ipa-master.example.com
```

⚠️ **Замечание:** Убедитесь, что IP совпадает с реальным! Неправильный /etc/hosts может маскировать проблемы DNS.

---

### ⏰ Синхронизация времени (КРИТИЧНО!)

**⚠️ КРИТИЧНО для Kerberos!** Разница во времени >5 минут = отказ аутентификации.

#### Установка chrony

```bash
# Установка
dnf install -y chrony

# Проверка, что уже есть базовый конфиг
cat /etc/chrony.conf
```

#### Настройка NTP серверов

⚠️ **Важно:** Мы НЕ перезаписываем конфиг полностью (чтобы не потерять distro defaults). Добавляем серверы:

```bash
# Бэкап оригинала
cp /etc/chrony.conf /etc/chrony.conf.backup

# Комментируем дефолтные pool (если есть)
sed -i 's/^pool /#pool /' /etc/chrony.conf
sed -i 's/^server /#server /' /etc/chrony.conf

# Добавляем наши NTP серверы
cat >> /etc/chrony.conf << 'EOF'

# Custom NTP servers for FreeIPA
pool 2.pool.ntp.org iburst
server 0.pool.ntp.org iburst
server 1.pool.ntp.org iburst

# Quick sync on startup
makestep 1.0 3
EOF
```

**Альтернатива (полный конфиг):**

Если хотите полностью контролировать конфиг:

```bash
# ВНИМАНИЕ: Полная перезапись конфига!
cat > /etc/chrony.conf << 'EOF'
# NTP серверы
pool 2.pool.ntp.org iburst
server 0.pool.ntp.org iburst
server 1.pool.ntp.org iburst

# Drift file
driftfile /var/lib/chrony/drift

# Quick sync
makestep 1.0 3

# RTC sync
rtcsync

# Logs
logdir /var/log/chrony
EOF
```

⚠️ **О minsources:** Параметр `minsources 2` НЕ рекомендуется для закрытых сетей! Если доступен только 1 NTP сервер, chrony не синхронизируется и Kerberos упадёт.

#### Запуск и проверка

```bash
# Запуск
systemctl enable chronyd --now

# Принудительная синхронизация (осторожно!)
chronyc makestep
```

⚠️ **WARNING о makestep:** Команда резко меняет время! На production это может сломать TLS, Kerberos, journald. Используйте только на init/lab!

**Проверка синхронизации:**

```bash
# Проверка источников времени
# ВАЖНО: команда - chronyc (с буквой 'c'), а не chrony!
chronyc sources

# Детальная информация
chronyc tracking

# Системное время
timedatectl status
```

**Ожидаемый вывод `chronyc sources`:**

```
MS Name/IP address         Stratum Poll Reach LastRx Last sample               
^* time.cloudflare.com           3   6   377    34   +123us[+456us] +/-  15ms
```

Символ `^*` = активный источник синхронизации ✅

---

### 🔥 Firewall настройка

```bash
# Установка и запуск
dnf install -y firewalld
systemctl enable firewalld --now
```

#### Проверка доступности сервисов

⚠️ **Важно:** Сервисы `freeipa-ldap` и `freeipa-ldaps` есть не во всех версиях firewalld!

```bash
# Проверяем, что сервисы существуют
firewall-cmd --get-services | grep freeipa
```

Если сервисы есть:

```bash
firewall-cmd --permanent --add-service=freeipa-ldap
firewall-cmd --permanent --add-service=freeipa-ldaps
firewall-cmd --permanent --add-service=dns
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --permanent --add-service=kerberos
firewall-cmd --permanent --add-service=kpasswd
firewall-cmd --reload
```

Если сервисов нет (минимальная установка):

```bash
firewall-cmd --permanent --add-port=80/tcp      # HTTP
firewall-cmd --permanent --add-port=443/tcp     # HTTPS
firewall-cmd --permanent --add-port=389/tcp     # LDAP
firewall-cmd --permanent --add-port=636/tcp     # LDAPS
firewall-cmd --permanent --add-port=88/tcp      # Kerberos
firewall-cmd --permanent --add-port=88/udp      # Kerberos
firewall-cmd --permanent --add-port=464/tcp     # Kadmin
firewall-cmd --permanent --add-port=464/udp     # Kadmin
firewall-cmd --permanent --add-port=53/tcp      # DNS
firewall-cmd --permanent --add-port=53/udp      # DNS
firewall-cmd --reload
```

⚠️ **О порте NTP (123/UDP):** Входящий 123/UDP нужен ТОЛЬКО если FreeIPA сам раздаёт NTP. Для обычного NTP-клиента (chrony) этот порт не требуется!

**Проверка:**

```bash
firewall-cmd --list-all
```

---

### 🔒 SELinux проверка

```bash
# Проверка режима
getenforce
```

**Должно быть:** `Enforcing` ✅

Если SELinux отключён:

```bash
# Универсальная команда для включения
sed -i 's/^SELINUX=.*/SELINUX=enforcing/' /etc/selinux/config

# Применится после перезагрузки
reboot
```

⚠️ **Рекомендация:** Оставьте SELinux в Enforcing! FreeIPA корректно работает с SELinux.

---

## 📦 2. Установка FreeIPA

### 📚 Установка пакетов

```bash
# Обновление системы
dnf update -y

# Установка FreeIPA
dnf install -y ipa-server ipa-server-dns ipa-admintools
```

⚠️ **О пакете ipa-client:** Не обязателен! `ipa-server-install` сам конфигурирует клиентскую часть. Мы его не устанавливаем отдельно.

**Дополнительные утилиты (опционально):**

```bash
dnf install -y openldap-clients krb5-workstation bind-utils
```

---

### 🎛️ Установка FreeIPA

#### Интерактивная установка:

```bash
ipa-server-install --setup-dns
```

Вопросы и ответы:

```
Do you want to configure integrated DNS (BIND)? [no]: yes

Server host name [ipa-master.example.com]: <Enter>
Please confirm the domain name [example.com]: <Enter>
Please provide a realm name [EXAMPLE.COM]: <Enter>

Directory Manager password: <введите сложный пароль>
Password (confirm): <повторите>

IPA admin password: <введите админ пароль>
Password (confirm): <повторите>

Do you want to configure DNS forwarders? [yes]: yes
Enter an IP address for a DNS forwarder: 8.8.8.8
Enter an IP address for a DNS forwarder: 1.1.1.1
Enter an IP address for a DNS forwarder: <Enter>

Do you want to search for missing reverse zones? [yes]: yes
Do you want to configure the reverse zone? [yes]: yes

Continue to configure the system with these values? [no]: yes
```

#### Автоматическая установка:

⚠️ **SECURITY WARNING:** НЕ используйте plaintext пароли в production!

**Для тестов/лабораторий:**

```bash
ipa-server-install \
    --hostname="ipa-master.example.com" \
    --domain="example.com" \
    --realm="EXAMPLE.COM" \
    --ds-password="TempDirPass123!" \
    --admin-password="TempAdminPass123!" \
    --setup-dns \
    --forwarder="8.8.8.8" \
    --forwarder="1.1.1.1" \
    --no-ntp \
    --unattended
```

⚠️ **Production подход:**

```bash
# Используйте переменные окружения или файлы
export IPA_DS_PASSWORD=$(cat /root/.ipa_ds_pass)
export IPA_ADMIN_PASSWORD=$(cat /root/.ipa_admin_pass)

ipa-server-install \
    --hostname="ipa-master.example.com" \
    --domain="example.com" \
    --realm="EXAMPLE.COM" \
    --ds-password="$IPA_DS_PASSWORD" \
    --admin-password="$IPA_ADMIN_PASSWORD" \
    --setup-dns \
    --forwarder="8.8.8.8" \
    --forwarder="1.1.1.1" \
    --no-ntp \
    --unattended

# Очистка после установки
unset IPA_DS_PASSWORD IPA_ADMIN_PASSWORD
```

⚠️ **О флаге --no-ntp:** Используйте ТОЛЬКО если время уже синхронизировано через chrony! Иначе установщик сам настроит NTP.

### Параметры:

| Параметр | Описание |
|---|---|
| `--hostname` | FQDN сервера |
| `--domain` | DNS домен |
| `--realm` | Kerberos realm (DOMAIN в верхнем регистре) |
| `--ds-password` | Directory Manager пароль (low-level LDAP) |
| `--admin-password` | FreeIPA admin пароль |
| `--setup-dns` | Настроить встроенный DNS |
| `--forwarder` | DNS forwarder для внешних запросов |
| `--no-ntp` | Не настраивать NTP (уже настроен chrony) |
| `--unattended` | Без интерактивных вопросов |

---

### ⏱️ Процесс установки

Установка займёт **10-20 минут**:

```
Configuring directory server (dirsrv)
Configuring Kerberos KDC (krb5kdc)
Configuring kadmin
Configuring certificate server (pki-tomcatd)
Configuring the web interface (httpd)
Configuring DNS (named)
Configuring client side components
```

**После успешной установки:**

```
==============================================================================
Setup complete

Next steps:
    1. Network ports (TCP): 80, 443, 389, 636, 88, 464, 53
                    (UDP): 88, 464, 53
    
    2. Obtain Kerberos ticket: kinit admin
    
    3. Use IPA tools or Web UI

⚠️  CA certificates backed up in /root/cacert.p12
    For production: use 'ipa-backup' instead of manual p12 copy!
==============================================================================
```

⚠️ **Замечание о CA backup:** В новых версиях FreeIPA используется custodia. Для production используйте `ipa-backup --data --online`, а не ручное копирование p12!

---

### ✅ Проверка установки

```bash
# Получение Kerberos ticket
kinit admin
# Пароль: <ваш admin пароль>

# Проверка ticket
klist

# Проверка всех сервисов
ipactl status
```

**Ожидаемый вывод `ipactl status`:**

```
Directory Service: RUNNING
krb5kdc Service: RUNNING
kadmin Service: RUNNING
named Service: RUNNING
httpd Service: RUNNING
ipa-custodia Service: RUNNING
pki-tomcatd Service: RUNNING
ipa-otpd Service: RUNNING
ipa-dnskeysyncd Service: RUNNING
ipa: FreeIPA server is running
```

**Healthcheck (если доступен):**

```bash
# Установка healthcheck
# Доступен в RHEL 8.6+, RHEL 9.x, FreeIPA 4.9+
# В некоторых версиях уже встроен в ipa-server
dnf install -y ipa-healthcheck

# Проверка только проблем
ipa-healthcheck --failures-only
```

**DNS проверки:**

```bash
# Forward DNS
dig ipa-master.example.com @localhost

# Reverse DNS
dig -x 192.168.1.10 @localhost

# SRV записи (КРИТИЧНО!)
dig _ldap._tcp.example.com SRV @localhost
dig _kerberos._tcp.example.com SRV @localhost
dig _kerberos._udp.example.com SRV @localhost
dig _kerberos-master._tcp.example.com SRV @localhost
dig _kpasswd._tcp.example.com SRV @localhost
```

**LDAP проверка:**

⚠️ **Важно:** НЕ используйте anonymous bind! Он может быть отключён.

```bash
# Правильная проверка LDAP через Kerberos
ldapsearch -Y GSSAPI -b "dc=example,dc=com" -LLL "(objectClass=*)" dn | head -20
```

**Web UI проверка:**

```bash
# Проверка доступности (без -k, CA уже установлен!)
curl -s -o /dev/null -w "%{http_code}\n" https://ipa-master.example.com/ipa/ui
# Ожидаемый код: 200
```

⚠️ **О флаге -k:** Используйте `-k` ТОЛЬКО если CA ещё не добавлен в trust store! FreeIPA уже выпустил валидный сертификат.

**Открытие в браузере:**

```
https://ipa-master.example.com/ipa/ui
```

Логин: `admin`  
Пароль: `<ваш админ пароль>`

---

## 👥 3. Управление пользователями

### 🆕 Создание пользователя

```bash
# Базовое создание
ipa user-add jdoe \
    --first="John" \
    --last="Doe" \
    --email="jdoe@example.com" \
    --password

# С дополнительными параметрами
ipa user-add alice \
    --first="Alice" \
    --last="Smith" \
    --email="alice@example.com" \
    --title="DevOps Engineer" \
    --phone="+1-555-0100" \
    --password
```

### 🔍 Просмотр пользователей

```bash
# Детальная информация
ipa user-show jdoe

# Список всех
ipa user-find

# Поиск по критериям
ipa user-find --email=alice@example.com
```

### ✏️ Модификация

```bash
# Изменение данных
ipa user-mod jdoe --title="Senior DevOps"

# Смена пароля
ipa passwd jdoe
```

### 🚫 Управление статусом

```bash
# Отключение (временно)
ipa user-disable jdoe

# Включение
ipa user-enable jdoe

# Удаление (PERMANENT!)
ipa user-del jdoe
```

⚠️ **Важно об удалении:** 
- После `ipa user-del` Kerberos tickets могут жить до истечения lifetime
- По умолчанию ticket lifetime = 24 часа (см. `ipa config-show`)
- SSSD cache на клиентах также требует очистки (`sss_cache -E`)

### 🔑 SSH ключи

```bash
# Добавление SSH ключа
ipa user-mod jdoe \
    --sshpubkey="ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDe..."

# Просмотр
ipa user-show jdoe --all | grep -A2 "SSH public key"
```

⚠️ **Важно:** Для работы SSH ключей клиенты должны использовать SSSD и `sss_ssh_authorizedkeys`!

---

## 👥 Управление группами

```bash
# Создание группы
ipa group-add developers --desc="Development Team"

# Добавление пользователей
ipa group-add-member developers --users=jdoe,alice,bob

# Просмотр
ipa group-show developers

# Удаление пользователя из группы
ipa group-remove-member developers --users=jdoe

# Удаление группы
ipa group-del developers
```

---

## 🖥️ 4. Подключение клиентов

### 📋 Установка клиента

```bash
# На клиентской машине
dnf install -y ipa-client

# Временная запись в hosts (для bootstrap)
grep -q ipa-master.example.com /etc/hosts || \
echo "192.168.1.10 ipa-master.example.com" >> /etc/hosts
```

### 🔗 Подключение к домену

**Интерактивно:**

```bash
ipa-client-install --enable-dns-updates --mkhomedir
```

**Автоматически (тест/лаборатория):**

```bash
ipa-client-install \
    --server=ipa-master.example.com \
    --domain=example.com \
    --realm=EXAMPLE.COM \
    --principal=admin \
    --mkhomedir \
    --enable-dns-updates \
    --unattended

# Пароль будет запрошен интерактивно
```

⚠️ **Production:** НЕ передавайте `--password` в командной строке! Пусть запросит интерактивно.

### ✅ Проверка клиента

```bash
# Kerberos test
kinit admin
klist

# LDAP lookup
id jdoe

# SSSD status
systemctl status sssd
sssctl domain-status example.com

# Проверка автологина
su - jdoe
```

---

## ⚙️ 5. Sudo правила

### 📝 Создание sudo команд

```bash
# Проверяем реальный путь к команде!
which systemctl
# Вывод: /usr/bin/systemctl

# Добавляем команду с правильным путём
ipa sudocmd-add /usr/bin/systemctl
ipa sudocmd-add /usr/bin/journalctl
ipa sudocmd-add /usr/bin/docker  # если docker есть
```

⚠️ **Важно:** Путь к команде должен точно совпадать! FreeIPA sudo матчит путь 1-в-1. Используйте `which <command>`.

### 📦 Группы команд

```bash
# Создание группы
ipa sudocmdgroup-add system-commands \
    --desc="System management"

# Добавление команд
ipa sudocmdgroup-add-member system-commands \
    --sudocmds=/usr/bin/systemctl,/usr/bin/journalctl
```

### 🛡️ Sudo правила

```bash
# Создание правила
ipa sudorule-add sysadmins_full \
    --desc="Sysadmins full sudo" \
    --hostcat=all

# Добавление группы пользователей
ipa sudorule-add-user sysadmins_full --groups=sysadmins

# Добавление команд
ipa sudorule-add-allow-command sysadmins_full \
    --sudocmdgroups=system-commands
```

⚠️ **Production WARNING о hostcat=all:**

```bash
# --hostcat=all даёт доступ на ВСЕХ хостах!
# В production используйте hostgroups:

ipa hostgroup-add production-servers
ipa hostgroup-add-member production-servers --hosts=web1,web2,db1

ipa sudorule-add-host sysadmins_full --hostgroups=production-servers
```

**NOPASSWD (⚠️ ОПАСНО!):**

```bash
# Разрешить sudo без пароля
ipa sudorule-add-option sysadmins_full --sudooption='!authenticate'
```

⚠️ **КРИТИЧНО:** `!authenticate` = полный root без пароля на всех хостах! Используйте ТОЛЬКО для:
- Break-glass сценариев
- Automation hosts
- НЕ для обычных админов!

### 🧪 Тестирование

```bash
# На клиенте
su - alice
sudo -l  # Список доступных команд
sudo systemctl status httpd
```

⚠️ **Важно:** Изменения sudo правил могут не применяться сразу из-за SSSD cache:

```bash
# Очистка cache на клиенте
sss_cache -E
sudo -l
```

---

## 🌐 6. DNS управление

### ➕ Добавление записей

```bash
# A запись
ipa dnsrecord-add example.com web --a-rec=192.168.1.30

# CNAME
ipa dnsrecord-add example.com www --cname-rec=web.example.com.

# MX запись
ipa dnsrecord-add example.com @ --mx-rec="10 mail.example.com."

# TXT запись
ipa dnsrecord-add example.com @ --txt-rec="v=spf1 mx -all"
```

### 🔄 PTR (reverse) записи

⚠️ **Важно:** Reverse зона должна существовать!

```bash
# Проверка существующих зон
ipa dnszone-find

# Создание reverse зоны (если нет)
ipa dnszone-add 1.168.192.in-addr.arpa

# Добавление PTR записи
ipa dnsrecord-add 1.168.192.in-addr.arpa 30 \
    --ptr-rec=web.example.com.
```

### 🗑️ Удаление записей

⚠️ **Важно:** Если есть несколько типов записей, уточните тип!

```bash
# Безопасное удаление с указанием типа
ipa dnsrecord-del example.com web --a-rec=192.168.1.30

# Удаление без типа (спросит подтверждение)
ipa dnsrecord-del example.com web
```

---

## 📊 7. Мониторинг

### 🔍 Скрипт мониторинга

```bash
#!/bin/bash
# freeipa-monitor.sh - Production-ready monitoring

REALM=$(hostname -d | tr '[:lower:]' '[:upper:]')
DOMAIN=$(hostname -d)

echo "🔍 FreeIPA Health Check - $(date)"
echo "======================================"

# 1. Services
echo ""
echo "⚙️  Services Status:"
ipactl status

# 2. Healthcheck (if available)
if command -v ipa-healthcheck &>/dev/null; then
    echo ""
    echo "🏥 Health Check:"
    ipa-healthcheck --failures-only 2>/dev/null || echo "No failures detected"
fi

# 3. Web UI
echo ""
echo "🌐 Web Interface:"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://$(hostname -f)/ipa/ui)
if [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ Web UI accessible (HTTP $HTTP_STATUS)"
else
    echo "❌ Web UI issue (HTTP $HTTP_STATUS)"
fi

# 4. LDAP via Kerberos (НЕ anonymous!)
echo ""
echo "📂 LDAP Status:"
if kinit -k 2>/dev/null; then
    if ldapsearch -Y GSSAPI -b "dc=$(echo $DOMAIN | sed 's/\./,dc=/g')" \
        -LLL "(objectClass=*)" dn &>/dev/null; then
        echo "✅ LDAP connection OK"
    else
        echo "❌ LDAP connection FAILED"
    fi
else
    echo "❌ Kerberos ticket FAILED"
fi

# 5. Certificate check
echo ""
echo "🔐 Certificate Status:"
CERT_PATH="/var/lib/ipa/certs/httpd.crt"

if [ -f "$CERT_PATH" ]; then
    CERT_EXPIRY=$(openssl x509 -in "$CERT_PATH" -noout -enddate | cut -d= -f2)
    CERT_EXPIRY_EPOCH=$(date -d "$CERT_EXPIRY" +%s 2>/dev/null || echo 0)
    NOW_EPOCH=$(date +%s)
    DAYS_LEFT=$(( ($CERT_EXPIRY_EPOCH - $NOW_EPOCH) / 86400 ))
    
    if [ $DAYS_LEFT -lt 30 ]; then
        echo "⚠️  Certificate expires in $DAYS_LEFT days"
    else
        echo "✅ Certificate valid for $DAYS_LEFT days"
    fi
else
    echo "❌ Certificate not found"
fi

# 6. Time sync
echo ""
echo "⏰ Time Synchronization:"
chronyc tracking  # ПРАВИЛЬНАЯ КОМАНДА
echo ""
echo "Sources:"
chronyc sources  # ПРАВИЛЬНАЯ КОМАНДА

# 7. Directory Server check
echo ""
echo "📊 Directory Server:"
# ПРАВИЛЬНАЯ формула service name!
# Realm = EXAMPLE.COM, Instance = EXAMPLE-COM (точки → дефисы)
DS_INSTANCE="dirsrv@$(echo $REALM | tr '.' '-').service"
if systemctl is-active --quiet "$DS_INSTANCE" 2>/dev/null; then
    echo "✅ $DS_INSTANCE running"
else
    echo "❌ $DS_INSTANCE not found or not running"
fi

# 8. Firewall
echo ""
echo "🔥 Firewall:"
if systemctl is-active --quiet firewalld; then
    firewall-cmd --list-services | tr ' ' '\n' | grep -E 'freeipa|ldap|kerberos|dns|http'
else
    echo "⚠️  Firewalld not running"
fi

# 9. Resources
echo ""
echo "💻 System Resources:"
echo "Memory: $(free -h | awk '/^Mem:/ {print $3"/"$2}')"
echo "Disk: $(df -h / | awk 'NR==2 {print $3"/"$2" ("$5")"}')"
echo "Load: $(uptime | awk -F'load average:' '{print $2}')"

echo ""
echo "======================================"
echo "✅ Check completed: $(date)"
```

**Запуск:**

```bash
chmod +x freeipa-monitor.sh
./freeipa-monitor.sh
```

---

## 💾 8. Backup & Recovery

### Backup скрипт

```bash
#!/bin/bash
# freeipa-backup.sh - Production backup

BACKUP_DIR="/backup/freeipa"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG="/var/log/freeipa-backup.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG"
}

mkdir -p "$BACKUP_DIR"

log "🔄 Starting FreeIPA backup"

# ipa-backup управляет сервисами сам!
# --data = только данные (быстрее)
# --online = без остановки сервисов (для small/medium)
ipa-backup --data --online

if [ $? -eq 0 ]; then
    log "✅ Backup completed"
else
    log "❌ Backup failed"
    exit 1
fi

# Поиск последнего backup
LATEST=$(ls -t /var/lib/ipa/backup/ipa-data-* 2>/dev/null | head -1)

if [ -z "$LATEST" ]; then
    log "❌ No backup found"
    exit 1
fi

# Архивирование
log "📦 Compressing: $(basename $LATEST)"
tar czf "${BACKUP_DIR}/$(basename $LATEST)_${TIMESTAMP}.tar.gz" \
    -C "$(dirname $LATEST)" "$(basename $LATEST)"

if [ $? -eq 0 ]; then
    BACKUP_SIZE=$(du -h "${BACKUP_DIR}/$(basename $LATEST)_${TIMESTAMP}.tar.gz" | cut -f1)
    log "✅ Compressed: $BACKUP_SIZE"
    
    # Symlink на latest
    ln -sf "${BACKUP_DIR}/$(basename $LATEST)_${TIMESTAMP}.tar.gz" \
        "${BACKUP_DIR}/latest-backup.tar.gz"
else
    log "❌ Compression failed"
    exit 1
fi

# Очистка старых (>30 дней)
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +30 -delete
log "🗑️  Cleaned old backups"

# Статистика
TOTAL=$(du -sh "$BACKUP_DIR" | cut -f1)
COUNT=$(ls -1 "$BACKUP_DIR"/*.tar.gz 2>/dev/null | wc -l)
log "📊 Total: $TOTAL ($COUNT backups)"

log "✅ Backup completed successfully"
```

⚠️ **Замечание о --online:**
- `--online` подходит для small/medium инсталляций
- Для крупных установок рекомендуется **offline backup** (safest!)
- `--online` может пропустить состояние CA в момент изменений

⚠️ **Multi-master окружения:** Backup делается на ОДНОЙ реплике. При восстановлении другие реплики автоматически синхронизируются.

**Автоматизация:**

```bash
# Cron с полным PATH
cat > /etc/cron.d/freeipa-backup << 'EOF'
# FreeIPA daily backup at 2 AM
PATH=/usr/sbin:/usr/bin:/sbin:/bin
0 2 * * * root /root/freeipa-backup.sh
EOF
```

⚠️ **О PATH в cron:** Обязательно указывайте PATH! Иначе `ipa-backup` может не найтись.

### Recovery

```bash
# Опционально (ipa-restore сам управляет сервисами)
ipactl stop

# Восстановление
cd /backup/freeipa
tar xzf latest-backup.tar.gz -C /var/lib/ipa/backup/

# Restore
ipa-restore /var/lib/ipa/backup/ipa-data-YYYY-MM-DD-HH-MM-SS

# Проверка
ipactl status
kinit admin
ipa user-find
```

⚠️ **КРИТИЧНО:** Восстановление возможно ТОЛЬКО на сервере с тем же:
- FQDN hostname
- Domain
- Realm

---

## 🐛 9. Troubleshooting

### ❌ Проблема 1: Сертификат истёк

⚠️ **Важно:** `ipa-cacert-manage renew --self-signed` работает ТОЛЬКО для self-signed CA!

**Проверка состояния:**

```bash
# Список всех сертификатов
ipa cert-find --all --pkey-only

# Certmonger tracking
getcert list

# Проверка CA
ipa ca-show
```

**Для HTTP/LDAP сертификатов:**

```bash
# Обновление сертификатов
ipa-certupdate
ipactl restart
```

**Для Dogtag CA:**

```bash
# Если нужна переустановка сертификата
ipa-server-certinstall -w -d /path/to/cert -k /path/to/key
```

**Для self-signed CA:**

```bash
# ТОЛЬКО если CA действительно self-signed!
ipa-cacert-manage renew --self-signed
ipactl restart
```

### ❌ Проблема 2: Kerberos не работает

**Проверка времени (КРИТИЧНО!):**

```bash
# Проверка синхронизации
chronyc tracking
chronyc sources

# Разница должна быть <5 минут!
```

⚠️ **О makestep:** НЕ используйте `chronyc makestep` на production! Это может сломать TLS, Kerberos, journald. Допустимо только на init/lab.

**Проверка Kerberos:**

```bash
# Текущие tickets
klist

# Тест получения ticket
kinit admin

# Проверка keytab
klist -k /etc/krb5.keytab

# Тест service ticket
kvno host/$(hostname -f)

# KDC статус
systemctl status krb5kdc

# Логи
journalctl -u krb5kdc -n 50
```

### ❌ Проблема 3: LDAP не отвечает

**Проверка Directory Server:**

```bash
# ПРАВИЛЬНАЯ формула для service name!
# Instance name = realm с точками замененными на дефисы
# EXAMPLE.COM → EXAMPLE-COM
REALM=$(hostname -d | tr '[:lower:]' '[:upper:]')
DS_INSTANCE="dirsrv@$(echo $REALM | tr '.' '-').service"

systemctl status "$DS_INSTANCE"

# Если не running
systemctl restart "$DS_INSTANCE"

# Логи (без -f для troubleshooting!)
tail -n 100 /var/log/dirsrv/slapd-*/errors

# Проверка портов
ss -tlnp | grep 389
```

**LDAP тест:**

```bash
# Правильный тест через Kerberos
kinit admin
ldapsearch -Y GSSAPI -b "dc=example,dc=com" -LLL "(objectClass=*)" dn | head -20
```

⚠️ **НЕ используйте anonymous bind** для проверки! Он может быть отключён и даст false negative.

### ❌ Проблема 4: Web UI недоступен

```bash
# Проверка httpd
systemctl status httpd

# Логи
tail -n 50 /var/log/httpd/error_log

# Тест (без -k!)
curl -I https://$(hostname -f)/ipa/ui
```

⚠️ **О флаге -k:** Используйте `-k` ТОЛЬКО если CA не добавлен в trust store! По умолчанию проверяйте без `-k`.

**Проверка IPA stack:**

```bash
# Иногда httpd жив, а IPA нет!
ipactl status
```

### ❌ Проблема 5: Клиент не подключается

⚠️ **КРИТИЧНО:** Переустановка клиента - это ПОСЛЕДНЕЕ СРЕДСТВО, не первый шаг!

**Правильный порядок troubleshooting:**

```bash
# 1. Проверка подключения
ipa ping

# 2. Kerberos
kinit admin
klist

# 3. LDAP lookup
id testuser
getent passwd testuser

# 4. SSSD
systemctl status sssd
sssctl domain-status example.com

# 5. DNS
dig _ldap._tcp.example.com SRV
dig ipa-master.example.com

# 6. Логи (без -f!)
tail -n 100 /var/log/sssd/sssd_example.com.log

# 7. Cache очистка
sss_cache -E
systemctl restart sssd
```

**Переустановка (ТОЛЬКО как последний вариант!):**

⚠️ **WARNING:** Это деструктивно! Сносит keytab, SSSD state, иногда записи хоста!

```bash
# Backup перед переустановкой
cp /etc/krb5.keytab /root/krb5.keytab.backup
cp -r /var/lib/sss /root/sss.backup

# Переустановка
ipa-client-install --uninstall
ipa-client-install --enable-dns-updates --mkhomedir
```

---

## 🌐 10. Web UI

URL: `https://ipa-master.example.com/ipa/ui`

Логин: `admin`  
Пароль: `<ваш админ пароль>`

### Основные возможности:

- 👥 **Identity** - пользователи, группы, хосты
- 🔑 **Policy** - sudo, HBAC, SELinux  
- 🌐 **Network Services** - DNS, сертификаты
- 🔒 **Authentication** - Kerberos, OTP
- 🔄 **Topology** - replicas
- 📊 **Audit** - логи операций
- 🛡️ **RBAC** - ролевой контроль доступа

---

## 💡 11. Полезные команды

### FreeIPA управление

```bash
ipactl restart  # Перезапуск
ipactl stop     # Остановка
ipactl start    # Запуск
ipactl status   # Статус

# Конфигурация
ipa config-show

# Справка
ipa help commands
ipa help topics   # Темы документации
```

### Пользователи

```bash
ipa user-add username --first=First --last=Last
ipa user-show username
ipa user-find --login=username
ipa user-mod username --title="Title"
ipa user-del username
```

### Группы

```bash
ipa group-add groupname --desc="Description"
ipa group-add-member groupname --users=user1,user2
ipa group-show groupname
ipa group-del groupname
```

---

---

## 🎯 Заключение

Вы получили **production-ready** FreeIPA сервер с учётом:

- ✅ Всех типичных ошибок
- ✅ Security best practices
- ✅ Реальных проблем production
- ✅ Enterprise рекомендаций

### Основные принципы

1. **Синхронизация времени** - критична для Kerberos
2. **DNS правильный** - основа всего
3. **LDAP через Kerberos** - не anonymous
4. **Monitoring** - регулярный healthcheck
5. **Backup** - автоматический через ipa-backup
6. **Troubleshooting** - системный подход, не reinstall

---

## 🚀 Следующие статьи

**Часть 2:** NFS + Autofs интеграция  
**Часть 3:** Hashicorp Vault с FreeIPA LDAP

---

## 🔗 Ссылки

- [FreeIPA Documentation](https://www.freeipa.org/page/Documentation)
- [Red Hat IdM Guide](https://access.redhat.com/documentation/en-us/red_hat_enterprise_linux/9/html/configuring_and_managing_identity_management/)
- [FreeIPA GitHub](https://github.com/freeipa/freeipa)

---

# 📞 КОНТАКТНАЯ ИНФОРМАЦИЯ

📱 **Telegram:** [@DevITWay](https://t.me/DevITWay)

🌐 **Сайт:** [devopsway.ru](https://devopsway.ru/)
