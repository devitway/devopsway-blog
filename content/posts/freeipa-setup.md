---
title: "🔐 FreeIPA: руководство по установке централизованной системы управления идентификацией"
date: 2025-06-01T10:00:00+03:00
lastmod: 2025-12-15T10:00:00+03:00
draft: false
weight: 1
categories: ["Security", "DevOps основы", "System Administration"]
tags: ["freeipa", "ldap", "kerberos", "dns", "ca", "linux", "security", "authentication", "rhel", "almalinux", "identity-management"]
author: "DevOps Way"
series: "FreeIPA"
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

🔒 **Категория:** Системное администрирование  
💡 **Цель:** Развернуть production FreeIPA с учётом всех подводных камней

🧠 **Чему научитесь:**

- Правильная установка FreeIPA
- Настройка LDAP, Kerberos, DNS, CA
- Управление пользователями
- Мониторинг и решение проблем
- Резервное копирование

⚠️ **Требования:**

- RHEL/CentOS Stream/AlmaLinux/Rocky 8-9
- Минимум 4GB RAM
- Статический IP и FQDN
- Доступ root

**📚 Серия статей:**
1. **Установка FreeIPA** (эта статья)
2. [NFS + Autofs интеграция](/posts/freeipa-nfs-autofs/)
3. [Hashicorp Vault интеграция](/posts/freeipa-vault-integration/)

---

## 🏗️ Архитектура FreeIPA

{{< mermaid >}}
graph TB
  A[FreeIPA Сервер]
  A --> B[LDAP<br/>389 Directory]
  A --> C[Kerberos<br/>MIT KDC]
  A --> D[DNS<br/>BIND]
  A --> E[CA<br/>Dogtag]
{{< /mermaid >}}

**Компоненты:**

- **389 Directory Server** - LDAP пользователей/групп
- **MIT Kerberos** - SSO аутентификация
- **Dogtag CA** - центр сертификации
- **BIND DNS** - DNS с динамическими обновлениями
- **SSSD** - интеграция клиентов
- **Web UI** - веб-интерфейс

**Возможности:**

- 🔐 Централизованная аутентификация
- 🎫 Kerberos SSO
- 📜 Встроенный CA
- 🌐 Интегрированный DNS
- 👥 Управление пользователями
- 🔑 SSH ключи
- ⚡ Правила sudo

---

## 💻 Системные требования

**Поддерживаемые ОС:**

| ОС | Рекомендация |
|---|---|
| RHEL 8, 9 | ✅ Production |
| CentOS Stream 8, 9 | ✅ Production |
| AlmaLinux 8, 9 | ✅ Production |
| Rocky Linux 8, 9 | ✅ Production |
| Fedora 38+ | ⚠️ Только тесты |

**Ресурсы:**

| Параметр | Лаборатория | Production |
|---|---|---|
| RAM | 2 GB | 4-8 GB |
| CPU | 2 ядра | 4 ядра |
| Диск | 10 GB | 20+ GB |

⚠️ **О RAM:** 2GB только для тестов, 4GB минимум для production

---

## 🚀 1. Подготовка системы

### Настройка hostname

```bash
hostnamectl set-hostname ipa-master.example.com

# Проверка
hostnamectl status
getent hosts ipa-master.example.com
```

### Файл /etc/hosts

⚠️ Только для начальной установки!

```bash
grep -q ipa-master.example.com /etc/hosts || \
cat >> /etc/hosts << EOF
192.168.1.10   ipa-master.example.com ipa-master
EOF
```

### Синхронизация времени

**КРИТИЧНО для Kerberos!** Разница >5 минут = отказ

```bash
dnf install -y chrony

cat >> /etc/chrony.conf << 'EOF'

# NTP серверы
pool 2.pool.ntp.org iburst
server 0.pool.ntp.org iburst
makestep 1.0 3
EOF

systemctl enable chronyd --now

# Проверка (команда chronyc с буквой 'c'!)
chronyc sources
chronyc tracking
```

### Настройка Firewall

```bash
dnf install -y firewalld
systemctl enable firewalld --now

# Если есть готовые сервисы
firewall-cmd --permanent --add-service=freeipa-ldap
firewall-cmd --permanent --add-service=freeipa-ldaps
firewall-cmd --permanent --add-service=dns
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --permanent --add-service=kerberos
firewall-cmd --permanent --add-service=kpasswd

# Если нет - используйте порты
firewall-cmd --permanent --add-port=80/tcp
firewall-cmd --permanent --add-port=443/tcp
firewall-cmd --permanent --add-port=389/tcp
firewall-cmd --permanent --add-port=636/tcp
firewall-cmd --permanent --add-port=88/tcp
firewall-cmd --permanent --add-port=88/udp
firewall-cmd --permanent --add-port=464/tcp
firewall-cmd --permanent --add-port=464/udp
firewall-cmd --permanent --add-port=53/tcp
firewall-cmd --permanent --add-port=53/udp

firewall-cmd --reload
```

### SELinux

```bash
# Должно быть Enforcing
getenforce

# Если отключён
sed -i 's/^SELINUX=.*/SELINUX=enforcing/' /etc/selinux/config
reboot
```

---

## 📦 2. Установка FreeIPA

### Установка пакетов

```bash
dnf update -y
dnf install -y ipa-server ipa-server-dns ipa-admintools
```

### Интерактивная установка

```bash
ipa-server-install --setup-dns
```

### Автоматическая установка

⚠️ **Production:** Используйте пароли из файлов!

```bash
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

unset IPA_DS_PASSWORD IPA_ADMIN_PASSWORD
```

⚠️ **Флаг --no-ntp:** Только если время УЖЕ синхронизировано!

### Проверка установки

```bash
# Kerberos ticket
kinit admin
klist

# Статус сервисов
ipactl status

# Healthcheck (если доступен)
dnf install -y ipa-healthcheck
ipa-healthcheck --failures-only

# DNS
dig ipa-master.example.com @localhost
dig _ldap._tcp.example.com SRV @localhost
dig _kerberos._tcp.example.com SRV @localhost

# LDAP (через Kerberos, НЕ anonymous!)
ldapsearch -Y GSSAPI -b "dc=example,dc=com" -LLL "(objectClass=*)" dn | head -20

# Web UI
curl -s -o /dev/null -w "%{http_code}\n" https://ipa-master.example.com/ipa/ui
```

Браузер: `https://ipa-master.example.com/ipa/ui`

---

## 👥 3. Управление пользователями

### Создание пользователя

```bash
ipa user-add jdoe \
    --first="John" \
    --last="Doe" \
    --email="jdoe@example.com" \
    --password
```

### Просмотр

```bash
ipa user-show jdoe
ipa user-find
```

### Изменение

```bash
ipa user-mod jdoe --title="Senior DevOps"
ipa passwd jdoe
```

### Управление статусом

```bash
ipa user-disable jdoe
ipa user-enable jdoe
ipa user-del jdoe
```

⚠️ **Важно:** После удаления tickets живут до истечения (24ч по умолчанию)

### SSH ключи

```bash
ipa user-mod jdoe --sshpubkey="ssh-rsa AAAAB3..."
```

### Группы

```bash
ipa group-add developers --desc="Разработчики"
ipa group-add-member developers --users=jdoe,alice
ipa group-show developers
```

---

## 🖥️ 4. Подключение клиентов

```bash
# На клиенте
dnf install -y ipa-client

# Временная запись
echo "192.168.1.10 ipa-master.example.com" >> /etc/hosts

# Подключение
ipa-client-install --enable-dns-updates --mkhomedir
```

**Проверка:**

```bash
kinit admin
id jdoe
su - jdoe
```

---

## ⚙️ 5. Правила Sudo

### Создание команд

```bash
# Проверяем путь!
which systemctl

ipa sudocmd-add /usr/bin/systemctl
ipa sudocmd-add /usr/bin/journalctl
```

### Группы команд

```bash
ipa sudocmdgroup-add system-commands
ipa sudocmdgroup-add-member system-commands \
    --sudocmds=/usr/bin/systemctl,/usr/bin/journalctl
```

### Правила

```bash
ipa sudorule-add sysadmins_full \
    --desc="Полный доступ" \
    --hostcat=all

ipa sudorule-add-user sysadmins_full --groups=sysadmins
ipa sudorule-add-allow-command sysadmins_full \
    --sudocmdgroups=system-commands
```

⚠️ **Production:** Используйте hostgroups вместо `--hostcat=all`

### Тестирование

```bash
su - alice
sudo -l
sudo systemctl status httpd

# Если не применяется - очистить cache
sss_cache -E
```

---

## 🌐 6. Управление DNS

```bash
# A запись
ipa dnsrecord-add example.com web --a-rec=192.168.1.30

# CNAME
ipa dnsrecord-add example.com www --cname-rec=web.example.com.

# Reverse зона
ipa dnszone-add 1.168.192.in-addr.arpa

# PTR запись
ipa dnsrecord-add 1.168.192.in-addr.arpa 30 --ptr-rec=web.example.com.

# Удаление
ipa dnsrecord-del example.com web --a-rec=192.168.1.30
```

---

## 📊 7. Мониторинг

```bash
#!/bin/bash
# freeipa-monitor.sh

REALM=$(hostname -d | tr '[:lower:]' '[:upper:]')

echo "🔍 Проверка FreeIPA"

# Сервисы
ipactl status

# Healthcheck
ipa-healthcheck --failures-only 2>/dev/null

# Web UI
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://$(hostname -f)/ipa/ui)
echo "Web UI: $HTTP_STATUS"

# LDAP
kinit -k
ldapsearch -Y GSSAPI -b "dc=example,dc=com" -LLL dn &>/dev/null && echo "LDAP: OK"

# Сертификат
openssl x509 -in /var/lib/ipa/certs/httpd.crt -noout -enddate

# Время
chronyc tracking

# Directory Server
DS_INSTANCE="dirsrv@$(echo $REALM | tr '.' '-').service"
systemctl is-active "$DS_INSTANCE"
```

---

## 💾 8. Резервное копирование

```bash
#!/bin/bash
# freeipa-backup.sh

BACKUP_DIR="/backup/freeipa"
mkdir -p "$BACKUP_DIR"

# Резервное копирование
ipa-backup --data --online

# Архивация
LATEST=$(ls -t /var/lib/ipa/backup/ipa-data-* 2>/dev/null | head -1)
tar czf "${BACKUP_DIR}/backup-$(date +%Y%m%d).tar.gz" -C "$(dirname $LATEST)" "$(basename $LATEST)"

# Очистка старых (>30 дней)
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +30 -delete
```

⚠️ **Multi-master:** Backup делается на ОДНОЙ реплике

**Автоматизация:**

```bash
cat > /etc/cron.d/freeipa-backup << 'EOF'
PATH=/usr/sbin:/usr/bin:/sbin:/bin
0 2 * * * root /root/freeipa-backup.sh
EOF
```

**Восстановление:**

```bash
tar xzf backup-YYYYMMDD.tar.gz -C /var/lib/ipa/backup/
ipa-restore /var/lib/ipa/backup/ipa-data-YYYY-MM-DD-HH-MM-SS
```

---

## 🔧 Решение проблем

<details>
<summary><b>❌ Проблема 1: Истёк сертификат</b></summary>

**Проверка:**

```bash
ipa cert-find --all --pkey-only
getcert list
```

**Для HTTP/LDAP:**

```bash
ipa-certupdate
ipactl restart
```

**Для self-signed CA:**

```bash
ipa-cacert-manage renew --self-signed
ipactl restart
```

</details>

<details>
<summary><b>❌ Проблема 2: Kerberos не работает</b></summary>

**Проверка времени:**

```bash
chronyc tracking
chronyc sources
```

**Kerberos:**

```bash
klist
kinit admin
klist -k /etc/krb5.keytab
systemctl status krb5kdc
journalctl -u krb5kdc -n 50
```

</details>

<details>
<summary><b>❌ Проблема 3: LDAP не отвечает</b></summary>

```bash
REALM=$(hostname -d | tr '[:lower:]' '[:upper:]')
DS_INSTANCE="dirsrv@$(echo $REALM | tr '.' '-').service"

systemctl status "$DS_INSTANCE"
systemctl restart "$DS_INSTANCE"
tail -n 100 /var/log/dirsrv/slapd-*/errors

# Тест
kinit admin
ldapsearch -Y GSSAPI -b "dc=example,dc=com" -LLL
```

</details>

<details>
<summary><b>❌ Проблема 4: Web UI недоступен</b></summary>

```bash
systemctl status httpd
tail -n 50 /var/log/httpd/error_log
ipactl status
```

</details>

<details>
<summary><b>❌ Проблема 5: Клиент не подключается</b></summary>

**Правильный порядок диагностики:**

```bash
# 1. Проверка подключения
ipa ping

# 2. Kerberos
kinit admin

# 3. LDAP
id testuser
getent passwd testuser

# 4. SSSD
systemctl status sssd
sssctl domain-status example.com

# 5. DNS
dig _ldap._tcp.example.com SRV

# 6. Cache
sss_cache -E
systemctl restart sssd
```

**Переустановка (последний вариант!):**

```bash
ipa-client-install --uninstall
ipa-client-install --enable-dns-updates --mkhomedir
```

</details>

---

## 💡 Полезные команды

```bash
# Управление
ipactl restart/stop/start/status

# Конфигурация
ipa config-show

# Справка
ipa help commands
ipa help topics

# Пользователи
ipa user-add/show/mod/del username

# Группы
ipa group-add/show/del groupname
```

---

## 🎯 Заключение

Развёрнут production-ready FreeIPA:

- ✅ Все типичные ошибки исправлены
- ✅ Безопасная конфигурация
- ✅ Готовые скрипты мониторинга
- ✅ Резервное копирование

**Ключевые принципы:**

1. Синхронизация времени критична
2. DNS правильный
3. LDAP через Kerberos
4. Регулярный мониторинг
5. Автоматический backup

---

## 📚 Следующие статьи

- **Часть 2:** [NFS + Autofs интеграция](/posts/freeipa-nfs-autofs/)
- **Часть 3:** [Hashicorp Vault интеграция](/posts/freeipa-vault-integration/)

---

## 📞 КОНТАКТНАЯ ИНФОРМАЦИЯ

📱 **Telegram:** [@DevITWay](https://t.me/DevITWay)

🌐 **Сайт:** [devopsway.ru](https://devopsway.ru/)