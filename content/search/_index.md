---
title: "🔍 Поиск по сайту"
# layout: "search"  # ← Удалите или закомментируйте эту строку
placeholder: "Поиск по гайдам DevOps..."
description: "Поиск по всем постам и практическим гайдам DevOps Way"
summary: "Быстрый поиск по базе знаний DevOps гайдов"
showToc: false
searchHidden: false
robotsNoIndex: false
sitemap_priority: 0.8
draft: false  # ← Добавьте эту строку
---

# 🔍 Поиск по базе знаний DevOps Way

Найдите нужную информацию среди всех практических гайдов по DevOps, автоматизации, CI/CD и управлению инфраструктурой.

## 💡 Советы по поиску:

- **Используйте ключевые слова:** `docker`, `kubernetes`, `git`, `ssh`
- **Ищите по проблемам:** `permission denied`, `connection refused`
- **Комбинируйте термины:** `docker compose nginx`
- **Ищите команды:** `kubectl get pods`, `git push`

## 📚 Популярные темы:

- [DevOps Essentials](/categories/devops-essentials/) - основы для начинающих
- [Git и SSH](/posts/day-00-git-basics/) - настройка и troubleshooting

<div id="searchbox">
  <input id="searchInput" autofocus placeholder="Поиск по гайдам DevOps..." aria-label="search" type="search" autocomplete="off" style="width: 100%; padding: 1rem; border: 2px solid var(--border); border-radius: 8px; font-size: 1.1rem; background: var(--theme); color: var(--content);">
  <div id="searchResults" style="margin-top: 2rem;"></div>
</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/fuse.js/6.6.2/fuse.min.js"></script>
<script>
document.addEventListener('DOMContentLoaded', function() {
  let fuse;
  let searchIndex;
  
  // Загружаем индекс поиска
  fetch('/devopsway-blog/index.json')
    .then(response => response.json())
    .then(data => {
      searchIndex = data;
      fuse = new Fuse(data, {
        keys: ['title', 'content', 'summary', 'tags'],
        includeScore: true,
        threshold: 0.3,
        minMatchCharLength: 2
      });
    })
    .catch(err => {
      console.log('Ошибка загрузки индекса поиска:', err);
      document.getElementById('searchResults').innerHTML = '<p>Поиск временно недоступен</p>';
    });

  const searchInput = document.getElementById('searchInput');
  const searchResults = document.getElementById('searchResults');

  searchInput.addEventListener('input', function() {
    const query = this.value.trim();
    
    if (query.length < 2) {
      searchResults.innerHTML = '';
      return;
    }

    if (!fuse) {
      searchResults.innerHTML = '<p>⏳ Загрузка индекса поиска...</p>';
      return;
    }

    const results = fuse.search(query);
    
    if (results.length === 0) {
      searchResults.innerHTML = '<p>🔍 Ничего не найдено по запросу "<strong>' + query + '</strong>"</p><p>💡 Попробуйте другие ключевые слова или воспользуйтесь категориями выше.</p>';
      return;
    }

    let resultsHTML = '<h3>📋 Найдено результатов: ' + results.length + '</h3><div class="search-results-list">';
    
    results.slice(0, 10).forEach((result, index) => {
      const item = result.item;
      const score = Math.round((1 - result.score) * 100);
      resultsHTML += `
        <article class="search-result-item" style="padding: 1.5rem; border: 1px solid var(--border); border-radius: 8px; margin-bottom: 1rem; background: var(--theme);">
          <h4 style="margin: 0 0 0.5rem 0;"><a href="${item.permalink}" style="color: var(--primary); text-decoration: none;">${item.title}</a></h4>
          <p style="margin: 0.5rem 0; color: var(--secondary);">${item.summary || (item.content ? item.content.substring(0, 200) + '...' : 'Нет описания')}</p>
          <div class="search-meta" style="margin-top: 0.5rem; font-size: 0.9rem; color: var(--tertiary);">
            <span>🎯 Релевантность: ${score}%</span>
            ${item.tags && item.tags.length > 0 ? ' | 🏷️ ' + item.tags.slice(0, 3).map(tag => `<span style="background: var(--code-bg); color: var(--content); padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.8rem; margin-right: 0.5rem;">${tag}</span>`).join('') : ''}
          </div>
        </article>
      `;
    });
    
    resultsHTML += '</div>';
    
    if (results.length > 10) {
      resultsHTML += '<p style="text-align: center; margin-top: 1rem; color: var(--secondary);">📄 Показано 10 из ' + results.length + ' результатов</p>';
    }
    
    searchResults.innerHTML = resultsHTML;
  });

  // Добавляем обработчик Enter
  searchInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const firstResult = document.querySelector('.search-result-item a');
      if (firstResult) {
        firstResult.click();
      }
    }
  });
});
</script>

---

*Не нашли нужную информацию? Напишите в [Telegram](https://t.me/devitway) - добавим в план новых статей!*