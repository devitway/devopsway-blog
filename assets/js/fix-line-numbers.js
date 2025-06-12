// Убираем номера строк из копирования
(function() {
    'use strict';
    
    function removeLineNumbers() {
        // Находим все номера строк
        const lineNumbers = document.querySelectorAll('.lnt, .lnl, span.lnt, span.lnl, td.lnt, td.lnl');
        
        lineNumbers.forEach(el => {
            // Полностью скрываем элемент
            el.style.display = 'none';
            el.style.visibility = 'hidden';
            el.style.position = 'absolute';
            el.style.left = '-9999px';
            el.style.top = '-9999px';
            el.style.width = '0';
            el.style.height = '0';
            el.style.opacity = '0';
            el.style.fontSize = '0';
            el.style.lineHeight = '0';
            
            // Отключаем выделение
            el.style.userSelect = 'none';
            el.style.webkitUserSelect = 'none';
            el.style.mozUserSelect = 'none';
            el.style.msUserSelect = 'none';
            el.style.pointerEvents = 'none';
            
            // Убираем из DOM для копирования
            el.setAttribute('aria-hidden', 'true');
            el.setAttribute('tabindex', '-1');
            
            // Обработчики событий
            el.addEventListener('selectstart', e => e.preventDefault());
            el.addEventListener('mousedown', e => e.preventDefault());
            el.addEventListener('copy', e => e.preventDefault());
        });
        
        console.log(`🚫 Скрыто ${lineNumbers.length} номеров строк`);
    }
    
    // Запускаем после загрузки
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', removeLineNumbers);
    } else {
        removeLineNumbers();
    }
    
    // Повторяем через интервалы для динамически загружаемого контента
    setTimeout(removeLineNumbers, 500);
    setTimeout(removeLineNumbers, 1000);
    setTimeout(removeLineNumbers, 2000);
})();
