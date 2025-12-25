---
title: "💾 FreeIPA + NFS + Autofs: Production-Grade централизованное хранилище"
date: 2025-12-15T10:00:00+03:00
lastmod: 2025-12-15T10:00:00+03:00
draft: false
weight: 2
categories: ["Storage", "DevOps Essentials", "System Administration"]
tags: ["freeipa", "nfs", "autofs", "linux", "storage", "automount", "ldap", "rhel", "almalinux", "security"]
author: "DevOps Way"
description: "Production-ready NFS + Autofs с FreeIPA: безопасная конфигурация, Kerberos, правильные mount options. Проверено в enterprise"
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
    alt: "FreeIPA NFS Autofs production"
    caption: "Enterprise централизованное хранилище"
    relative: false
    hidden: false
editPost:
    URL: ""
    Text: "Предложить изменения"
    appendFilePath: true
---

💾 **Категория:** DevOps Essentials / Storage Management  
💡 **Цель:** Production-ready NFS с автомонтированием, безопасной конфигурацией и Kerberos

🧠 **Чему вы научитесь:**

- Безопасная настройка NFS (без no_root_squash!)
- Правильные mount options (hard vs soft)
- Autofs с FreeIPA LDAP
- Kerberos security для NFS
- Production best practices
- Troubleshooting реальных проблем

⚠️ **Критично:**

- FreeIPA сервер настроен (часть 1)
- RHEL/CentOS Stream/AlmaLinux/Rocky 8-9
- Понимание NFS security
- Root доступ
- Статические IP

---

## 🚨 Production vs Lab

**⚠️ ВАЖНО:** Эта статья показывает **production-подход**, не lab-конфиг!

| Параметр | ❌ Lab/Demo | ✅ Production |
|---|---|---|
| **NFS exports** | `no_root_squash` | `root_squash` |
| **Home mounts** | `soft` | `hard,intr` |
| **DNS config** | `chattr +i` | NetworkManager |
| **Kerberos** | Опционально | **Обязательно** |
| **SELinux** | Permissive | **Enforcing** |

🔥 **Security note:** `no_root_squash` в production = прямое нарушение CIS/STIG/RH hardening!

---

## 🏗️ Архитектура

### 📊 Общая схема

{{< mermaid >}}
graph LR
  subgraph "FreeIPA Server"
    LDAP[LDAP Directory]
    Kerberos[Kerberos KDC]
    AutofsMap[Autofs Maps]
  end

  subgraph "NFS Server"
    NFS[NFS v4 Server<br/>+ Kerberos]
    ExportHome[/export/home<br/>root_squash]
    ExportShared[/export/shared<br/>root_squash]
  end

  subgraph "Clients"
    AutofsClient[Autofs + SSSD]
    HomeMount[/home<br/>hard,intr,krb5p]
    SharedMount[/shared<br/>soft,krb5i]
  end

  LDAP --> AutofsClient
  AutofsMap --> AutofsClient
  AutofsClient --> NFS
  NFS --> ExportHome
  NFS --> ExportShared
  ExportHome --> HomeMount
  ExportShared --> SharedMount
{{< /mermaid >}}

---

### 🔄 Автомонтирование с Kerberos

{{< mermaid >}}
sequenceDiagram
    participant User
    participant Client
    participant SSSD
    participant Autofs
    participant KDC
    participant NFS

    User->>Client: cd /home/username
    Client->>SSSD: Query autofs map
    SSSD->>FreeIPA: LDAP lookup
    FreeIPA-->>SSSD: Mount info
    SSSD-->>Autofs: Mount with krb5p
    Autofs->>KDC: Get service ticket
    KDC-->>Autofs: NFS ticket
    Autofs->>NFS: Mount (Kerberos auth)
    NFS-->>Client: /home mounted
    Client-->>User: Access granted
{{< /mermaid >}}

---

## 💻 Требования

| Компонент | Минимум | Рекомендуется |
|---|---|---|
| FreeIPA | Настроен | Часть 1 пройдена |
| NFS Server | RHEL 8-9 | AlmaLinux 9 |
| RAM | 1 GB | 2 GB |
| Диск | 20 GB | 100+ GB |

### Сеть:

- ✅ Статические IP
- ✅ DNS через FreeIPA
- ✅ Firewall NFS
- ✅ Kerberos функционирует

---

## 🚀 Часть 1: NFS Сервер

### 🏷️ Hostname и базовая настройка

```bash
# Hostname
hostnamectl set-hostname nfs-server.example.com

# Временная запись (для bootstrap)
grep -q "nfs-server.example.com" /etc/hosts || \
cat >> /etc/hosts << EOF
192.168.1.10   ipa-master.example.com ipa-master
192.168.1.20   nfs-server.example.com nfs-server
EOF
```

---

### 🌐 DNS настройка

**На FreeIPA сервере:**

```bash
kinit admin

# A запись
ipa dnsrecord-add example.com nfs-server --a-rec=192.168.1.20

# Проверка
dig nfs-server.example.com @ipa-master.example.com
```

**На NFS сервере (Production метод):**

⚠️ **НЕ используйте `chattr +i`!** Это ломает NetworkManager и systemd-resolved!

**Правильный подход через NetworkManager:**

```bash
# Определяем активное подключение
CONN_NAME=$(nmcli -t -f NAME,DEVICE con show --active | grep -v '^lo' | head -1 | cut -d: -f1)

echo "Active connection: $CONN_NAME"

# Настраиваем DNS через NetworkManager
nmcli con mod "$CONN_NAME" ipv4.dns "192.168.1.10 8.8.8.8"
nmcli con mod "$CONN_NAME" ipv4.dns-search "example.com"
nmcli con mod "$CONN_NAME" ipv4.ignore-auto-dns yes

# Применяем
nmcli con up "$CONN_NAME"

# Проверка
cat /etc/resolv.conf
# Должно быть: nameserver 192.168.1.10

# Тест резолвинга
nslookup ipa-master.example.com
nslookup nfs-server.example.com
```

**Альтернатива (старые системы с network-scripts):**

```bash
# Редактируем ifcfg файл
cat >> /etc/sysconfig/network-scripts/ifcfg-eth0 << EOF
PEERDNS=no
DNS1=192.168.1.10
DNS2=8.8.8.8
DOMAIN=example.com
EOF

systemctl restart NetworkManager
```

⚠️ **Почему не `chattr +i`:**
- Ломает NetworkManager
- Ломает nmcli
- Ломает systemd-resolved (RHEL 9)
- Вызывает проблемы при troubleshooting

---

### 📦 Установка NFS

```bash
# Пакеты
dnf install -y nfs-utils rpcbind

# Сервисы
systemctl enable --now rpcbind nfs-server

# Проверка
systemctl status nfs-server
```

⚠️ **О rpcbind:** Для pure NFSv4-only rpcbind формально не требуется, но Red Hat рекомендует оставлять включённым для совместимости и диагностики.

---

### 🔥 Firewall

```bash
dnf install -y firewalld
systemctl enable firewalld --now

# NFS сервисы
firewall-cmd --permanent --add-service=nfs
firewall-cmd --permanent --add-service=mountd
firewall-cmd --permanent --add-service=rpc-bind
firewall-cmd --reload

# Проверка
firewall-cmd --list-all
```

---

### 📁 Структура директорий

```bash
# Создание
mkdir -p /export/home
mkdir -p /export/shared/{docs,projects,scripts}

# Права
chmod 755 /export/home
chmod 755 /export/shared
chmod 755 /export/shared/{docs,projects,scripts}

# README
cat > /export/shared/README.txt << EOF
FreeIPA NFS Shared Storage
Server: $(hostname -f)
Created: $(date)
EOF

# Проверка
tree /export/
```

---

### 📝 NFS Exports (PRODUCTION!)

🚨 **КРИТИЧНО:** `no_root_squash` - это **SECURITY РИСК**!

```bash
# Production-safe exports
cat > /etc/exports << 'EOF'
# FreeIPA NFS Exports - PRODUCTION CONFIGURATION
# ⚠️ root_squash ОБЯЗАТЕЛЕН для безопасности!

# Home directories - HARD mounts, root_squash
/export/home    192.168.1.0/24(rw,sync,root_squash,no_subtree_check)

# Shared directories - root_squash
/export/shared  192.168.1.0/24(rw,sync,root_squash,no_subtree_check)
EOF

# Применение
exportfs -ra

# Проверка
exportfs -v
showmount -e localhost
```

**Ожидаемый вывод:**

```
/export/home   192.168.1.0/24(sync,wdelay,hide,no_subtree_check,sec=sys,rw,secure,root_squash,no_all_squash)
/export/shared 192.168.1.0/24(sync,wdelay,hide,no_subtree_check,sec=sys,rw,secure,root_squash,no_all_squash)
```

⚠️ **О sec=sys:** На этом этапе (bootstrap) используется `sec=sys`. Далее в разделе Kerberos мы переключимся на `sec=krb5p/krb5i`. В production Kerberos **обязателен**!

### 🔒 Таблица NFS mount options (Production)

| Use Case | Mount Options | Объяснение |
|---|---|---|
| **/home** | `rw,hard,intr,sec=krb5p` | Hard = no data loss, krb5p = encrypted |
| **/shared/docs** | `ro,soft,sec=krb5i` | Read-only, soft OK, integrity check |
| **/shared/projects** | `rw,hard,intr,sec=krb5i` | Hard = important data |
| **Backups (исключение!)** | `rw,no_root_squash` | Только для backup servers! |

**⚠️ О no_root_squash:**

Допустим ТОЛЬКО для:
- Dedicated backup серверов
- Очень узких service exports
- НИКОГДА по умолчанию для /home или /shared!

**Почему root_squash критичен:**
- Любой root на клиенте = root на NFS
- Нарушение least privilege
- CIS/STIG/RH hardening требует root_squash
- Компромисс одного клиента = компромисс всего NFS

---

### 🔐 Регистрация в FreeIPA

```bash
# Установка client
dnf install -y ipa-client

# Подключение
ipa-client-install \
    --server=ipa-master.example.com \
    --domain=example.com \
    --realm=EXAMPLE.COM \
    --principal=admin \
    --mkhomedir \
    --enable-dns-updates \
    --unattended

# Получение admin ticket
kinit admin

# Добавление host
ipa host-add nfs-server.example.com --ip-address=192.168.1.20

# Service principal для NFS
ipa service-add nfs/nfs-server.example.com

# Получение keytab
ipa-getkeytab -s ipa-master.example.com \
    -p nfs/nfs-server.example.com \
    -k /etc/krb5.keytab

# Проверка keytab
klist -k /etc/krb5.keytab
```

**Ожидаемый вывод `klist -k`:**

```
Keytab name: FILE:/etc/krb5.keytab
KVNO Principal
---- -------------------------------------------------------
   1 nfs/nfs-server.example.com@EXAMPLE.COM
   1 host/nfs-server.example.com@EXAMPLE.COM
```

---

### 👤 Создание домашних директорий

```bash
# Получаем информацию о пользователе через SSSD
getent passwd testuser
# Вывод: testuser:*:808600003:808600003:Test User:/home/testuser:/bin/bash

# Извлекаем UID и GID
USERINFO=$(getent passwd testuser)
USERNAME=$(echo "$USERINFO" | cut -d: -f1)
UID=$(echo "$USERINFO" | cut -d: -f3)
GID=$(echo "$USERINFO" | cut -d: -f4)

echo "Creating home for: $USERNAME (UID:$UID GID:$GID)"

# Создание структуры
mkdir -p "/export/home/$USERNAME"
chown "$UID:$GID" "/export/home/$USERNAME"
chmod 700 "/export/home/$USERNAME"

# Базовые директории
mkdir -p "/export/home/$USERNAME"/{Documents,Downloads,Projects}
chown -R "$UID:$GID" "/export/home/$USERNAME"

# Welcome файл
cat > "/export/home/$USERNAME/welcome.txt" << EOF
Welcome $USERNAME!
NFS Server: $(hostname -f)
Created: $(date)
EOF

chown "$UID:$GID" "/export/home/$USERNAME/welcome.txt"

# Проверка
ls -lan "/export/home/$USERNAME"
```

⚠️ **Почему getent, а не id:**
- `id` зависит от SSSD cache (race condition)
- `getent passwd` - canonical source
- Более надежно в скриптах

---

## 🗺️ Часть 2: Autofs в FreeIPA

### 📍 Создание Location

```bash
# На FreeIPA сервере
kinit admin

# Location (idempotent - создаст если нет, или покажет что существует)
ipa automountlocation-show default 2>/dev/null || ipa automountlocation-add default

# Проверка
ipa automountlocation-show default
```

---

### 🏠 Autofs Map для /home

```bash
# Создание map
ipa automountmap-add default auto.home

# Ключ в auto.master
ipa automountkey-add default auto.master \
    --key=/home \
    --info=auto.home

# Wildcard правило для домашних директорий
# ⚠️ ВАЖНО: используем HARD mounts!
ipa automountkey-add default auto.home \
    --key='*' \
    --info='-rw,hard,intr,sec=krb5p nfs-server.example.com:/export/home/&'

# Проверка
ipa automountkey-find default auto.home
```

**⚠️ О mount options для /home:**

| Опция | Почему критична |
|---|---|
| `hard` | Без data loss! Soft может вернуть EIO → битые .ssh, .bashrc |
| `intr` | Позволяет прервать зависшие операции (оставлен для совместимости и читаемости) |
| `sec=krb5p` | Kerberos + encryption (максимальная безопасность) |

**❌ НИКОГДА soft для /home:**
- `soft` → программы не ожидают EIO при записи в $HOME
- Результат: коррапт конфигов, сломанные IDE кеши, битые SSH ключи

---

### 📂 Autofs Map для /shared

```bash
# Map
ipa automountmap-add default auto.shared

# Ключ в auto.master
ipa automountkey-add default auto.master \
    --key=/shared \
    --info=auto.shared

# Директории с правильными options

# Read-only docs (soft OK)
ipa automountkey-add default auto.shared \
    --key=docs \
    --info='-ro,soft,sec=krb5i nfs-server.example.com:/export/shared/docs'

# Projects (hard - важные данные!)
ipa automountkey-add default auto.shared \
    --key=projects \
    --info='-rw,hard,intr,sec=krb5i nfs-server.example.com:/export/shared/projects'

# Scripts (hard)
ipa automountkey-add default auto.shared \
    --key=scripts \
    --info='-rw,hard,intr,sec=krb5i nfs-server.example.com:/export/shared/scripts'

# Проверка
ipa automountkey-find default auto.shared
```

**Kerberos security levels:**

| Level | Описание | Use Case |
|---|---|---|
| `krb5` | Аутентификация | Минимум |
| `krb5i` | + Integrity check | Рекомендуется |
| `krb5p` | + Encryption | /home, sensitive data |

---

## 💻 Часть 3: Клиенты

### 📋 Подготовка

```bash
# Предполагается что клиент УЖЕ в FreeIPA домене
kinit admin
ipa user-find

# Установка пакетов
dnf install -y autofs nfs-utils
```

---

### 🌐 DNS на клиенте (Production!)

⚠️ **НЕ `chattr +i`!** Используем NetworkManager!

```bash
# Находим активное подключение
CONN_NAME=$(nmcli -t -f NAME,DEVICE con show --active | grep -v '^lo' | head -1 | cut -d: -f1)

# Настройка DNS
nmcli con mod "$CONN_NAME" ipv4.dns "192.168.1.10 8.8.8.8"
nmcli con mod "$CONN_NAME" ipv4.dns-search "example.com"
nmcli con mod "$CONN_NAME" ipv4.ignore-auto-dns yes
nmcli con up "$CONN_NAME"

# Проверка
dig nfs-server.example.com
ping -c 2 nfs-server.example.com
```

---

### 🗺️ Настройка Autofs

```bash
# Автоматическая настройка через IPA
ipa-client-automount --location=default --unattended

# Проверка
cat /etc/nsswitch.conf | grep automount
# Должно быть: automount: sss files

# Проверка maps
automount -m
```

**Ожидаемый вывод `automount -m`:**

```
Mount point: /home
  * | -rw,hard,intr,sec=krb5p nfs-server.example.com:/export/home/&

Mount point: /shared
  docs | -ro,soft,sec=krb5i nfs-server.example.com:/export/shared/docs
  projects | -rw,hard,intr,sec=krb5i nfs-server.example.com:/export/shared/projects
```

---

### 🚀 Запуск

```bash
# Перезапуск SSSD (обновление maps)
systemctl restart sssd

# Autofs
systemctl enable autofs --now
systemctl status autofs

# Проверка логов
journalctl -u autofs -n 20
```

---

## 🔒 Часть 4: Kerberos для NFS

### 📝 NFS сервер (Kerberos)

```bash
# Уже получили keytab ранее (ipa-getkeytab)
# Проверяем
klist -k /etc/krb5.keytab | grep nfs

# Включаем Kerberos в NFS
cat >> /etc/nfs.conf << 'EOF'

[nfsd]
vers4=y
vers4.0=y
vers4.1=y
vers4.2=y
EOF

# Обновляем exports для Kerberos
cat > /etc/exports << 'EOF'
# Kerberos-secured exports

# Home - krb5p (encrypted)
/export/home    192.168.1.0/24(rw,sync,sec=krb5p,root_squash,no_subtree_check)

# Shared - krb5i (integrity)
/export/shared  192.168.1.0/24(rw,sync,sec=krb5i,root_squash,no_subtree_check)
EOF

# Применение
exportfs -ra
systemctl restart nfs-server

# Проверка
exportfs -v | grep sec
```

**Ожидаемый вывод:**

```
/export/home   192.168.1.0/24(...,sec=krb5p,root_squash,...)
/export/shared 192.168.1.0/24(...,sec=krb5i,root_squash,...)
```

---

### 🖥️ Клиент (Kerberos проверка)

⚠️ **КРИТИЧНО:** Проверить что Kerberos работает!

```bash
# Логин как пользователь
su - testuser

# Проверка Kerberos ticket
klist
# Должен быть TGT пользователя!

# Проверка NFS mount с Kerberos
cd /home/testuser  # Триггерит automount

# Проверяем mount options
mount | grep "/home/testuser"
# Должно содержать: sec=krb5p

# Детальная проверка
cat /proc/mounts | grep nfs4 | grep krb5

# Выход
exit
```

**Ожидаемый вывод mount:**

```
nfs-server.example.com:/export/home/testuser on /home/testuser type nfs4 (rw,relatime,vers=4.2,sec=krb5p,...)
```

---

## 🧪 Часть 5: Тестирование

### ✅ Тест 1: Автомонтирование /home

```bash
# Логин как testuser
su - testuser

# Проверка pwd
pwd
# /home/testuser

# Проверка mount
df -h /home/testuser
# nfs-server.example.com:/export/home/testuser

mount | grep testuser
# Проверяем hard,krb5p

# Создание файла
echo "Test from $(hostname) - $(date)" > test.txt

# Проверка
cat test.txt

# Выход
exit
```

**На NFS сервере:**

```bash
ls -la /export/home/testuser/
cat /export/home/testuser/test.txt
```

---

### ✅ Тест 2: Shared директории

```bash
# Docs (read-only)
ls /shared/docs
cat /shared/docs/README.txt

# Попытка записи (должна упасть)
touch /shared/docs/test.txt
# Ошибка: Read-only file system ✅

# Projects (read-write)
echo "Project notes - $(date)" > /shared/projects/notes.txt
cat /shared/projects/notes.txt
```

---

### ✅ Тест 3: Kerberos security

```bash
# Уничтожение ticket
kdestroy

# Попытка доступа без ticket
ls /home/testuser
# Должно упасть! Permission denied

# Получение нового ticket
kinit testuser

# Теперь работает
ls /home/testuser
```

---

### ✅ Тест 4: Hard vs Soft behavior

```bash
# Симуляция сбоя NFS (на сервере)
systemctl stop nfs-server

# На клиенте с HARD mount:
# Команды зависают (это правильно!)
ls /home/testuser  # Висит, ждёт NFS

# На клиенте с SOFT mount (/shared/docs):
ls /shared/docs  # Вернёт ошибку через timeout

# Восстановление
# На сервере:
systemctl start nfs-server

# На клиенте HARD mount продолжит работу!
```

---

## 🔧 Часть 6: Production конфигурация

### 🤖 Скрипт автосоздания home

**Production-safe версия:**

```bash
#!/bin/bash
# create-user-homes.sh - Production version

NFS_HOME_BASE="/export/home"
MIN_UID=1000  # System users filter

echo "🏠 Creating home directories..."

# Получение пользователей из FreeIPA
USERS=$(ipa user-find --all --raw | grep 'uid:' | awk '{print $2}')

for user in $USERS; do
    # Получение информации через getent (reliable!)
    USERINFO=$(getent passwd "$user" 2>/dev/null)
    
    if [ -z "$USERINFO" ]; then
        echo "⚠️  User $user not in SSSD, skipping"
        continue
    fi
    
    UID=$(echo "$USERINFO" | cut -d: -f3)
    GID=$(echo "$USERINFO" | cut -d: -f4)
    
    # Фильтр system users
    if [ "$UID" -lt "$MIN_UID" ]; then
        echo "⏭️  Skipping system user $user (UID:$UID)"
        continue
    fi
    
    USER_HOME="${NFS_HOME_BASE}/${user}"
    
    if [ ! -d "$USER_HOME" ]; then
        echo "📁 Creating: $user (UID:$UID GID:$GID)"
        
        mkdir -p "$USER_HOME"
        chown "$UID:$GID" "$USER_HOME"
        chmod 700 "$USER_HOME"
        
        # Базовые директории
        mkdir -p "$USER_HOME"/{Documents,Downloads,Projects,Scripts}
        
        # README
        cat > "$USER_HOME/README.txt" << EOF
Welcome $user!
Server: $(hostname -f)
Created: $(date)
EOF
        
        chown -R "$UID:$GID" "$USER_HOME"
        echo "✅ Created: $USER_HOME"
    else
        echo "✅ Exists: $USER_HOME"
    fi
done

echo ""
echo "📊 Total: $(ls -1 $NFS_HOME_BASE | wc -l) home directories"
```

---

### 💾 Квоты (Production)

**Правильная настройка quota:**

```bash
# В /etc/fstab (чтобы пережило reboot!)
cat >> /etc/fstab << 'EOF'
/dev/mapper/vg-export  /export  xfs  defaults,usrquota,grpquota  0 0
EOF

# Remount
mount -o remount /export

# Проверка
mount | grep export

# Инициализация quota
quotacheck -cug /export
quotaon /export

# Установка квоты (10GB soft, 11GB hard)
setquota -u testuser 10000000 11000000 0 0 /export

# Проверка
quota -vs testuser
repquota -a /export
```

⚠️ **Для XFS (RHEL 9):** 
- User quota на XFS технически работает, но **не рекомендуется** для shared NFS
- Используйте **project quota** вместо user/group quota
- Project quota обеспечивает лучшую производительность и гибкость

---

### 🛡️ SELinux (Production)

```bash
# На NFS сервере

# ❌ НЕ public_content_rw_t (это для Apache!)
# ✅ Используем nfs_t

# Home directories
semanage fcontext -a -t nfs_t "/export/home(/.*)?"
restorecon -R /export/home

# Shared
semanage fcontext -a -t nfs_t "/export/shared(/.*)?"
restorecon -R /export/shared

# Проверка
ls -Z /export/

# Boolean для NFS home
setsebool -P use_nfs_home_dirs on

# На клиентах
setsebool -P use_nfs_home_dirs on

# Проверка
getsebool use_nfs_home_dirs
```

---

## 📊 Часть 7: Мониторинг

```bash
#!/bin/bash
# nfs-monitor.sh

echo "════════════════════════════════════════"
echo "  📊 NFS Server Monitoring"
echo "════════════════════════════════════════"

# 1. NFS статистика
echo ""
echo "📈 NFS Statistics:"
nfsstat -s | head -20

# 2. Exports
echo ""
echo "📂 Active Exports:"
exportfs -v

# 3. Клиенты
echo ""
echo "👥 Connected Clients:"
showmount -a  # Legacy tool, используется для quick diagnostics

# 4. Kerberos keytab
echo ""
echo "🔐 Kerberos Keytab:"
klist -k /etc/krb5.keytab | grep nfs

# 5. Диск
echo ""
echo "💾 Disk Usage:"
df -h /export

# 6. Top files
echo ""
echo "📈 Top 10 largest files:"
find /export/home -type f -exec du -h {} + 2>/dev/null | sort -rh | head -10

# 7. Firewall
echo ""
echo "🔥 Firewall NFS:"
firewall-cmd --list-services | grep -E 'nfs|mount|rpc'

echo ""
echo "════════════════════════════════════════"
echo "✅ Check completed: $(date)"
```

---

## 🐛 Часть 8: Troubleshooting

### ❌ Проблема 1: Autofs не монтирует

```bash
# Проверка maps
automount -m

# SSSD статус
systemctl status sssd
sssctl domain-status example.com

# Очистка cache
sss_cache -E
systemctl restart sssd
systemctl restart autofs

# Debug mode
echo "logging = debug" >> /etc/autofs.conf
systemctl restart autofs
journalctl -u autofs -f
```

---

### ❌ Проблема 2: Permission denied

```bash
# Проверка Kerberos ticket
klist

# Если нет ticket
kinit testuser

# Проверка mount options
mount | grep nfs4 | grep krb5

# Проверка на NFS сервере
exportfs -v | grep sec
```

---

### ❌ Проблема 3: Stale file handle

```bash
# Клиент: принудительное размонтирование
umount -f /home/testuser
# Или
fuser -km /home/testuser

# Перезапуск autofs
systemctl restart autofs

# NFS сервер
exportfs -ra
systemctl restart nfs-server
```

---

## ✅ Production Checklist

Перед запуском в production проверьте:

- [ ] DNS резолвинг через FreeIPA (NetworkManager, не chattr!)
- [ ] UID/GID синхронизированы (getent passwd работает)
- [ ] **root_squash** в exports (НЕ no_root_squash!)
- [ ] **hard mounts** для /home (НЕ soft!)
- [ ] Kerberos работает (klist, mount | grep krb5)
- [ ] SELinux Enforcing + nfs_t contexts
- [ ] Firewall настроен
- [ ] Backup /export настроен
- [ ] Quota настроены (/etc/fstab)
- [ ] Мониторинг работает
- [ ] Тесты пройдены (все 4 теста)

---

## 🎯 Заключение

Вы настроили **production-grade** NFS + Autofs:

✅ **Безопасно:**
- `root_squash` вместо `no_root_squash`
- Kerberos encryption (`krb5p` для /home)
- SELinux Enforcing

✅ **Надёжно:**
- `hard` mounts для критичных данных
- Правильная DNS конфигурация
- Quota management

✅ **Enterprise-ready:**
- FreeIPA интеграция
- Autofs автоматизация
- Production checklist

### 🔑 Ключевые принципы:

1. **Security first:** `root_squash`, Kerberos, SELinux
2. **Data integrity:** `hard` для /home, `soft` только для read-only
3. **DNS правильно:** NetworkManager, не костыли
4. **Monitoring:** Регулярные проверки

---

## 🚀 Следующая статья

**Часть 3:** Hashicorp Vault + FreeIPA LDAP

---

## 🔗 Ссылки

- [FreeIPA Automount](https://www.freeipa.org/page/ConfiguringLinuxClients#Automount)
- [NFS Security](https://access.redhat.com/documentation/en-us/red_hat_enterprise_linux/9/html/managing_file_systems/exporting-nfs-shares_managing-file-systems)
- [Kerberos NFS](https://access.redhat.com/documentation/en-us/red_hat_enterprise_linux/9/html/managing_file_systems/securing-nfs_managing-file-systems)

---

**Автор:** DevOps Way  
**Дата:** 16 января 2025  
**Статус:** ✅ Production-ready, security-reviewed

**Теги:** #freeipa #nfs #autofs #kerberos #security #production #enterprise
