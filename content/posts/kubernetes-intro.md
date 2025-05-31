---
title: "☸️ Kubernetes введение"
date: 2025-05-30T18:30:00+03:00
draft: false
categories: ["essentials"]
tags: ["kubernetes", "k8s", "devops", "containers"]
description: "Первые шаги в мире Kubernetes"
---

# ☸️ Kubernetes введение

> 🔒 **Категория:** Essentials | 💡 **Уровень:** Начинающий | ⏱️ **Время:** 60 мин

## 🎯 Что изучим

- [ ] Что такое Kubernetes
- [ ] Основные компоненты
- [ ] Установка minikube
- [ ] Первые команды kubectl

## 🚀 Что такое Kubernetes

Kubernetes - это платформа для автоматизации развертывания, масштабирования и управления контейнеризованными приложениями.

## 🔧 Установка minikube

```bash
# Linux
curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
sudo install minikube-linux-amd64 /usr/local/bin/minikube

# Запуск кластера
minikube start
✅ Первые команды
bashkubectl get nodes
kubectl get pods
kubectl create deployment hello-world --image=nginx

📱 Telegram: @devopsway_channel
🌐 Сайт: devopsway.ru
