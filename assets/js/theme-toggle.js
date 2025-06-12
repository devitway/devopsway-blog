/**
 * Улучшенная система переключения тем - DevOps Way Blog
 * Поддерживает: auto, light, dark с плавными переходами
 */

class ThemeManager {
  constructor() {
    this.storageKey = 'pref-theme';
    this.themes = ['auto', 'light', 'dark'];
    this.currentTheme = this.getStoredTheme() || 'auto';
    
    this.init();
  }

  init() {
    // Применяем тему при загрузке
    this.applyTheme(this.currentTheme);
    
    // Слушатель изменений системной темы
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (this.currentTheme === 'auto') {
        this.applyTheme('auto');
      }
    });
    
    // Обновляем кнопку переключения
    this.updateToggleButton();
    
    // Добавляем обработчик на кнопку
    const toggleButton = document.getElementById('theme-toggle');
    if (toggleButton) {
      toggleButton.addEventListener('click', () => this.toggleTheme());
    }
    
    console.log('🎨 Theme Manager initialized:', this.currentTheme);
  }

  getStoredTheme() {
    return localStorage.getItem(this.storageKey);
  }

  getSystemTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  getEffectiveTheme(theme = this.currentTheme) {
    return theme === 'auto' ? this.getSystemTheme() : theme;
  }

  applyTheme(theme) {
    const effectiveTheme = this.getEffectiveTheme(theme);
    const body = document.body;
    const html = document.documentElement;
    
    // Удаляем все классы тем
    body.classList.remove('light', 'dark');
    html.removeAttribute('data-theme');
    
    // Применяем новую тему
    body.classList.add(effectiveTheme);
    html.setAttribute('data-theme', effectiveTheme);
    
    // Сохраняем предпочтение
    localStorage.setItem(this.storageKey, theme);
    this.currentTheme = theme;
    
    // Обновляем meta theme-color для мобильных браузеров
    this.updateMetaThemeColor(effectiveTheme);
    
    console.log(`🎨 Theme applied: ${theme} (effective: ${effectiveTheme})`);
  }

  updateMetaThemeColor(theme) {
    let themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (!themeColorMeta) {
      themeColorMeta = document.createElement('meta');
      themeColorMeta.name = 'theme-color';
      document.head.appendChild(themeColorMeta);
    }
    
    const colors = {
      light: '#ffffff',
      dark: '#0f172a'
    };
    
    themeColorMeta.content = colors[theme] || colors.light;
  }

  toggleTheme() {
    const currentIndex = this.themes.indexOf(this.currentTheme);
    const nextIndex = (currentIndex + 1) % this.themes.length;
    const nextTheme = this.themes[nextIndex];
    
    this.applyTheme(nextTheme);
    this.updateToggleButton();
    
    // Показываем уведомление о смене темы
    this.showThemeNotification(nextTheme);
  }

  updateToggleButton() {
    const button = document.getElementById('theme-toggle');
    if (!button) return;
    
    const icons = {
      auto: '🌓',
      light: '☀️',
      dark: '🌙'
    };
    
    const labels = {
      auto: 'Авто',
      light: 'Светлая',
      dark: 'Темная'
    };
    
    const icon = button.querySelector('svg');
    if (icon) {
      icon.style.display = 'none';
    }
    
    button.innerHTML = `${icons[this.currentTheme]} ${labels[this.currentTheme]}`;
    button.title = `Текущая тема: ${labels[this.currentTheme]}. Нажмите для переключения.`;
  }

  showThemeNotification(theme) {
    const labels = {
      auto: 'Автоматическая тема',
      light: 'Светлая тема',
      dark: 'Темная тема'
    };
    
    this.showNotification(`Переключено на ${labels[theme]}`);
  }

  showNotification(message) {
    // Удаляем существующие уведомления
    const existingNotifications = document.querySelectorAll('.copy-notification');
    existingNotifications.forEach(notification => notification.remove());
    
    // Создаем новое уведомление
    const notification = document.createElement('div');
    notification.className = 'copy-notification';
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Показываем уведомление
    setTimeout(() => notification.classList.add('show'), 100);
    
    // Скрываем через 3 секунды
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }
}

// Инициализируем менеджер тем при загрузке DOM
document.addEventListener('DOMContentLoaded', () => {
  new ThemeManager();
});
