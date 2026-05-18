/* docker-sort.js — Drag-and-drop quiz engine for Docker Levels */
(function () {
  'use strict';

  class DockerSort {
    constructor(el) {
      this.root = el;
      this.list = el.querySelector('.docker-sort__list');
      this.items = Array.from(this.list.children);
      this.answer = JSON.parse(atob(el.dataset.answer));
      this.explainEl = el.querySelector('.docker-sort__explain');
      this.resultEl = el.querySelector('.docker-sort__result');
      this.checkBtn = el.querySelector('.docker-sort__btn--check');
      this.resetBtn = el.querySelector('.docker-sort__btn--reset');

      this.dragged = null;
      this.ghost = null;
      this.shuffledOrder = this.items.map(function (_, i) { return i; });

      this._bindMouse();
      this._bindTouch();
      this._bindButtons();
    }

    /* ---- Mouse: HTML5 Drag API ---- */
    _bindMouse() {
      var self = this;

      this.list.addEventListener('dragstart', function (e) {
        var item = e.target.closest('.docker-sort__item');
        if (!item) return;
        self.dragged = item;
        item.classList.add('is-dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', '');
      });

      this.list.addEventListener('dragover', function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        var target = e.target.closest('.docker-sort__item');
        if (!target || target === self.dragged) return;
        self._clearInsertMarkers();
        var rect = target.getBoundingClientRect();
        var mid = rect.top + rect.height / 2;
        if (e.clientY < mid) {
          target.classList.add('insert-above');
        } else {
          target.classList.add('insert-below');
        }
      });

      this.list.addEventListener('dragleave', function (e) {
        var target = e.target.closest('.docker-sort__item');
        if (target) {
          target.classList.remove('insert-above', 'insert-below');
        }
      });

      this.list.addEventListener('drop', function (e) {
        e.preventDefault();
        var target = e.target.closest('.docker-sort__item');
        if (!target || !self.dragged || target === self.dragged) return;
        var above = target.classList.contains('insert-above');
        self._clearInsertMarkers();
        if (above) {
          self.list.insertBefore(self.dragged, target);
        } else {
          self.list.insertBefore(self.dragged, target.nextSibling);
        }
      });

      this.list.addEventListener('dragend', function () {
        if (self.dragged) {
          self.dragged.classList.remove('is-dragging');
          self.dragged = null;
        }
        self._clearInsertMarkers();
      });

      this.items.forEach(function (item) {
        item.setAttribute('draggable', 'true');
      });
    }

    /* ---- Touch: manual drag ---- */
    _bindTouch() {
      var self = this;

      this.list.addEventListener('touchstart', function (e) {
        var item = e.target.closest('.docker-sort__item');
        if (!item) return;
        self.dragged = item;
        item.classList.add('is-dragging');

        // Create ghost
        self.ghost = item.cloneNode(true);
        self.ghost.classList.remove('is-dragging');
        self.ghost.classList.add('docker-sort__ghost');
        var rect = item.getBoundingClientRect();
        self.ghost.style.width = rect.width + 'px';
        self.ghost.style.left = rect.left + 'px';
        self.ghost.style.top = rect.top + 'px';
        document.body.appendChild(self.ghost);

        self.list.style.touchAction = 'none';
      }, { passive: true });

      this.list.addEventListener('touchmove', function (e) {
        if (!self.dragged || !self.ghost) return;
        e.preventDefault();

        var touch = e.touches[0];
        self.ghost.style.left = (touch.clientX - self.ghost.offsetWidth / 2) + 'px';
        self.ghost.style.top = (touch.clientY - 20) + 'px';

        self._clearInsertMarkers();
        var target = self._itemFromPoint(touch.clientX, touch.clientY);
        if (target && target !== self.dragged) {
          var rect = target.getBoundingClientRect();
          var mid = rect.top + rect.height / 2;
          if (touch.clientY < mid) {
            target.classList.add('insert-above');
          } else {
            target.classList.add('insert-below');
          }
        }
      }, { passive: false });

      this.list.addEventListener('touchend', function () {
        if (!self.dragged) return;

        // Find drop target
        var marked = self.list.querySelector('.insert-above, .insert-below');
        if (marked) {
          var above = marked.classList.contains('insert-above');
          if (above) {
            self.list.insertBefore(self.dragged, marked);
          } else {
            self.list.insertBefore(self.dragged, marked.nextSibling);
          }
        }

        self.dragged.classList.remove('is-dragging');
        self.dragged = null;
        self._clearInsertMarkers();
        self.list.style.touchAction = '';

        if (self.ghost) {
          self.ghost.remove();
          self.ghost = null;
        }
      });
    }

    _itemFromPoint(x, y) {
      var items = Array.from(this.list.querySelectorAll('.docker-sort__item'));
      for (var i = 0; i < items.length; i++) {
        var rect = items[i].getBoundingClientRect();
        if (y >= rect.top && y <= rect.bottom && x >= rect.left && x <= rect.right) {
          return items[i];
        }
      }
      return null;
    }

    _clearInsertMarkers() {
      this.list.querySelectorAll('.insert-above, .insert-below').forEach(function (el) {
        el.classList.remove('insert-above', 'insert-below');
      });
    }

    /* ---- Buttons ---- */
    _bindButtons() {
      var self = this;

      this.checkBtn.addEventListener('click', function () {
        self._check();
      });

      this.resetBtn.addEventListener('click', function () {
        self._reset();
      });
    }

    _check() {
      var items = Array.from(this.list.querySelectorAll('.docker-sort__item'));
      var current = items.map(function (el) {
        return el.querySelector('.docker-sort__text').textContent.trim().replace(/\s+/g, ' ');
      });

      var allCorrect = true;
      for (var i = 0; i < items.length; i++) {
        items[i].classList.remove('is-correct', 'is-wrong');
        var expected = (this.answer[i] || '').trim().replace(/\s+/g, ' ');
        if (current[i] === expected) {
          items[i].classList.add('is-correct');
        } else {
          items[i].classList.add('is-wrong');
          allCorrect = false;
        }
      }

      this.resultEl.textContent = allCorrect
        ? 'Правильно!'
        : 'Есть ошибки — попробуйте ещё раз';
      this.resultEl.className = 'docker-sort__result ' +
        (allCorrect ? 'docker-sort__result--success' : 'docker-sort__result--fail');

      if (allCorrect && this.explainEl) {
        this.explainEl.classList.add('is-visible');
      } else if (this.explainEl) {
        this.explainEl.classList.remove('is-visible');
      }
    }

    _reset() {
      // Clear validation
      this.list.querySelectorAll('.docker-sort__item').forEach(function (el) {
        el.classList.remove('is-correct', 'is-wrong');
      });
      this.resultEl.textContent = '';
      this.resultEl.className = 'docker-sort__result';
      if (this.explainEl) {
        this.explainEl.classList.remove('is-visible');
      }

      // Shuffle: detach, Fisher-Yates, re-append
      var items = Array.from(this.list.children);
      for (var i = items.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = items[i];
        items[i] = items[j];
        items[j] = tmp;
      }
      items.forEach(function (el) { this.list.appendChild(el); }.bind(this));
    }
  }

  /* ---- Init ---- */
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.docker-sort').forEach(function (el) {
      new DockerSort(el);
    });
  });
})();
