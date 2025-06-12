/**
 * Улучшенная система копирования кода - DevOps Way Blog
 * Современные уведомления, лучший UX
 */

class CodeCopyManager {
  constructor() {
    this.init();
  }

  init() {
    this.addCopyButtons();
    console.log('📋 Code Copy Manager initialized');
  }

  addCopyButtons() {
    const codeBlocks = document.querySelectorAll('pre > code');
    
    codeBlocks.forEach((codeBlock, index) => {
      const pre = codeBlock.parentNode;
      const container = pre.parentNode;
      
      // Проверяем, есть ли уже кнопка
      if (container.querySelector('.copy-code')) return;
      
      // Создаем кнопку копирования
      const copyButton = document.createElement('button');
      copyButton.className = 'copy-code';
      copyButton.innerHTML = '📋 Копировать';
      copyButton.setAttribute('aria-label', 'Копировать код в буфер обмена');
      copyButton.setAttribute('data-code-index', index);
      
      // Добавляем обработчик клика
      copyButton.addEventListener('click', () => this.copyCode(codeBlock, copyButton));
      
      // Добавляем кнопку к контейнеру
      container.style.position = 'relative';
      container.appendChild(copyButton);
      
      // Отмечаем блок как загруженный (убираем анимацию shimmer)
      container.classList.add('loaded');
    });
  }

  async copyCode(codeBlock, button) {
    try {
      // Получаем текст кода
      const codeText = codeBlock.textContent || codeBlock.innerText;
      
      // Копируем в буфер обмена
      await navigator.clipboard.writeText(codeText);
      
      // Обновляем кнопку
      this.updateButtonState(button, 'success');
      
      // Показываем уведомление
      this.showNotification('Код скопирован в буфер обмена!', 'success');
      
      // Аналитика (если Google Analytics доступен)
      if (typeof gtag !== 'undefined') {
        gtag('event', 'code_copy', {
          event_category: 'engagement',
          event_label: 'code_block'
        });
      }
      
    } catch (error) {
      console.error('Ошибка копирования:', error);
      
      // Fallback для старых браузеров
      this.fallbackCopy(codeBlock, button);
    }
  }

  fallbackCopy(codeBlock, button) {
    try {
      // Создаем временный textarea
      const textArea = document.createElement('textarea');
      textArea.value = codeBlock.textContent || codeBlock.innerText;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      
      // Выделяем и копируем
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      
      // Удаляем временный элемент
      document.body.removeChild(textArea);
      
      // Обновляем кнопку
      this.updateButtonState(button, 'success');
      
      // Показываем уведомление
      this.showNotification('Код скопирован в буфер обмена!', 'success');
      
    } catch (error) {
      console.error('Fallback копирование не удалось:', error);
      
      // Обновляем кнопку с ошибкой
      this.updateButtonState(button, 'error');
      
      // Показываем уведомление об ошибке
      this.showNotification('Не удалось скопировать код', 'error');
    }
  }

  updateButtonState(button, state) {
    const originalText = '📋 Копировать';
    const originalClass = button.className;
    
    if (state === 'success') {
      button.innerHTML = '✅ Скопировано!';
      button.classList.add('copied');
      button.disabled = true;
      
      setTimeout(() => {
        button.innerHTML = originalText;
        button.className = originalClass;
        button.disabled = false;
      }, 2000);
      
    } else if (state === 'error') {
      button.innerHTML = '❌ Ошибка';
      button.classList.add('error');
      button.disabled = true;
      
      setTimeout(() => {
        button.innerHTML = originalText;
        button.className = originalClass;
        button.disabled = false;
      }, 2000);
    }
  }

  showNotification(message, type = 'info') {
    // Удаляем существующие уведомления
    const existingNotifications = document.querySelectorAll('.copy-notification');
    existingNotifications.forEach(notification => notification.remove());
    
    // Создаем новое уведомление
    const notification = document.createElement('div');
    notification.className = `copy-notification ${type}`;
    notification.textContent = message;
    
    // Добавляем иконку в зависимости от типа
    const icons = {
      success: '✅',
      error: '❌',
      info: 'ℹ️'
    };
    
    notification.innerHTML = `${icons[type]} ${message}`;
    
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

// Инициализируем менеджер копирования при загрузке DOM
document.addEventListener('DOMContentLoaded', () => {
  new CodeCopyManager();
});
