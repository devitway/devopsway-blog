/**
 * Система диаграмм с зумом для Hugo DevOps
 */

class DiagramSystem {
    constructor() {
      this.config = {
        zoomStep: 0.2,
        maxZoom: 4,
        minZoom: 0.3,
        wheelZoomSensitivity: 0.1,
        touchZoomSensitivity: 0.01,
        animationDuration: 300
      };
      
      this.state = {
        currentZoom: 1,
        isLightboxOpen: false,
        activeElement: null,
        touchStartDistance: 0,
        touchStartZoom: 1
      };
      
      this.elements = {
        lightbox: null,
        lightboxImage: null,
        zoomInfo: null
      };
      
      this.init();
    }
  
    init() {
      this.createLightbox();
      this.attachEventListeners();
      this.initAutoDetection();
      this.initMermaidIfNeeded();
    }
  
    createLightbox() {
      if (document.getElementById('diagram-lightbox')) return;
  
      const lightbox = document.createElement('div');
      lightbox.id = 'diagram-lightbox';
      lightbox.className = 'diagram-lightbox';
      lightbox.innerHTML = `
        <button class="lightbox-close" aria-label="Закрыть" title="Закрыть (ESC)">×</button>
        <div class="lightbox-content">
          <img class="lightbox-image" src="" alt="" role="dialog" aria-modal="true">
        </div>
        <div class="zoom-controls" role="toolbar" aria-label="Управление масштабом">
          <button class="zoom-btn" id="zoom-out" aria-label="Уменьшить" title="Уменьшить (-)">−</button>
          <button class="zoom-btn" id="zoom-reset" aria-label="Сбросить масштаб" title="100% (0)">⚡</button>
          <button class="zoom-btn" id="zoom-in" aria-label="Увеличить" title="Увеличить (+)">+</button>
        </div>
        <div class="zoom-info" aria-live="polite">
          <span id="zoom-level">100%</span>
        </div>
      `;
      
      document.body.appendChild(lightbox);
      
      this.elements.lightbox = lightbox;
      this.elements.lightboxImage = lightbox.querySelector('.lightbox-image');
      this.elements.zoomInfo = lightbox.querySelector('#zoom-level');
    }
  
    attachEventListeners() {
      // Делегирование событий для производительности
      document.addEventListener('click', this.handleDocumentClick.bind(this));
      document.addEventListener('keydown', this.handleKeyboard.bind(this));
      
      // Lightbox события
      if (this.elements.lightbox) {
        this.elements.lightbox.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
        this.elements.lightbox.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
        this.elements.lightbox.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
      }
    }
  
    handleDocumentClick(e) {
      const target = e.target;
      
      // Клик по зумируемой диаграмме
      const zoomableWrapper = target.closest('[data-zoomable="true"]');
      if (zoomableWrapper && !target.closest('.zoom-controls')) {
        e.preventDefault();
        const img = zoomableWrapper.querySelector('img, svg');
        if (img) {
          this.openLightbox(img);
        }
        return;
      }
  
      // Lightbox контролы
      if (this.state.isLightboxOpen) {
        if (target.classList.contains('lightbox-close') || 
            target.classList.contains('diagram-lightbox')) {
          this.closeLightbox();
        } else if (target.id === 'zoom-in') {
          this.zoomIn();
        } else if (target.id === 'zoom-out') {
          this.zoomOut();
        } else if (target.id === 'zoom-reset') {
          this.resetZoom();
        }
      }
    }
  
    handleKeyboard(e) {
      if (!this.state.isLightboxOpen) return;
  
      const actions = {
        'Escape': () => this.closeLightbox(),
        'Equal': () => this.zoomIn(),
        'Minus': () => this.zoomOut(),
        'Digit0': () => this.resetZoom(),
        'Space': (e) => { e.preventDefault(); this.resetZoom(); }
      };
  
      const action = actions[e.code];
      if (action) {
        e.preventDefault();
        action(e);
      }
    }
  
    handleWheel(e) {
      if (!this.state.isLightboxOpen) return;
      
      e.preventDefault();
      const delta = e.deltaY * this.config.wheelZoomSensitivity;
      const newZoom = Math.max(this.config.minZoom, 
                              Math.min(this.config.maxZoom, 
                                     this.state.currentZoom - delta));
      
      this.setZoom(newZoom);
    }
  
    handleTouchStart(e) {
      if (e.touches.length === 2) {
        this.state.touchStartDistance = this.getTouchDistance(e.touches[0], e.touches[1]);
        this.state.touchStartZoom = this.state.currentZoom;
      }
    }
  
    handleTouchMove(e) {
      if (e.touches.length === 2 && this.state.touchStartDistance) {
        e.preventDefault();
        const currentDistance = this.getTouchDistance(e.touches[0], e.touches[1]);
        const scale = currentDistance / this.state.touchStartDistance;
        const newZoom = this.state.touchStartZoom * scale;
        
        this.setZoom(Math.max(this.config.minZoom, 
                             Math.min(this.config.maxZoom, newZoom)));
      }
    }
  
    getTouchDistance(touch1, touch2) {
      const dx = touch1.clientX - touch2.clientX;
      const dy = touch1.clientY - touch2.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }
  
    openLightbox(element) {
      const lightboxImage = this.elements.lightboxImage;
      
      if (element.tagName === 'IMG') {
        lightboxImage.src = element.src || element.dataset.zoomSrc;
        lightboxImage.alt = element.alt;
      } else if (element.tagName.toLowerCase() === 'svg') {
        try {
          const svgData = new XMLSerializer().serializeToString(element);
          const svgBlob = new Blob([svgData], {type: 'image/svg+xml;charset=utf-8'});
          const svgUrl = URL.createObjectURL(svgBlob);
          lightboxImage.src = svgUrl;
          lightboxImage.dataset.blobUrl = svgUrl;
        } catch (error) {
          console.warn('SVG serialization failed:', error);
          return;
        }
      }
  
      this.state.activeElement = lightboxImage;
      this.elements.lightbox.style.display = 'block';
      document.body.style.overflow = 'hidden';
      document.body.setAttribute('aria-hidden', 'true');
      this.state.isLightboxOpen = true;
      this.resetZoom();
      
      this.elements.lightbox.focus();
      this.elements.lightbox.setAttribute('aria-hidden', 'false');
    }
  
    closeLightbox() {
      if (!this.state.isLightboxOpen) return;
      
      this.elements.lightbox.style.display = 'none';
      document.body.style.overflow = 'auto';
      document.body.removeAttribute('aria-hidden');
      this.state.isLightboxOpen = false;
      this.state.currentZoom = 1;
      
      const img = this.elements.lightboxImage;
      if (img.dataset.blobUrl) {
        URL.revokeObjectURL(img.dataset.blobUrl);
        delete img.dataset.blobUrl;
      }
      
      this.state.activeElement = null;
    }
  
    zoomIn() {
      const newZoom = Math.min(this.config.maxZoom, 
                              this.state.currentZoom + this.config.zoomStep);
      this.setZoom(newZoom);
    }
  
    zoomOut() {
      const newZoom = Math.max(this.config.minZoom, 
                              this.state.currentZoom - this.config.zoomStep);
      this.setZoom(newZoom);
    }
  
    resetZoom() {
      this.setZoom(1);
    }
  
    setZoom(zoom) {
      this.state.currentZoom = zoom;
      if (this.state.activeElement) {
        this.state.activeElement.style.transform = `scale(${zoom})`;
        this.elements.zoomInfo.textContent = `${Math.round(zoom * 100)}%`;
      }
    }
  
    initMermaidIfNeeded() {
      if (typeof mermaid !== 'undefined' && document.querySelector('.mermaid')) {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark' ||
                      window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        mermaid.initialize({
          startOnLoad: true,
          theme: isDark ? 'dark' : 'default',
          themeVariables: {
            primaryColor: '#4fc3f7',
            primaryTextColor: isDark ? '#e0e0e0' : '#333',
            primaryBorderColor: '#4fc3f7',
            lineColor: isDark ? '#666' : '#333'
          },
          securityLevel: 'loose',
          fontSize: 14,
          fontFamily: 'system-ui, -apple-system, sans-serif'
        });
  
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
          this.updateMermaidTheme(e.matches);
        });
      }
    }
  
    updateMermaidTheme(isDark) {
      if (typeof mermaid !== 'undefined') {
        mermaid.initialize({
          theme: isDark ? 'dark' : 'default'
        });
        
        document.querySelectorAll('.mermaid[data-processed="true"]').forEach(el => {
          el.removeAttribute('data-processed');
          const originalContent = el.dataset.originalContent || el.innerHTML;
          el.innerHTML = originalContent;
          mermaid.init(undefined, el);
        });
      }
    }
  
    initAutoDetection() {
      const autoSelectors = [
        'img[src*="architecture"]',
        'img[src*="diagram"]', 
        'img[src*="schema"]',
        'img[src*="flowchart"]',
        'img[alt*="диаграмм"]',
        'img[alt*="схем"]',
        'img[alt*="архитектур"]'
      ];
  
      autoSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(img => {
          if (!img.closest('[data-zoomable]')) {
            this.makeZoomable(img);
          }
        });
      });
    }
  
    makeZoomable(img) {
      const wrapper = document.createElement('div');
      wrapper.className = 'diagram-wrapper zoomable-wrapper';
      wrapper.setAttribute('data-zoomable', 'true');
      
      img.parentNode.insertBefore(wrapper, img);
      wrapper.appendChild(img);
      
      const indicator = document.createElement('div');
      indicator.className = 'zoom-indicator';
      indicator.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
        </svg>
        <span>Увеличить</span>
      `;
      wrapper.appendChild(indicator);
    }
  
    destroy() {
      if (this.elements.lightbox) {
        this.elements.lightbox.remove();
      }
      
      document.removeEventListener('click', this.handleDocumentClick);
      document.removeEventListener('keydown', this.handleKeyboard);
    }
  }
  
  // Глобальная инициализация
  let diagramSystemInstance = null;
  
  function initDiagramSystem() {
    if (!diagramSystemInstance && document.readyState !== 'loading') {
      diagramSystemInstance = new DiagramSystem();
      
      if (typeof window !== 'undefined') {
        window.DiagramSystem = diagramSystemInstance;
      }
    }
  }
  
  // Инициализация
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDiagramSystem);
  } else {
    initDiagramSystem();
  }