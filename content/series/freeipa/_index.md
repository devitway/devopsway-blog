---
title: "FreeIPA — серия гайдов по централизованной аутентификации"
description: "От установки FreeIPA до интеграции с Vault и NFS. Production-ready руководства для enterprise-инфраструктуры."
---

## О серии

Серия практических гайдов по FreeIPA — от установки до интеграции с Hashicorp Vault и NFS/Autofs. Каждый гайд проверен в production-среде.

## Карта серии

| Гайд | Тема | Что получите |
|------|------|-------------|
| [Установка FreeIPA](/posts/freeipa-setup/) | Сервер, DNS, CA, первые пользователи | Рабочий IdM с Kerberos и LDAP |
| [NFS + Autofs](/posts/freeipa-nfs-autofs/) | Централизованное хранилище | Автомонтирование домашних каталогов |
| [Vault + FreeIPA](/posts/freeipa-vault-integration/) | Управление секретами | LDAP-аутентификация для Vault, динамические credentials |

## Порядок прохождения

1. **Установка FreeIPA** — базовый сервер, без него остальное не работает
2. **NFS + Autofs** — опционально, если нужно централизованное хранилище
3. **Vault интеграция** — управление секретами поверх FreeIPA

## Технологии

- FreeIPA (LDAP, Kerberos, DNS, CA)
- Hashicorp Vault
- NFS v4 + Autofs
- AlmaLinux / RHEL
