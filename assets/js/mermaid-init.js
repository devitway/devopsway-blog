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
    style.textContent = '#mermaid-lightbox{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.9);z-index:9999;display:none;align-items:center;justify-content:center;cursor:zoom-out}#mermaid-lightbox.active{display:flex}.mermaid-lightbox-content{max-width:95vw;max-height:90vh;overflow:auto;background:var(--code-bg,#1e1e1e);padding:2rem;border-radius:12px}.mermaid-lightbox-content svg{max-width:none!important;width:auto;height:auto;min-width:60vw}.mermaid-lightbox-close{position:absolute;top:20px;right:30px;font-size:40px;color:#fff;cursor:pointer}.mermaid-lightbox-hint{position:absolute;bottom:20px;color:rgba(255,255,255,.5);font-size:14px}.mermaid{cursor:zoom-in}';
    document.head.appendChild(style);

    overlay.addEventListener('click', closeLightbox);
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') closeLightbox();
    });
  }

  function openLightbox(svg) {
    var lightbox = document.getElementById('mermaid-lightbox');
    var content = lightbox.querySelector('.mermaid-lightbox-content');
    content.innerHTML = svg.outerHTML.replace(/max-width:\s*100%/g, 'max-width:none');
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
