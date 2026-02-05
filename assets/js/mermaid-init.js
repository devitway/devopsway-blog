// Mermaid initialization for DevOps Way
(function() {
  'use strict';

  function getCurrentTheme() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ||
           document.body.classList.contains('dark') ? 'dark' : 'default';
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

    createLightbox();
    renderDiagrams();
    observeThemeChanges();
  }

  // Lightbox для увеличения диаграмм
  function createLightbox() {
    if (document.getElementById('mermaid-lightbox')) return;

    var overlay = document.createElement('div');
    overlay.id = 'mermaid-lightbox';
    overlay.innerHTML = '<div class="mermaid-lightbox-content"></div><div class="mermaid-lightbox-close">&times;</div><div class="mermaid-lightbox-hint">Нажмите для закрытия</div>';
    document.body.appendChild(overlay);

    var style = document.createElement('style');
    style.textContent = '#mermaid-lightbox{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.85);z-index:9999;display:none;align-items:center;justify-content:center;cursor:zoom-out}#mermaid-lightbox.active{display:flex}.mermaid-lightbox-content{max-width:95vw;max-height:90vh;overflow:auto;background:#1d1e20;padding:2rem;border-radius:12px}.mermaid-lightbox-content svg{max-width:none!important;width:auto;height:auto}.mermaid-lightbox-close{position:absolute;top:20px;right:30px;font-size:40px;color:#fff;cursor:pointer}.mermaid-lightbox-hint{position:absolute;bottom:20px;color:rgba(255,255,255,.5);font-size:14px}.mermaid{cursor:zoom-in}#mermaid-lightbox:not(.dark) .mermaid-lightbox-content{background:#f8f8f8}#mermaid-lightbox:not(.dark) .mermaid-lightbox-close{color:#333}';
    document.head.appendChild(style);

    overlay.addEventListener('click', closeLightbox);
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') closeLightbox();
    });
  }

  function openLightbox(svg) {
    var lightbox = document.getElementById('mermaid-lightbox');
    var content = lightbox.querySelector('.mermaid-lightbox-content');
    // Клонируем SVG чтобы сохранить все стили
    var clone = svg.cloneNode(true);
    clone.style.maxWidth = 'none';
    clone.style.minWidth = '60vw';
    content.innerHTML = '';
    content.appendChild(clone);
    // Применяем тему к lightbox
    if (document.body.classList.contains('dark')) {
      lightbox.classList.add('dark');
    } else {
      lightbox.classList.remove('dark');
    }
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    var lightbox = document.getElementById('mermaid-lightbox');
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
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
            // Добавляем клик для увеличения
            el.addEventListener('click', function(e) {
              e.stopPropagation();
              openLightbox(svg);
            });
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
