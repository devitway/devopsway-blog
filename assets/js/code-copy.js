/**
 * Исправленная система копирования кода без номеров строк
 * DevOps Way Blog - улучшенная версия
 */

class CodeCopyManager {
  constructor() {
    this.init();
  }

  init() {
    this.addCopyButtons();
    this.hideLineNumbers();
    console.log('📋 Code Copy Manager initialized (improved version)');
  }

  // Улучшенное скрытие номеров строк
  hideLineNumbers() {
    const lineNumberSelectors = [
      '.lnt', '.lnl', 'span.lnt', 'span.lnl', 'td.lnt', 'td.lnl',
      '.highlight .lnt', '.highlight .lnl', '.highlight table .lnt', 
      '.highlight table .lnl', '.chroma .lnt', '.chroma .lnl',
      '[class*="line-number"]', '[data-line-number]'
    ];

    lineNumberSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        el.style.cssText = `
          display: none !important;
          visibility: hidden !important;
          position: absolute !important;
          left: -9999px !important;
          top: -9999px !important;
          width: 0 !important;
          height: 0 !important;
          opacity: 0 !important;
          user-select: none !important;
          -webkit-user-select: none !important;
          -moz-user-select: none !important;
          -ms-user-select: none !important;
          pointer-events: none !important;
        `;
        
        el.setAttribute('aria-hidden', 'true');
        el.setAttribute('tabindex', '-1');
        el.setAttribute('data-no-copy', 'true');
        
        ['selectstart', 'mousedown', 'copy', 'drag'].forEach(event => {
          el.addEventListener(event, e => e.preventDefault());
        });
      });
    });
  }

  addCopyButtons() {
    const codeBlocks = document.querySelectorAll('pre > code');
    
    codeBlocks.forEach((codeBlock, index) => {
      const pre = codeBlock.parentNode;
      const container = pre.parentNode;
      
      if (container.querySelector('.copy-code')) return;
      
      const copyButton = document.createElement('button');
      copyButton.className = 'copy-code';
      copyButton.innerHTML = '📋 Копировать';
      copyButton.setAttribute('aria-label', 'Копировать код в буфер обмена');
      copyButton.setAttribute('data-code-index', index);
      
      copyButton.addEventListener('click', () => this.copyCode(codeBlock, copyButton));
      
      container.style.position = 'relative';
      container.appendChild(copyButton);
      container.classList.add('loaded');
    });
  }

  getCleanCodeText(codeBlock) {
    const clone = codeBlock.cloneNode(true);
    
    const lineNumbers = clone.querySelectorAll(
      '.lnt, .lnl, [class*="line-number"], [data-line-number], [data-no-copy="true"]'
    );
    lineNumbers.forEach(el => el.remove());
    
    let text = clone.textContent || clone.innerText || '';
    
    text = text
      .replace(/^\s*\d+\s+/gm, '')
      .replace(/^\s+|\s+$/g, '')
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+$/gm, '');
    
    return text;
  }

  async copyCode(codeBlock, button) {
    try {
      const cleanText = this.getCleanCodeText(codeBlock);
      await navigator.clipboard.writeText(cleanText);
      
      this.updateButtonState(button, 'success');
      this.showNotification('Код скопирован в буфер обмена!', 'success');
      
      if (typeof gtag !== 'undefined') {
        gtag('event', 'code_copy', {
          event_category: 'engagement',
          event_label: 'code_block',
          value: cleanText.length
        });
      }
      
    } catch (error) {
      console.error('Ошибка копирования:', error);
      this.fallbackCopy(codeBlock, button);
    }
  }

  fallbackCopy(codeBlock, button) {
    try {
      const cleanText = this.getCleanCodeText(codeBlock);
      
      const textArea = document.createElement('textarea');
      textArea.value = cleanText;
      textArea.style.cssText = `
        position: fixed; left: -999999px; top: -999999px;
        opacity: 0; pointer-events: none;
      `;
      document.body.appendChild(textArea);
      
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      
      this.updateButtonState(button, 'success');
      this.showNotification('Код скопирован в буфер обмена!', 'success');
      
    } catch (error) {
      console.error('Fallback копирование не удалось:', error);
      this.updateButtonState(button, 'error');
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
    const existingNotifications = document.querySelectorAll('.copy-notification');
    existingNotifications.forEach(notification => notification.remove());
    
    const notification = document.createElement('div');
    notification.className = `copy-notification ${type}`;
    
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    notification.innerHTML = `${icons[type]} ${message}`;
    
    notification.style.cssText = `
      position: fixed; top: 20px; right: 20px;
      background: ${type === 'error' ? '#ef4444' : '#10b981'};
      color: white; padding: 12px 16px; border-radius: 8px;
      font-size: 14px; font-weight: 500; z-index: 10000;
      transform: translateX(100%); transition: transform 0.3s ease;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => notification.style.transform = 'translateX(0)', 100);
    setTimeout(() => {
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  observeCodeBlocks() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          const addedNodes = Array.from(mutation.addedNodes);
          addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const codeBlocks = node.querySelectorAll('pre > code');
              if (codeBlocks.length > 0) {
                this.hideLineNumbers();
                this.addCopyButtons();
              }
            }
          });
        }
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }
}

let codeManager;

function initCodeCopyManager() {
  if (!codeManager) {
    codeManager = new CodeCopyManager();
    codeManager.observeCodeBlocks();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCodeCopyManager);
} else {
  initCodeCopyManager();
}

setTimeout(initCodeCopyManager, 500);
setTimeout(initCodeCopyManager, 1000);
setTimeout(initCodeCopyManager, 2000);

window.CodeCopyManager = CodeCopyManager;