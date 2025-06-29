---
title: "🏗️ Пример использования диаграмм в Hugo"
description: "Демонстрация интерактивных диаграмм с системой зума и анимацией"
date: 2025-06-19T23:00:00+02:00
lastmod: 2025-06-19T23:00:00+02:00
draft: false
diagrams: true  # Включает подключение скриптов диаграмм для этой страницы
categories: ["DevOps", "Architecture", "Tutorial"]
tags: ["диаграммы", "микросервисы", "архитектура", "hugo", "d3js"]
author: "DevOps Way"
---

# Интерактивные диаграммы в Hugo

Данная страница демонстрирует работу исправленной системы диаграмм с полным функционалом зума, интерактивности и адаптивности.

## 🏗️ Микросервисная архитектура

Эта диаграмма показывает типичную архитектуру e-commerce платформы с микросервисами:

{{< diagram type="microservices" id="ecommerce-arch" title="Архитектура e-commerce платформы" description="Показывает взаимодействие между микросервисами, базами данных и внешними сервисами" >}}

### Особенности архитектуры:

- **API Gateway** - единая точка входа для всех запросов
- **Микросервисы** - независимые сервисы с собственными базами данных
- **Критические пути** - выделены красным пунктиром для обработки заказов
- **Кэширование** - Redis для быстрого доступа к данным

## 🌐 Сетевая топология

Диаграмма сетевой инфраструктуры дата-центра:

{{< diagram type="network" id="datacenter-network" title="Топология сети дата-центра" description="Показывает подключение серверов через коммутаторы и маршрутизаторы" height="400" >}}

### Компоненты сети:

- **Router** - основной маршрутизатор для внешних подключений
- **Switches** - коммутаторы для подключения серверов
- **Servers** - физические серверы различного назначения

## 🏛️ Простая архитектура

Базовая трехуровневая архитектура веб-приложения:

{{< diagram type="architecture" id="simple-arch" title="Трехуровневая архитектура" description="Классическая архитектура: frontend, backend, database" >}}

### Уровни архитектуры:

1. **Frontend** - пользовательский интерфейс
2. **Backend API** - серверная логика и API
3. **Database** - хранение данных

## 🎮 Управление диаграммами

### Доступные функции:

- **🔄 Сбросить** - возврат к исходному масштабу и позиции
- **🔍 Увеличить** - зум в 1.5 раза
- **🔎 Уменьшить** - зум из 1.5 раза
- **⚡ Критический путь** - подсветка важных связей на 3 секунды

### Интерактивность:

- **Колесо мыши** - плавное масштабирование
- **Перетаскивание** - перемещение диаграммы
- **Клик на элемент** - отображение информации о компоненте
- **Наведение курсора** - подсветка связанных элементов

## 📱 Адаптивность

Диаграммы автоматически адаптируются под размер экрана:

- **Десктоп** - полный размер с горизонтальными кнопками
- **Планшет** - уменьшенные элементы управления
- **Мобильный** - вертикальное расположение кнопок, оптимизированный размер

## 🎨 Цветовая схема

### Типы компонентов:

- 🟦 **API Gateway** - синий (#667eea)
- 🟢 **Микросервисы** - зеленый (#48bb78)  
- 🟠 **Базы данных** - оранжевый (#ed8936)
- 🟣 **Очереди** - фиолетовый (#9f7aea)
- 🔵 **Кэш** - бирюзовый (#38b2ac)
- 🔴 **Внешние сервисы** - красный (#e53e3e)

## 🔧 Технические детали

### Используемые технологии:

- **D3.js v7.8.5** - для отрисовки и интерактивности
- **Hugo Shortcodes** - для простого использования
- **CSS Grid/Flexbox** - для адаптивности
- **SVG** - векторная графика для четкости

### Браузерная поддержка:

- ✅ Chrome 60+
- ✅ Firefox 55+
- ✅ Safari 12+
- ✅ Edge 79+

## 🚀 Производительность

### Оптимизации:

- **Lazy Loading** - диаграммы загружаются при появлении в viewport
- **Минификация** - сжатие CSS и JavaScript файлов
- **CDN** - использование Cloudflare для D3.js
- **Preload** - предзагрузка критических ресурсов

### Размеры файлов:

- `diagram-system.js` - ~15KB (минифицированный)
- `diagrams.css` - ~8KB (минифицированный)
- `D3.js` - ~280KB (с CDN)

## 🛡️ Безопасность

### Меры безопасности:

- **Integrity hash** - проверка целостности D3.js
- **CSP поддержка** - совместимость с Content Security Policy
- **XSS защита** - санитизация пользовательского ввода
- **HTTPS only** - загрузка ресурсов только по HTTPS

## 🔍 Отладка

### Консольные команды для отладки:

```javascript
// Проверка загрузки D3
console.log('D3 версия:', d3.version);

// Проверка системы диаграмм
console.log('DiagramSystem:', window.DiagramSystem);

// Список диаграмм на странице
console.log('Диаграммы:', document.querySelectorAll('[data-diagram-type]'));

// Проверка зума для конкретной диаграммы
window.DiagramSystem.resetZoom('ecommerce-arch');
```

## 📝 Заключение

Исправленная система диаграмм обеспечивает:

- ✅ **Полную функциональность зума** без ошибок
- ✅ **Интерактивность** с информационными панелями
- ✅ **Адаптивность** для всех устройств
- ✅ **Производительность** с оптимизацией загрузки
- ✅ **Доступность** с поддержкой screen readers
- ✅ **Безопасность** с проверкой целостности

Все проблемы с TypeScript ошибками, preload'ом и отсутствием зума были успешно устранены! 🎉