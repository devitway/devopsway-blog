/**
 * Systems Thinking Assessment - DevOps Way
 * Файл: static/js/systems-thinking-calculator.js
 */

document.addEventListener('DOMContentLoaded', function() {
    initSystemsThinkingAssessment();
});

function initSystemsThinkingAssessment() {
    const widget = document.getElementById('systems-thinking-widget');
    if (!widget) return;

    // HTML содержимое Systems Thinking Assessment
    widget.innerHTML = `
        <div class="assessment-intro">
            <h2>🧠 T-shaped Systems Thinking Assessment</h2>
            <p><strong>Честная диагностика</strong> вашего уровня системного мышления в DevOps</p>
            
            <div class="reality-check">
                <h3>🔍 Большинство переоценивают свой T-shaped уровень</h3>
                <p><strong>Исследование показало:</strong> 78% IT-специалистов считают себя T-shaped, но ведут себя как I-shaped в критических ситуациях</p>
                
                <div class="stats-grid">
                    <div class="stat-box">
                        <div class="stat-number">78%</div>
                        <div class="stat-label">переоценивают уровень</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-number">15%</div>
                        <div class="stat-label">обладают системным мышлением</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-number">7%</div>
                        <div class="stat-label">готовы к лидерству</div>
                    </div>
                </div>
                
                <p class="warning"><strong>Отмечайте ✅ только то, в чем уверены на 100%</strong></p>
            </div>
        </div>

        <div class="assessment-sections">
            <!-- T-SHAPED FOUNDATION -->
            <div class="section-container">
                <div class="section-header foundation-header">
                    🎯 T-shaped Foundation: Техническая широта + глубина
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
                            <div class="skill-title">Понимаю и работаю с инфраструктурой (clouds, containers, CI/CD)</div>
                            <div class="skill-example">Могу настроить Kubernetes кластер, создать Terraform модули, построить CI/CD пайплайн</div>
                        </div>
                    </div>
                    
                    <div class="assessment-item" data-category="foundation" data-skill="development">
                        <input type="checkbox" class="assessment-checkbox">
                        <div class="skill-content">
                            <div class="skill-title">Владею основами разработки и могу читать/писать код</div>
                            <div class="skill-example">Python/Go для автоматизации, понимаю архитектуру приложений, могу дебажить проблемы</div>
                        </div>
                    </div>
                    
                    <div class="assessment-item" data-category="foundation" data-skill="observability">
                        <input type="checkbox" class="assessment-checkbox">
                        <div class="skill-content">
                            <div class="skill-title">Понимаю мониторинг, логирование и observability</div>
                            <div class="skill-example">Prometheus/Grafana, ELK stack, могу создать dashboard и настроить алерты</div>
                        </div>
                    </div>
                </div>

                <div class="skills-group">
                    <h4>🌐 Кросс-функциональность (горизонталь "T"):</h4>
                    
                    <div class="assessment-item" data-category="foundation" data-skill="cross_teams">
                        <input type="checkbox" class="assessment-checkbox">
                        <div class="skill-content">
                            <div class="skill-title">Эффективно работаю с командами разработки, QA, security</div>
                            <div class="skill-example">Говорю на языке каждой команды, понимаю их проблемы и приоритеты</div>
                        </div>
                    </div>
                    
                    <div class="assessment-item" data-category="foundation" data-skill="business_context">
                        <input type="checkbox" class="assessment-checkbox">
                        <div class="skill-content">
                            <div class="skill-title">Понимаю бизнес-контекст технических решений</div>
                            <div class="skill-example">Связываю техническую работу с бизнес-метриками, понимаю cost impact решений</div>
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
                            <div class="skill-example">Влияю на product roadmap, процессы разработки, технические стандарты команды</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- SYSTEMS THINKING -->
            <div class="section-container">
                <div class="section-header systems-header">
                    🧠 Systems Thinking: Видение связей и последствий
                </div>
                
                <div class="skills-group">
                    <h4>🔗 Системное понимание:</h4>
                    
                    <div class="assessment-item" data-category="systems" data-skill="root_cause">
                        <input type="checkbox" class="assessment-checkbox">
                        <div class="skill-content">
                            <div class="skill-title">Анализирую root causes, а не только симптомы проблем</div>
                            <div class="skill-example">При инциденте ищу системные причины: "Почему система позволила этому случиться?"</div>
                        </div>
                    </div>
                    
                    <div class="assessment-item" data-category="systems" data-skill="cascade_effects">
                        <input type="checkbox" class="assessment-checkbox">
                        <div class="skill-content">
                            <div class="skill-title">Предсказываю каскадные эффекты технических изменений</div>
                            <div class="skill-example">Понимаю, как изменение в CI/CD повлияет на security, performance, developer experience</div>
                        </div>
                    </div>
                    
                    <div class="assessment-item" data-category="systems" data-skill="tradeoffs">
                        <input type="checkbox" class="assessment-checkbox">
                        <div class="skill-content">
                            <div class="skill-title">Мыслю в терминах trade-offs и компромиссов</div>
                            <div class="skill-example">"Если ускорим deployment, что потеряем в stability? Какой риск приемлем для бизнеса?"</div>
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
                            <div class="skill-example">Выбираю между performance и cost effectiveness исходя из приоритетов бизнеса</div>
                        </div>
                    </div>
                    
                    <div class="assessment-item" data-category="systems" data-skill="failure_modeling">
                        <input type="checkbox" class="assessment-checkbox">
                        <div class="skill-content">
                            <div class="skill-title">Моделирую failure scenarios и проектирую resilience</div>
                            <div class="skill-example">Chaos engineering, disaster recovery planning, "что если упадет availability zone?"</div>
                        </div>
                    </div>
                    
                    <div class="assessment-item" data-category="systems" data-skill="holistic">
                        <input type="checkbox" class="assessment-checkbox">
                        <div class="skill-content">
                            <div class="skill-title">Оптимизирую системы как единое целое, а не отдельные компоненты</div>
                            <div class="skill-example">Понимаю bottlenecks в end-to-end flow: от commit до production</div>
                        </div>
                    </div>
                    
                    <div class="assessment-item" data-category="systems" data-skill="feedback_loops">
                        <input type="checkbox" class="assessment-checkbox">
                        <div class="skill-content">
                            <div class="skill-title">Создаю feedback loops для continuous improvement</div>
                            <div class="skill-example">Метрики → инсайты → действия → измерение результата → новые метрики</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- LEADERSHIP & INFLUENCE -->
            <div class="section-container">
                <div class="section-header leadership-header">
                    🚀 Leadership & Influence: Воздействие на организацию
                </div>
                
                <div class="skills-group">
                    <h4>👥 Влияние на команду:</h4>
                    
                    <div class="assessment-item" data-category="leadership" data-skill="process_creation">
                        <input type="checkbox" class="assessment-checkbox">
                        <div class="skill-content">
                            <div class="skill-title">Внедрил процесс/практику, которая используется командой</div>
                            <div class="skill-example">Создал post-mortem процесс, внедрил code review standards, GitOps workflow</div>
                        </div>
                    </div>
                    
                    <div class="assessment-item" data-category="leadership" data-skill="teaching">
                        <input type="checkbox" class="assessment-checkbox">
                        <div class="skill-content">
                            <div class="skill-title">Обучаю коллег системному подходу к решению проблем</div>
                            <div class="skill-example">Показываю не "как исправить", а "как предотвратить повторение"</div>
                        </div>
                    </div>
                    
                    <div class="assessment-item" data-category="leadership" data-skill="culture">
                        <input type="checkbox" class="assessment-checkbox">
                        <div class="skill-content">
                            <div class="skill-title">Формирую техническую культуру и стандарты</div>
                            <div class="skill-example">Infrastructure as Code, security practices, monitoring standards</div>
                        </div>
                    </div>
                    
                    <div class="assessment-item" data-category="leadership" data-skill="strategic_input">
                        <input type="checkbox" class="assessment-checkbox">
                        <div class="skill-content">
                            <div class="skill-title">Выступаю техническим экспертом при принятии стратегических решений</div>
                            <div class="skill-example">Консультирую по выбору технологий, миграционным стратегиям, архитектурным решениям</div>
                        </div>
                    </div>
                </div>

                <div class="skills-group">
                    <h4>🌍 Системное воздействие:</h4>
                    
                    <div class="assessment-item" data-category="leadership" data-skill="reusable_solutions">
                        <input type="checkbox" class="assessment-checkbox">
                        <div class="skill-content">
                            <div class="skill-title">Создал решение, которое переиспользуется другими командами</div>
                            <div class="skill-example">Shared Terraform modules, common CI/CD templates, platform components</div>
                        </div>
                    </div>
                    
                    <div class="assessment-item" data-category="leadership" data-skill="tech_strategy">
                        <input type="checkbox" class="assessment-checkbox">
                        <div class="skill-content">
                            <div class="skill-title">Влияю на техническую стратегию продукта/организации</div>
                            <div class="skill-example">Участвую в планировании cloud migration, platform development, tech debt prioritization</div>
                        </div>
                    </div>
                    
                    <div class="assessment-item" data-category="leadership" data-skill="collaboration">
                        <input type="checkbox" class="assessment-checkbox">
                        <div class="skill-content">
                            <div class="skill-title">Выстраиваю cross-team collaboration и knowledge sharing</div>
                            <div class="skill-example">DevOps guild, tech talks, documentation culture, communities of practice</div>
                        </div>
                    </div>
                    
                    <div class="assessment-item" data-category="leadership" data-skill="external_representation">
                        <input type="checkbox" class="assessment-checkbox">
                        <div class="skill-content">
                            <div class="skill-title">Представляю экспертизу компании во внешних сообществах</div>
                            <div class="skill-example">Конференции, open source contributions, tech blogging, industry partnerships</div>
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
                        <div class="category-title">🎯 T-shaped Foundation</div>
                        <div class="category-score" id="score-foundation">0/8</div>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill progress-foundation" id="progress-foundation"></div>
                    </div>
                    <div class="result-text" id="result-foundation">Начните оценку для получения результата</div>
                </div>

                <div class="result-category">
                    <div class="category-header">
                        <div class="category-title">🧠 Systems Thinking</div>
                        <div class="category-score" id="score-systems">0/8</div>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill progress-systems" id="progress-systems"></div>
                    </div>
                    <div class="result-text" id="result-systems">Начните оценку для получения результата</div>
                </div>

                <div class="result-category">
                    <div class="category-header">
                        <div class="category-title">🚀 Leadership & Influence</div>
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
                <button onclick="requestConsultation()" class="consultation-btn">💬 Получить персональную консультацию</button>
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
        message = '🔥 Отличный уровень! Вы master в этой области';
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
        resultText = '🏆 Systems Thinking Master (20+/24) - Вы готовы к роли архитектора или тех. лидера!';
        recommendations = [
            'Развивайте экспертизу в emerging технологиях (AI/ML Ops, Platform Engineering)',
            'Сосредоточьтесь на стратегическом планировании и organizational impact',
            'Рассмотрите возможность менторства и knowledge sharing в индустрии',
            'Станьте техническим евангелистом и thought leader'
        ];
    } else if (totalScore >= 15) {
        resultClass = 'result-advanced';
        resultText = '🚀 Advanced Systems Thinker (15-19/24) - Сильный Senior с лидерским потенциалом';
        recommendations = [
            'Укрепляйте слабые области из трех категорий',
            'Развивайте навыки влияния и системного воздействия на организацию',
            'Практикуйте архитектурное мышление на сложных проектах',
            'Начинайте выстраивать техническое лидерство в команде'
        ];
    } else if (totalScore >= 10) {
        resultClass = 'result-developing';
        resultText = '📈 Developing Systems Thinker (10-14/24) - Крепкий Mid+ с потенциалом роста';
        recommendations = [
            'Фокусируйтесь на развитии системного мышления и архитектурного видения',
            'Практикуйте анализ trade-offs и долгосрочных последствий решений',
            'Изучайте архитектурные паттерны и industry best practices',
            'Развивайте навыки кросс-функционального взаимодействия'
        ];
    } else {
        resultClass = 'result-foundational';
        resultText = '🎯 Foundational Level (0-9/24) - Укрепляйте T-shaped базу';
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
    
    const shareText = `Мои результаты Systems Thinking Assessment:

🎯 T-shaped Foundation: ${foundation}/8
🧠 Systems Thinking: ${systems}/8  
🚀 Leadership & Influence: ${leadership}/8
📊 Общий результат: ${total}/24

Пройдите диагностику системного мышления: ${window.location.href}`;
    
    if (navigator.share) {
        navigator.share({
            title: 'Systems Thinking Assessment - DevOps Way',
            text: shareText,
            url: window.location.href
        });
    } else {
        navigator.clipboard.writeText(shareText).then(() => {
            alert('Результаты скопированы в буфер обмена!');
        });
    }
};

window.requestConsultation = function() {
    const foundation = window.systemsScores.foundation;
    const systems = window.systemsScores.systems;
    const leadership = window.systemsScores.leadership;
    const total = foundation + systems + leadership;
    
    const consultationText = `Здравствуйте! Прошел Systems Thinking Assessment на DevOps Way.

Мои результаты:
🎯 T-shaped Foundation: ${foundation}/8
🧠 Systems Thinking: ${systems}/8
🚀 Leadership & Influence: ${leadership}/8

Хотел бы получить персональную консультацию по развитию системного мышления в DevOps.`;
    
    const telegramUrl = `https://t.me/devopsway?text=${encodeURIComponent(consultationText)}`;
    window.open(telegramUrl, '_blank');
};