/**
 * 🌙 Улучшенное автоматическое управление темой для DevOps Way
 * Поддерживает системную тему, плавные переходы и память настроек
 */

(function() {
    'use strict';
    
    // Константы
    const THEME_KEY = 'pref-theme';
    const THEMES = {
        LIGHT: 'light',
        DARK: 'dark',
        AUTO: 'auto'
    };
    
    // Утилиты
    const $ = selector => document.querySelector(selector);
    const hasClass = (element, className) => element?.classList?.contains(className);
    const addClass = (element, className) => element?.classList?.add(className);
    const removeClass = (element, className) => element?.classList?.remove(className);
    
    /**
     * Определяет системную тему
     * @returns {string} 'dark' или 'light'
     */
    function getSystemTheme() {
        return window.matchMedia('(prefers-color-scheme: dark)').matches 
            ? THEMES.DARK 
            : THEMES.LIGHT;
    }
    
    /**
     * Получает сохраненную тему пользователя
     * @returns {string} Тема из localStorage или 'auto'
     */
    function getSavedTheme() {
        try {
            return localStorage.getItem(THEME_KEY) || THEMES.AUTO;
        } catch (e) {
            console.warn('Не удалось прочитать тему из localStorage:', e);
            return THEMES.AUTO;
        }
    }
    
    /**
     * Сохраняет тему в localStorage
     * @param {string} theme - Тема для сохранения
     */
    function saveTheme(theme) {
        try {
            localStorage.setItem(THEME_KEY, theme);
        } catch (e) {
            console.warn('Не удалось сохранить тему в localStorage:', e);
        }
    }
    
    /**
     * Применяет тему к документу
     * @param {string} theme - Тема для применения
     */
    function applyTheme(theme) {
        const isDark = theme === THEMES.DARK;
        const body = document.body;
        
        if (isDark) {
            addClass(body, 'dark');
            body.setAttribute('data-theme', 'dark');
        } else {
            removeClass(body, 'dark');
            body.setAttribute('data-theme', 'light');
        }
        
        // Уведомляем другие компоненты о смене темы
        window.dispatchEvent(new CustomEvent('themechange', {
            detail: { theme, isDark }
        }));
        
        // Обновляем иконку переключателя (если есть)
        updateThemeToggleIcon(isDark);
    }
    
    /**
     * Обновляет иконку переключателя темы
     * @param {boolean} isDark - Текущая тема темная?
     */
    function updateThemeToggleIcon(isDark) {
        const toggleButton = $('#theme-toggle');
        if (!toggleButton) return;
        
        // Обновляем title для доступности
        toggleButton.title = isDark 
            ? 'Переключить на светлую тему' 
            : 'Переключить на темную тему';
        
        // Обновляем aria-label
        toggleButton.setAttribute('aria-label', 
            isDark ? 'Включить светлую тему' : 'Включить темную тему'
        );
    }
    
    /**
     * Получает актуальную тему с учетом настроек пользователя
     * @returns {string} Актуальная тема
     */
    function getCurrentTheme() {
        const savedTheme = getSavedTheme();
        
        if (savedTheme === THEMES.AUTO) {
            return getSystemTheme();
        }
        
        return savedTheme;
    }
    
    /**
     * Переключает тему
     */
    function toggleTheme() {
        const currentTheme = getCurrentTheme();
        const newTheme = currentTheme === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
        
        // Сохраняем выбор пользователя (отключаем авто-режим)
        saveTheme(newTheme);
        applyTheme(newTheme);
        
        // Логируем для отладки
        console.log(`🌙 Тема изменена: ${currentTheme} → ${newTheme}`);
    }
    
    /**
     * Добавляет плавные переходы между темами
     */
    function addSmoothTransitions() {
        const style = document.createElement('style');
        style.textContent = `
            /* Плавные переходы для смены темы */
            body,
            .highlight,
            pre,
            code,
            .post-content,
            .nav,
            .header,
            .footer,
            .entry {
                transition: 
                    background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                    color 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                    border-color 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
            }
            
            /* Плавное появление кнопки переключения */
            #theme-toggle {
                transition: all 0.2s ease !important;
            }
            
            #theme-toggle:hover {
                transform: scale(1.1) !important;
            }
            
            /* Предотвращаем моргание при загрузке */
            .theme-transition-disabled * {
                transition: none !important;
            }
        `;
        document.head.appendChild(style);
    }
    
    /**
     * Инициализация темы при загрузке страницы
     */
    function initTheme() {
        // Временно отключаем переходы для предотвращения моргания
        addClass(document.body, 'theme-transition-disabled');
        
        // Применяем тему
        const currentTheme = getCurrentTheme();
        applyTheme(currentTheme);
        
        // Включаем переходы через небольшую задержку
        setTimeout(() => {
            removeClass(document.body, 'theme-transition-disabled');
        }, 50);
        
        console.log(`🎨 Тема инициализирована: ${currentTheme}`);
    }
    
    /**
     * Настройка слушателей событий
     */
    function setupEventListeners() {
        // Слушаем изменения системной темы
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        
        function handleSystemThemeChange(e) {
            const savedTheme = getSavedTheme();
            
            // Реагируем только если пользователь не выбрал конкретную тему
            if (savedTheme === THEMES.AUTO) {
                const newTheme = e.matches ? THEMES.DARK : THEMES.LIGHT;
                applyTheme(newTheme);
                console.log(`🔄 Системная тема изменена: ${newTheme}`);
            }
        }
        
        // Современный способ подписки на изменения
        if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', handleSystemThemeChange);
        } else {
            // Fallback для старых браузеров
            mediaQuery.addListener(handleSystemThemeChange);
        }
        
        // Настройка переключателя темы
        document.addEventListener('DOMContentLoaded', () => {
            const toggleButton = $('#theme-toggle');
            if (toggleButton) {
                toggleButton.addEventListener('click', toggleTheme);
                
                // Добавляем поддержку клавиатуры
                toggleButton.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleTheme();
                    }
                });
            }
        });
        
        // Экспортируем функции для возможного использования в других скриптах
        window.DevOpsWayTheme = {
            toggle: toggleTheme,
            getCurrent: getCurrentTheme,
            apply: applyTheme,
            getSystem: getSystemTheme
        };
    }
    
    /**
     * Главная функция инициализации
     */
    function init() {
        addSmoothTransitions();
        initTheme();
        setupEventListeners();
        
        // Сообщаем о готовности темы
        window.dispatchEvent(new CustomEvent('themeready', {
            detail: { theme: getCurrentTheme() }
        }));
    }
    
    // Запускаем инициализацию
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
})();