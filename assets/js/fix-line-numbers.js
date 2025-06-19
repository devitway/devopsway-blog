// assets/js/fix-line-numbers.js
// Исправление номеров строк, которые конфликтуют с диаграммами

(function() {
    'use strict';
    
    function hideLineNumbers() {
        // Скрываем номера строк во всех блоках кода
        const lineNumbers = document.querySelectorAll('.lnt, .lnl, span.lnt, span.lnl, td.lnt, td.lnl');
        lineNumbers.forEach(el => {
            el.style.display = 'none';
            el.style.visibility = 'hidden';
            el.style.userSelect = 'none';
            el.style.pointerEvents = 'none';
            el.setAttribute('aria-hidden', 'true');
        });
        
        // Дополнительно скрываем таблицы с номерами строк
        const lineTables = document.querySelectorAll('.chroma .lntable');
        lineTables.forEach(table => {
            const lineNumberCells = table.querySelectorAll('.lntd:first-child');
            lineNumberCells.forEach(cell => {
                cell.style.display = 'none';
            });
        });
        
        console.log(`Скрыто ${lineNumbers.length} номеров строк`);
    }
    
    function cleanupCodeBlocks() {
        // Очищаем пустые элементы после скрытия номеров строк
        const emptyElements = document.querySelectorAll('.lntd:empty, .lnt:empty, .lnl:empty');
        emptyElements.forEach(el => {
            el.remove();
        });
    }
    
    // Запускаем сразу и после загрузки DOM
    hideLineNumbers();
    document.addEventListener('DOMContentLoaded', function() {
        hideLineNumbers();
        cleanupCodeBlocks();
    });
    
    // Наблюдаем за изменениями DOM для динамического контента
    const observer = new MutationObserver(function(mutations) {
        let shouldUpdate = false;
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                // Проверяем, добавились ли новые элементы с номерами строк
                for (let node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.matches && node.matches('.lnt, .lnl, .chroma, .highlight')) {
                            shouldUpdate = true;
                            break;
                        }
                        if (node.querySelector && node.querySelector('.lnt, .lnl, .chroma, .highlight')) {
                            shouldUpdate = true;
                            break;
                        }
                    }
                }
            }
        });
        
        if (shouldUpdate) {
            setTimeout(hideLineNumbers, 10);
        }
    });
    
    // Начинаем наблюдение за изменениями
    observer.observe(document.body, { 
        childList: true, 
        subtree: true 
    });
    
    // Дополнительная проверка через интервал для надежности
    let intervalId = setInterval(function() {
        const visibleLineNumbers = document.querySelectorAll('.lnt:not([style*="display: none"]), .lnl:not([style*="display: none"])');
        if (visibleLineNumbers.length > 0) {
            hideLineNumbers();
        }
    }, 1000);
    
    // Останавливаем интервал через 10 секунд после загрузки страницы
    setTimeout(function() {
        clearInterval(intervalId);
    }, 10000);
    
    console.log('Система скрытия номеров строк инициализирована');
})();