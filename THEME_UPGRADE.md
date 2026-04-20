# Улучшения темы DevOps Way Blog

## Что было добавлено

### ✨ Система тем
- **Автоматическое определение** системной темы (auto/light/dark)
- **Плавные переходы** между темами
- **Сохранение выбора** пользователя

### 🎨 Стилизация
- **GitHub Dark** стиль подсветки синтаксиса
- **Современные CSS переменные** для управления цветами
- **Улучшенные блоки кода** с тенями и скруглениями
- **Мобильная адаптация** для всех элементов

### 📋 Копирование кода
- **Умные кнопки копирования** на всех блоках кода
- **Красивые уведомления** о статусе копирования
- **Fallback для старых браузеров**

### ⚡ Производительность
- **Ленивая загрузка** изображений
- **Минификация** CSS и JS
- **Оптимизированные шрифты**
- **Service Worker** для PWA

## Структура файлов

```
├── assets/
│   ├── css/extended/
│   │   └── custom.css          # Основные стили
│   └── js/
│       ├── theme-toggle.js     # Система тем
│       └── code-copy.js        # Копирование кода
├── layouts/partials/
│   ├── extend_head.html        # Доп. секция head
│   └── extend_footer.html      # Доп. скрипты
├── static/
│   ├── sw.js                   # Service Worker
│   └── robots.txt              # SEO
└── hugo.toml                   # Обновленная конфигурация
```

## Команды для использования

### Разработка
```bash
hugo server --buildDrafts --buildFuture
```

### Производственная сборка
```bash
hugo --minify --cleanDestinationDir --gc
```

### Деплой
```bash
./deploy.sh  # или ваш скрипт деплоя
```

## Кастомизация

### Изменение цветов
Отредактируйте CSS переменные в `assets/css/extended/custom.css`:

```css
:root {
  --accent-color: #your-color;
  --bg-primary: #your-bg;
}
```

### Добавление новых тем
В `assets/js/theme-toggle.js` добавьте в массив `themes`:

```javascript
this.themes = ['auto', 'light', 'dark', 'your-theme'];
```

## Поддержка

- **Документация Hugo**: https://gohugo.io/documentation/
- **Тема PaperMod**: https://github.com/adityatelange/hugo-PaperMod
- **Вопросы**: создайте Issue в репозитории

---
Обновление выполнено: 2025-06-19
