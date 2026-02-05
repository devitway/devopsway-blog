// Mermaid initialization for DevOps Way
(function() {
  'use strict';

  function getCurrentTheme() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ||
           document.body.classList.contains('dark') ? 'dark' : 'base';
  }

  function initMermaid() {
    if (typeof mermaid === 'undefined') return;

    mermaid.initialize({
      startOnLoad: false,
      theme: getCurrentTheme(),
      securityLevel: 'loose',
      fontFamily: 'Inter, system-ui, sans-serif',
      flowchart: { useMaxWidth: true, htmlLabels: true }
    });

    renderDiagrams();
    observeThemeChanges();
  }

  function renderDiagrams() {
    document.querySelectorAll('.mermaid:not([data-processed])').forEach(function(el, i) {
      var text = el.textContent.trim();
      if (!text) return;

      mermaid.render('mermaid-' + Date.now() + '-' + i, text)
        .then(function(result) {
          el.innerHTML = result.svg;
          el.setAttribute('data-processed', 'true');
          var svg = el.querySelector('svg');
          if (svg) {
            svg.style.maxWidth = '100%';
            svg.style.height = 'auto';
            svg.removeAttribute('height');
          }
        })
        .catch(function() {
          el.innerHTML = '<div class="mermaid-error">Ошибка синтаксиса диаграммы</div>';
          el.setAttribute('data-processed', 'error');
        });
    });
  }

  function observeThemeChanges() {
    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(m) {
        if (m.attributeName === 'data-theme' || m.attributeName === 'class') {
          document.querySelectorAll('.mermaid[data-processed="true"]').forEach(function(el) {
            el.setAttribute('data-theme', getCurrentTheme());
          });
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMermaid);
  } else {
    initMermaid();
  }
})();
