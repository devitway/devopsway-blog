---
title: "📦 День Zero: Git + SSH – Подключение к GitHub как профи"
date: 2025-05-30T17:30:00+03:00
draft: false
categories: ["essentials"]
tags: ["git", "ssh", "github", "devops"]
description: "Настройка безопасного SSH-доступа к GitHub на любой ОС"
---

# 📦 День Zero: Git + SSH – Подключение к GitHub как профи

> 🔒 **Категория:** DevOps Essentials | 💡 **Цель:** Настроить безопасный SSH-доступ к GitHub на любой ОС

## 🧠 Чему вы научитесь

- [ ] Установка Git/SSH на Win/Linux/macOS
- [ ] Генерация SSH-ключей (Ed25519/RSA)
- [ ] Привязка ключа к GitHub
- [ ] Проверка и отладка подключения
- [ ] Работа с несколькими аккаунтами
- [ ] Backup и безопасность ключей

## ⚠️ Критично перед стартом

- Закройте все терминалы (нужен чистый сеанс)
- Проверьте отсутствие конфликтующих ключей
- Создайте резервную копию существующих ключей

## 🔧 Установка Git + SSH

### Linux
```bash
sudo apt update
sudo apt install git openssh-client
Windows
cmd# Скачайте Git for Windows с git-scm.com
# SSH включен автоматически
🔑 Генерация SSH-ключей
bash# Ed25519 (рекомендуется)
ssh-keygen -t ed25519 -C "your-email@example.com"

# RSA (совместимость)
ssh-keygen -t rsa -b 4096 -C "your-email@example.com"
✅ Проверка подключения
bashssh -T git@github.com

📱 Telegram: @devopsway_channel
🌐 Сайт: devopsway.ru
