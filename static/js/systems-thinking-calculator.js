/**
 * Диагностика системного мышления - DevOps Way (РУСИФИЦИРОВАННАЯ ВЕРСИЯ)
 * Файл: static/js/systems-thinking-calculator.js
 */

document.addEventListener('DOMContentLoaded', function() {
    initSystemsThinkingAssessment();
});

function initSystemsThinkingAssessment() {
    const widget = document.getElementById('systems-thinking-widget');
    if (!widget) return;

    // HTML содержимое диагностики системного мышления
    widget.innerHTML = `
        <div class="assessment-note" style="background-color: #e6f4ff; padding: 12px 16px; border-radius: 8px; margin-bottom: 16px;">
            <p style="color: #1a1a1a; margin: 0;"> 📌 <strong>Примечание:</strong> Технологии, упомянутые в примерах (например: Terraform, Prometheus, Kubernetes), приведены для ориентира. 
        Если вы выполняете аналогичные задачи с другими инструментами — смело отмечайте соответствующий пункт.
            </p>
        </div>

        <div class="assessment-sections">
            <!-- T-SHAPED FOUNDATION -->
            <div class="section-container">
                <div class="section-header foundation-header">
                    🎯 T-shaped основа: Техническая широта + глубина
                </div>
                
                <div class="skills-group">
                    <h4>🛠️ Техническая экспертиза (вертикаль "T"):</h4>
                    
                    <div class="assessment-item" data-category="foundation" data-skill="deep_expertise">
                        <input type="checkbox" class="assessment-checkbox">
                        <div class="skill-content">
                            <div class="skill-title">Глубоко владею основной технической областью (5+ лет опыта)</div>
                            <div class="skill-example">Например: могу решать сложные архитектурные задачи, наставлять коллег, принимать технические решения</div>
                        </div>
                    </div>
                    
                    <div class="assessment-item" data-category="foundation" data-skill="infrastructure">
                        <input type="checkbox" class="assessment-checkbox">
                        <div class="skill-content">
                            <div class="skill-title">Понимаю и работаю с инфраструктурой (облака, контейнеры, CI/CD)</div>
                            <div class="skill-example">Умею настраивать инфраструктуру и процессы доставки (например: Kubernetes, CI/CD, инфраструктура как код с помощью Terraform, Pulumi или других инструментов)</div>
                        </div>
                    </div>
                    
                    <div class="assessment-item" data-category="foundation" data-skill="development">
                        <input type="checkbox" class="assessment-checkbox">
                        <div class="skill-content">
                            <div class="skill-title">Понимаю основы разработки, умею читать и писать код</div>
                            <div class="skill-example">Python/Go для автоматизации, понимаю архитектуру приложений, могу дебажить проблемы</div>
                        </div>
                    </div>
                    
                    <div class="assessment-item" data-category="foundation" data-skill="observability">
                        <input type="checkbox" class="assessment-checkbox">
                        <div class="skill-content">
                            <div class="skill-title">Понимаю мониторинг, логирование и наблюдаемость</div>
                            <div class="skill-example">Настраиваю мониторинг и оповещения с использованием доступных инструментов (например: Prometheus, Grafana, ELK, Datadog и др.), умею визуализировать метрики</div>
                        </div>
                    </div>
                </div>

                <div class="skills-group">
                    <h4>🌐 Кросс-функциональность (горизонталь "T"):</h4>
                    
                    <div class="assessment-item" data-category="foundation" data-skill="cross_teams">
                        <input type="checkbox" class="assessment-checkbox">
                        <div class="skill-content">
                            <div class="skill-title">Эффективно работаю с командами разработки, QA, безопасности</div>
                            <div class="skill-example">Говорю на языке каждой команды, понимаю их проблемы и приоритеты</div>
                        </div>
                    </div>
                    
                    <div class="assessment-item" data-category="foundation" data-skill="business_context">
                        <input type="checkbox" class="assessment-checkbox">
                        <div class="skill-content">
                            <div class="skill-title">Понимаю бизнес-контекст технических решений</div>
                            <div class="skill-example">Связываю техническую работу с бизнес-метриками, понимаю влияние на стоимость решений</div>
                        </div>
                    </div>
                    
                    <div class="assessment-item" data-category="foundation" data-skill="communication">
                        <input type="checkbox" class="assessment-checkbox">
                        <div class="skill-content">
                            <div class="skill-title">Могу объяснить сложные технические концепции простым языком</div>
                            <div class="skill-example">Презентую архитектурные решения менеджменту, обучаю коллег новым технологиям</div>
                        </div>
                    </div>
                    
                    <div class="assessment-item" data-category="foundation" data-skill="decision_making">
                        <input type="checkbox" class="assessment-checkbox">
                        <div class="skill-content">
                            <div class="skill-title">Участвую в принятии решений вне своей прямой зоны ответственности</div>
                            <div class="skill-example">Влияю на дорожную карту продукта, процессы разработки, технические стандарты команды</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- SYSTEMS THINKING -->
            <div class="section-container">
                <div class="section-header systems-header">
                    🧠 Системное мышление: Видение связей и последствий
                </div>
                
                <div class="skills-group">
                    <h4>🔗 Системное понимание:</h4>
                    
                    <div class="assessment-item" data-category="systems" data-skill="root_cause">
                        <input type="checkbox" class="assessment-checkbox">
                        <div class="skill-content">
                            <div class="skill-title">Анализирую первопричины, а не только симптомы проблем</div>
                            <div class="skill-example">При инциденте ищу системные причины: "Почему система позволила этому случиться?"</div>
                        </div>
                    </div>
                    
                    <div class="assessment-item" data-category="systems" data-skill="cascade_effects">
                        <input type="checkbox" class="assessment-checkbox">
                        <div class="skill-content">
                            <div class="skill-title">Предсказываю каскадные эффекты технических изменений</div>
                            <div class="skill-example">Понимаю, как изменение в CI/CD повлияет на безопасность, производительность, опыт разработчиков</div>
                        </div>
                    </div>
                    
                    <div class="assessment-item" data-category="systems" data-skill="tradeoffs">
                        <input type="checkbox" class="assessment-checkbox">
                        <div class="skill-content">
                            <div class="skill-title">Мыслю в терминах компромиссов</div>
                            <div class="skill-example">"Если ускорим развертывание, что потеряем в стабильности? Какой риск приемлем для бизнеса?"</div>
                        </div>
                    </div>
                    
                    <div class="assessment-item" data-category="systems" data-skill="longterm">
                        <input type="checkbox" class="assessment-checkbox">
                        <div class="skill-content">
                            <div class="skill-title">Проектирую решения с учетом долгосрочных последствий</div>
                            <div class="skill-example">Думаю на 6-12 месяцев вперед: "Как это решение будет масштабироваться? Что сломается?"</div>
                        </div>
                    </div>
                </div>

                <div class="skills-group">
                    <h4>⚖️ Архитектурное мышление:</h4>
                    
                    <div class="assessment-item" data-category="systems" data-skill="business_decisions">
                        <input type="checkbox" class="assessment-checkbox">
                        <div class="skill-content">
                            <div class="skill-title">Принимаю технические решения на основе бизнес-контекста</div>
                            <div class="skill-example">Выбираю между производительностью и экономической эффективностью исходя из приоритетов бизнеса</div>
                        </div>
                    </div>
                    
                    <div class="assessment-item" data-category="systems" data-skill="failure_modeling">
                        <input type="checkbox" class="assessment-checkbox">
                        <div class="skill-content">
                            <div class="skill-title">Моделирую сценарии отказов и проектирую отказоустойчивость</div>
                            <div class="skill-example">Chaos engineering, планирование аварийного восстановления, "что если упадет зона доступности?"</div>
                        </div>
                    </div>
                    
                    <div class="assessment-item" data-category="systems" data-skill="holistic">
                        <input type="checkbox" class="assessment-checkbox">
                        <div class="skill-content">
                            <div class="skill-title">Оптимизирую системы как единое целое, а не отдельные компоненты</div>
                            <div class="skill-example">Понимаю узкие места в сквозном потоке: от коммита до продакшена</div>
                        </div>
                    </div>
                    
                    <div class="assessment-item" data-category="systems" data-skill="feedback_loops">
                        <input type="checkbox" class="assessment-checkbox">
                        <div class="skill-content">
                            <div class="skill-title">Создаю петли обратной связи для непрерывного улучшения</div>
                            <div class="skill-example">Метрики → выводы → действия → оценка результата → новые метрики</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- LEADERSHIP & INFLUENCE -->
            <div class="section-container">
                <div class="section-header leadership-header">
                    🚀 Лидерство и влияние: Воздействие на организацию
                </div>
                
                <div class="skills-group">
                    <h4>👥 Влияние на команду:</h4>
                    
                    <div class="assessment-item" data-category="leadership" data-skill="process_creation">
                        <input type="checkbox" class="assessment-checkbox">
                        <div class="skill-content">
                            <div class="skill-title">Внедрил процесс/практику, которая используется командой</div>
                            <div class="skill-example">Внедрил инженерные практики, такие как процесс разбора инцидентов, стандарты code review или GitOps — с адаптацией под нужды команды</div>
                        </div>
                    </div>
                    
                    <div class="assessment-item" data-category="leadership" data-skill="teaching">
                        <input type="checkbox" class="assessment-checkbox">
                        <div class="skill-content">
                            <div class="skill-title">Обучаю коллег системному подходу: не просто «как исправить», а «как не допустить повторения»</div>
                            <div class="skill-example">Показываю системный анализ проблем и методы предотвращения</div>
                        </div>
                    </div>
                    
                    <div class="assessment-item" data-category="leadership" data-skill="culture">
                        <input type="checkbox" class="assessment-checkbox">
                        <div class="skill-content">
                            <div class="skill-title">Формирую техническую культуру и стандарты</div>
                            <div class="skill-example">Инфраструктура как код, практики безопасности, стандарты мониторинга</div>
                        </div>
                    </div>
                    
                    <div class="assessment-item" data-category="leadership" data-skill="strategic_input">
                        <input type="checkbox" class="assessment-checkbox">
                        <div class="skill-content">
                            <div class="skill-title">Выступаю техническим экспертом при принятии стратегических решений</div>
                            <div class="skill-example">Консультирую по выбору технологий, стратегиям миграции, архитектурным решениям</div>
                        </div>
                    </div>
                </div>

                <div class="skills-group">
                    <h4>🌍 Системное воздействие:</h4>
                    
                    <div class="assessment-item" data-category="leadership" data-skill="reusable_solutions">
                        <input type="checkbox" class="assessment-checkbox">
                        <div class="skill-content">
                            <div class="skill-title">Создал решение, которое переиспользуется другими командами</div>
                            <div class="skill-example">Разработал переиспользуемые инфраструктурные компоненты (например: модули IaC, шаблоны CI/CD, платформенные SDK или библиотеки), применимые в разных командах</div>
                        </div>
                    </div>
                    
                    <div class="assessment-item" data-category="leadership" data-skill="tech_strategy">
                        <input type="checkbox" class="assessment-checkbox">
                        <div class="skill-content">
                            <div class="skill-title">Влияю на техническую стратегию продукта/организации</div>
                            <div class="skill-example">Участвую в планировании облачной миграции, развитии платформы, приоритизации технического долга</div>
                        </div>
                    </div>
                    
                    <div class="assessment-item" data-category="leadership" data-skill="collaboration">
                        <input type="checkbox" class="assessment-checkbox">
                        <div class="skill-content">
                            <div class="skill-title">Выстраиваю межкомандное сотрудничество и обмен знаниями</div>
                            <div class="skill-example">DevOps гильдии, технические доклады, культура документации, сообщества практиков</div>
                        </div>
                    </div>
                    
                    <div class="assessment-item" data-category="leadership" data-skill="external_representation">
                        <input type="checkbox" class="assessment-checkbox">
                        <div class="skill-content">
                            <div class="skill-title">Представляю экспертизу компании во внешних сообществах</div>
                            <div class="skill-example">Конференции, вклад в open source, технические блоги, партнерства в индустрии</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- РЕЗУЛЬТАТЫ -->
        <div class="results-section">
            <h3>📊 Ваши результаты диагностики</h3>
            
            <div class="results-grid">
                <div class="result-category">
                    <div class="category-header">
                        <div class="category-title">🎯 T-shaped основа</div>
                        <div class="category-score" id="score-foundation">0/8</div>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill progress-foundation" id="progress-foundation"></div>
                    </div>
                    <div class="result-text" id="result-foundation">Начните оценку для получения результата</div>
                </div>

                <div class="result-category">
                    <div class="category-header">
                        <div class="category-title">🧠 Системное мышление</div>
                        <div class="category-score" id="score-systems">0/8</div>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill progress-systems" id="progress-systems"></div>
                    </div>
                    <div class="result-text" id="result-systems">Начните оценку для получения результата</div>
                </div>

                <div class="result-category">
                    <div class="category-header">
                        <div class="category-title">🚀 Лидерство и влияние</div>
                        <div class="category-score" id="score-leadership">0/8</div>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill progress-leadership" id="progress-leadership"></div>
                    </div>
                    <div class="result-text" id="result-leadership">Начните оценку для получения результата</div>
                </div>
            </div>

            <div class="overall-result" id="overall-result">
                Пройдите оценку для получения персонального анализа
            </div>

            <div class="recommendations" id="recommendations" style="display: none;">
                <h4>🎯 Персональные рекомендации:</h4>
                <div class="recommendations-content"></div>
            </div>

            <div class="action-buttons">
                <button onclick="resetAssessment()" class="reset-btn">🔄 Начать заново</button>
                <button onclick="shareResults()" class="share-btn">📤 Поделиться результатами</button>
                <button onclick="requestConsultation()" class="consultation-btn">💬 Получить экспертную консультацию</button>
            </div>
        </div>
    `;

    // Инициализация переменных
    window.systemsScores = {
        foundation: 0,
        systems: 0,
        leadership: 0
    };

    setupAssessmentEventListeners();
}

function setupAssessmentEventListeners() {
    // Обработчики для чекбоксов
    document.querySelectorAll('.assessment-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const assessmentItem = this.closest('.assessment-item');
            const category = assessmentItem.getAttribute('data-category');
            
            if (this.checked) {
                assessmentItem.classList.add('checked');
                window.systemsScores[category]++;
            } else {
                assessmentItem.classList.remove('checked');
                window.systemsScores[category]--;
            }
            
            updateResults();
            
            // Визуальный эффект
            assessmentItem.style.transform = 'scale(1.02)';
            setTimeout(() => {
                assessmentItem.style.transform = '';
            }, 150);
        });
    });

    // Обработчик клика по всему элементу
    document.querySelectorAll('.assessment-item').forEach(item => {
        item.addEventListener('click', function(event) {
            if (event.target.classList.contains('assessment-checkbox')) {
                return;
            }
            
            const checkbox = this.querySelector('.assessment-checkbox');
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new Event('change'));
        });
    });
}

function updateResults() {
    updateCategory('foundation', window.systemsScores.foundation, 8);
    updateCategory('systems', window.systemsScores.systems, 8);
    updateCategory('leadership', window.systemsScores.leadership, 8);
    updateOverallResult();
}

function updateCategory(category, score, total) {
    const scoreElement = document.getElementById(`score-${category}`);
    const progressElement = document.getElementById(`progress-${category}`);
    const resultElement = document.getElementById(`result-${category}`);
    
    const percentage = (score / total) * 100;
    scoreElement.textContent = `${score}/${total}`;
    progressElement.style.width = percentage + '%';
    
    let message, className;
    
    if (score >= 7) {
        message = '🔥 Отличный уровень! Вы мастер в этой области';
        className = 'result-excellent';
    } else if (score >= 5) {
        message = '👍 Хороший уровень, есть пространство для роста';
        className = 'result-good';
    } else if (score >= 3) {
        message = '📈 Развивающийся уровень, сосредоточьтесь на этой области';
        className = 'result-developing';
    } else {
        message = '🎯 Базовый уровень, требует значительного развития';
        className = 'result-beginner';
    }
    
    resultElement.textContent = message;
    resultElement.className = `result-text ${className}`;
}

function updateOverallResult() {
    const totalScore = window.systemsScores.foundation + window.systemsScores.systems + window.systemsScores.leadership;
    const overallElement = document.getElementById('overall-result');
    const recommendationsElement = document.getElementById('recommendations');
    const recommendationsContent = document.querySelector('.recommendations-content');
    
    let resultClass, resultText;
    let recommendations = [];
    
    if (totalScore >= 20) {
        resultClass = 'result-master';
        resultText = '🏆 Мастер системного мышления (20+/24) - Вы готовы к роли архитектора или тех. лидера!';
        recommendations = [
            'Развивайте экспертизу в новых технологиях (AI/ML Ops, Platform Engineering)',
            'Сосредоточьтесь на стратегическом планировании и влиянии на организацию',
            'Рассмотрите возможность менторства и обмена знаниями в индустрии',
            'Станьте техническим евангелистом и лидером мнений'
        ];
    } else if (totalScore >= 15) {
        resultClass = 'result-advanced';
        resultText = '🚀 Системный эксперт (15-19/24) - Сильный Senior с лидерским потенциалом';
        recommendations = [
            'Укрепляйте слабые области из трех категорий',
            'Развивайте навыки влияния и системного воздействия на организацию',
            'Практикуйте архитектурное мышление на сложных проектах',
            'Начинайте выстраивать техническое лидерство в команде'
        ];
    } else if (totalScore >= 10) {
        resultClass = 'result-developing';
        resultText = '📈 Системный практик (10-14/24) - Крепкий Mid+ с потенциалом роста';
        recommendations = [
            'Фокусируйтесь на развитии системного мышления и архитектурного видения',
            'Практикуйте анализ компромиссов и долгосрочных последствий решений',
            'Изучайте архитектурные паттерны и лучшие практики индустрии',
            'Развивайте навыки кросс-функционального взаимодействия'
        ];
    } else {
        resultClass = 'result-foundational';
        resultText = '🎯 Базовый уровень (0-9/24) - Укрепляйте T-shaped основу';
        recommendations = [
            'Сосредоточьтесь на укреплении технических основ DevOps',
            'Изучайте основы инфраструктуры: облака, контейнеры, CI/CD',
            'Развивайте навыки коммуникации с разными командами',
            'Начните практиковать системный анализ проблем'
        ];
    }
    
    overallElement.textContent = resultText;
    overallElement.className = `overall-result ${resultClass}`;
    
    if (recommendations.length > 0) {
        const html = recommendations.map(rec => `<div class="recommendation-item">• ${rec}</div>`).join('');
        recommendationsContent.innerHTML = html;
        recommendationsElement.style.display = 'block';
    }
}

// Глобальные функции
window.resetAssessment = function() {
    window.systemsScores = { foundation: 0, systems: 0, leadership: 0 };
    
    document.querySelectorAll('.assessment-checkbox').forEach(checkbox => {
        checkbox.checked = false;
    });
    
    document.querySelectorAll('.assessment-item').forEach(item => {
        item.classList.remove('checked');
    });
    
    updateResults();
    document.getElementById('recommendations').style.display = 'none';
};

window.shareResults = function() {
    const foundation = window.systemsScores.foundation;
    const systems = window.systemsScores.systems;
    const leadership = window.systemsScores.leadership;
    const total = foundation + systems + leadership;
    
    const shareText = `Мои результаты диагностики системного мышления:

🎯 T-shaped основа: ${foundation}/8
🧠 Системное мышление: ${systems}/8  
🚀 Лидерство и влияние: ${leadership}/8
📊 Общий результат: ${total}/24

Пройдите диагностику системного мышления: ${window.location.href}`;
    
    if (navigator.share) {
        navigator.share({
            title: 'Диагностика системного мышления - DevOps Way',
            text: shareText,
            url: window.location.href
        });
    } else {
        navigator.clipboard.writeText(shareText).then(() => {
            showNotification('📋 Результаты скопированы в буфер обмена!');
        });
    }
};

// Telegram шаринг
window.shareToTelegram = function() {
    const foundation = window.systemsScores.foundation;
    const systems = window.systemsScores.systems;
    const leadership = window.systemsScores.leadership;
    const total = foundation + systems + leadership;
    
    const shareText = `Прошел диагностику системного мышления на DevOps Way!

🎯 T-shaped основа: ${foundation}/8
🧠 Системное мышление: ${systems}/8
🚀 Лидерство и влияние: ${leadership}/8

Проверьте свой уровень:`;
    
    const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(shareText)}`;
    window.open(telegramUrl, '_blank');
};

// Уведомления
function showNotification(message) {
    // Удаляем существующие уведомления
    const existingNotifications = document.querySelectorAll('.notification-toast');
    existingNotifications.forEach(notification => notification.remove());
    
    const notification = document.createElement('div');
    notification.className = 'notification-toast';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 10000;
        background: #10b981; color: white; padding: 12px 16px;
        border-radius: 8px; font-weight: 500; font-size: 0.9rem;
        transform: translateX(100%); transition: transform 0.3s ease;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    document.body.appendChild(notification);
    setTimeout(() => notification.style.transform = 'translateX(0)', 100);
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

window.requestConsultation = function() {
    const foundation = window.systemsScores.foundation;
    const systems = window.systemsScores.systems;
    const leadership = window.systemsScores.leadership;
    const total = foundation + systems + leadership;
    
    const consultationText = `Здравствуйте! Прошел диагностику системного мышления на DevOps Way.

Мои результаты:
🎯 T-shaped основа: ${foundation}/8
🧠 Системное мышление: ${systems}/8
🚀 Лидерство и влияние: ${leadership}/8

Хотел бы получить экспертную консультацию по развитию системного мышления в DevOps.`;
    
    const telegramUrl = `https://t.me/devitway_pavel?text=${encodeURIComponent(consultationText)}`;
    window.open(telegramUrl, '_blank');
};