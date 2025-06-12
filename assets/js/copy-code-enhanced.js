/**
 * 📋 Улучшенная система копирования кода для DevOps Way
 * Поддерживает уведомления, статистику и доступность
 */

(function() {
    'use strict';
    
    // Конфигурация
    const CONFIG = {
        buttonText: {
            copy: '📋 Копировать',
            copying: '⏳ Копирую...',
            copied: '✅ Скопировано!',
            error: '❌ Ошибка'
        },
        timeouts: {
            feedback: 2000,
            fadeOut: 300
        },
        selectors: {
            codeBlocks: 'pre > code',
            highlights: '.highlight'
        }
    };
    
    // Статистика копирования
    let copyStats = {
        total: 0,
        successful: 0,
        failed: 0
    };
    
    /**
     * Создает кнопку копирования
     * @param {HTMLElement} codeBlock - Блок кода
     * @returns {HTMLButtonElement} Кнопка копирования
     */
    function createCopyButton(codeBlock) {
        const button = document.createElement('button');
        button.className = 'copy-code';
        button.textContent = CONFIG.buttonText.copy;
        button.setAttribute('aria-label', 'Копировать код в буфер обмена');
        button.setAttribute('title', 'Копировать код');
        button.type = 'button';
        
        // Добавляем поддержку клавиатуры
        button.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                button.click();
            }
        });
        
        return button;
    }
    
    /**
     * Получает чистый текст кода без номеров строк
     * @param {HTMLElement} codeElement - Элемент с кодом
     * @returns {string} Чистый текст кода
     */
    function getCleanCodeText(codeElement) {
        const clone = codeElement.cloneNode(true);
        
        // Удаляем номера строк если есть
        const lineNumbers = clone.querySelectorAll('.ln, .line-number, .lineno');
        lineNumbers.forEach(ln => ln.remove());
        
        // Удаляем дополнительные элементы Hugo highlight
        const extraElements = clone.querySelectorAll('.hl, .lnt');
        extraElements.forEach(el => el.remove());
        
        return clone.textContent || clone.innerText || '';
    }
    
    /**
     * Определяет язык программирования по блоку кода
     * @param {HTMLElement} codeBlock - Блок кода
     * @returns {string} Язык программирования
     */
    function detectLanguage(codeBlock) {
        const highlight = codeBlock.closest('.highlight');
        const classList = Array.from(highlight?.classList || []);
        
        // Ищем класс языка
        for (const className of classList) {
            if (className.startsWith('language-')) {
                return className.replace('language-', '');
            }
        }
        
        // Fallback к data-атрибутам
        return highlight?.dataset?.lang || 'code';
    }
    
    /**
     * Копирует текст в буфер обмена
     * @param {string} text - Текст для копирования
     * @returns {Promise<boolean>} Успешность операции
     */
    async function copyToClipboard(text) {
        try {
            // Современный Clipboard API
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
                return true;
            }
            
            // Fallback для старых браузеров
            return fallbackCopyToClipboard(text);
        } catch (error) {
            console.warn('Ошибка копирования через Clipboard API:', error);
            return fallbackCopyToClipboard(text);
        }
    }
    
    /**
     * Fallback копирование для старых браузеров
     * @param {string} text - Текст для копирования
     * @returns {boolean} Успешность операции
     */
    function fallbackCopyToClipboard(text) {
        try {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            textArea.setAttribute('aria-hidden', 'true');
            
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            
            return successful;
        } catch (error) {
            console.error('Fallback копирование не удалось:', error);
            return false;
        }
    }
    
    /**
     * Показывает уведомление о копировании
     * @param {HTMLButtonElement} button - Кнопка копирования
     * @param {boolean} success - Успешность операции
     * @param {string} language - Язык программирования
     */
    function showCopyFeedback(button, success, language) {
        const originalText = button.textContent;
        const originalTitle = button.title;
        
        if (success) {
            button.textContent = CONFIG.buttonText.copied;
            button.title = `${language.toUpperCase()} код скопирован!`;
            button.classList.add('copy-success');
            
            // Обновляем статистику
            copyStats.successful++;
            
            // Создаем небольшое уведомление
            createSuccessNotification(button, language);
        } else {
            button.textContent = CONFIG.buttonText.error;
            button.title = 'Не удалось скопировать код';
            button.classList.add('copy-error');
            
            copyStats.failed++;
        }
        
        // Возвращаем исходное состояние
        setTimeout(() => {
            button.textContent = originalText;
            button.title = originalTitle;
            button.classList.remove('copy-success', 'copy-error');
        }, CONFIG.timeouts.feedback);
    }
    
    /**
     * Создает уведомление об успешном копировании
     * @param {HTMLButtonElement} button - Кнопка копирования
     * @param {string} language - Язык программирования
     */
    function createSuccessNotification(button, language) {
        const notification = document.createElement('div');
        notification.className = 'copy-notification';
        notification.textContent = `${language.toUpperCase()} код скопирован!`;
        
        // Позиционируем уведомление
        const rect = button.getBoundingClientRect();
        notification.style.cssText = `
            position: fixed;
            top: ${rect.bottom + 10}px;
            right: ${window.innerWidth - rect.right}px;
            background: var(--accent-secondary, #10b981);
            color: white;
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 0.75rem;
            font-weight: 600;
            z-index: 1000;
            opacity: 0;
            transform: translateY(-10px);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            pointer-events: none;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        `;
        
        document.body.appendChild(notification);
        
        // Анимация появления
        requestAnimationFrame(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateY(0)';
        });
        
        // Удаляем через время
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateY(-10px)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, CONFIG.timeouts.fadeOut);
        }, CONFIG.timeouts.feedback - CONFIG.timeouts.fadeOut);
    }
    
    /**
     * Обработчик клика по кнопке копирования
     * @param {Event} event - Событие клика
     */
    async function handleCopyClick(event) {
        const button = event.target;
        const codeBlock = button.closest('.highlight').querySelector('code');
        
        if (!codeBlock) {
            console.error('Не найден блок кода для копирования');
            return;
        }
        
        // Показываем состояние загрузки
        const originalText = button.textContent;
        button.textContent = CONFIG.buttonText.copying;
        button.disabled = true;
        
        copyStats.total++;
        
        const codeText = getCleanCodeText(codeBlock);
        const language = detectLanguage(codeBlock);
        
        try {
            const success = await copyToClipboard(codeText);
            showCopyFeedback(button, success, language);
            
            // Логируем для аналитики (если нужно)
            if (success) {
                console.log(`📋 Скопирован ${language} код (${codeText.length} символов)`);
                
                // Отправляем событие для возможной аналитики
                window.dispatchEvent(new CustomEvent('codecopy', {
                    detail: {
                        language,
                        length: codeText.length,
                        success: true
                    }
                }));
            }
        } catch (error) {
            console.error('Ошибка копирования:', error);
            showCopyFeedback(button, false, language);
        } finally {
            button.disabled = false;
        }
    }
    
    /**
     * Добавляет кнопку копирования к блоку кода
     * @param {HTMLElement} codeBlock - Блок кода
     */
    function addCopyButtonToCodeBlock(codeBlock) {
        const highlight = codeBlock.closest('.highlight');
        if (!highlight || highlight.querySelector('.copy-code')) {
            return; // Кнопка уже существует
        }
        
        const button = createCopyButton(codeBlock);
        button.addEventListener('click', handleCopyClick);
        
        highlight.style.position = 'relative';
        highlight.appendChild(button);
    }
    
    /**
     * Инициализирует систему копирования для всех блоков кода
     */
    function initializeCopyButtons() {
        const codeBlocks = document.querySelectorAll(CONFIG.selectors.codeBlocks);
        
        codeBlocks.forEach(codeBlock => {
            addCopyButtonToCodeBlock(codeBlock);
        });
        
        console.log(`📋 Инициализировано ${codeBlocks.length} кнопок копирования`);
    }
    
    /**
     * Добавляет CSS стили для кнопок и уведомлений
     */
    function addCopyButtonStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* Стили для кнопки копирования уже в dark-theme-enhanced.css */
            
            /* Состояния кнопки */
            .copy-code.copy-success {
                background: var(--accent-secondary, #10b981) !important;
                color: white !important;
                border-color: var(--accent-secondary, #10b981) !important;
            }
            
            .copy-code.copy-error {
                background: var(--accent-error, #ef4444) !important;
                color: white !important;
                border-color: var(--accent-error, #ef4444) !important;
            }
            
            .copy-code:disabled {
                opacity: 0.6 !important;
                cursor: not-allowed !important;
            }
            
            /* Анимация для уведомлений */
            .copy-notification {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
            }
            
            /* Улучшенная видимость кнопки */
            .highlight:hover .copy-code {
                opacity: 1 !important;
            }
            
            /* Фокус для доступности */
            .copy-code:focus {
                outline: 2px solid var(--accent-primary, #3b82f6) !important;
                outline-offset: 2px !important;
            }
        `;
        document.head.appendChild(style);
    }
    
    /**
     * Экспортирует статистику копирования
     * @returns {object} Статистика
     */
    function getCopyStats() {
        return {
            ...copyStats,
            successRate: copyStats.total > 0 ? (copyStats.successful / copyStats.total * 100).toFixed(1) + '%' : '0%'
        };
    }
    
    /**
     * Обработчик динамически добавленного контента
     */
    function handleDynamicContent() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            const codeBlocks = node.querySelectorAll?.(CONFIG.selectors.codeBlocks) || [];
                            codeBlocks.forEach(addCopyButtonToCodeBlock);
                        }
                    });
                }
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        return observer;
    }
    
    /**
     * Главная функция инициализации
     */
    function init() {
        addCopyButtonStyles();
        initializeCopyButtons();
        handleDynamicContent();
        
        // Экспортируем API для внешнего использования
        window.DevOpsWayCopy = {
            getStats: getCopyStats,
            addToCodeBlock: addCopyButtonToCodeBlock,
            reinitialize: initializeCopyButtons
        };
        
        // Уведомляем о готовности
        window.dispatchEvent(new CustomEvent('copyready', {
            detail: { initialized: true }
        }));
        
        console.log('📋 Система копирования кода инициализирована');
    }
    
    // Запускаем инициализацию
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }