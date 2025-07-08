/**
 * SFIA Calculator JavaScript - DevOps Way
 * Файл: static/js/sfia-calculator.js
 */

document.addEventListener('DOMContentLoaded', function() {
    initSFIACalculator();
});

function initSFIACalculator() {
    const widget = document.getElementById('sfia-calculator-widget');
    if (!widget) return;

    // HTML содержимое калькулятора
    widget.innerHTML = `
        <div class="calc-intro">
            <h2>✅ Проверьте себя честно - DevOps Engineer</h2>
            <p><strong>SFIA</strong> — международная рамка компетенций IT-специалистов</p>
            <p>Поставьте ✅ только там, где уверены на 100%</p>
        </div>

        <div class="level-section">
            <div class="level-header">
                🌱 Уровень 1 → Уровень 2 (Стажер → Джуниор DevOps)
            </div>
            
            <div class="skills-group">
                <h4>Инфраструктура и операции (SFIA: TECH, ITOP):</h4>
                <div class="skill-item" data-level="level12">
                    <input type="checkbox" class="skill-checkbox">
                    <div class="skill-text">Знаю основы Linux/Unix систем (файловая система, права доступа, процессы)</div>
                </div>
                <div class="skill-item" data-level="level12">
                    <input type="checkbox" class="skill-checkbox">
                    <div class="skill-text">Понимаю основы сетей (TCP/IP, HTTP/HTTPS, DNS, SSH)</div>
                </div>
                <div class="skill-item" data-level="level12">
                    <input type="checkbox" class="skill-checkbox">
                    <div class="skill-text">Могу выполнить базовые операции с контейнерами (Docker run, build, stop)</div>
                </div>
                <div class="skill-item" data-level="level12">
                    <input type="checkbox" class="skill-checkbox">
                    <div class="skill-text">Понимаю принципы работы виртуализации и облачных сервисов</div>
                </div>
            </div>

            <div class="skills-group">
                <h4>Автоматизация и скриптинг (SFIA: PROG, TEST):</h4>
                <div class="skill-item" data-level="level12">
                    <input type="checkbox" class="skill-checkbox">
                    <div class="skill-text">Пишу простые скрипты на Bash/PowerShell для автоматизации</div>
                </div>
                <div class="skill-item" data-level="level12">
                    <input type="checkbox" class="skill-checkbox">
                    <div class="skill-text">Знаю основы Git (clone, add, commit, push, pull)</div>
                </div>
                <div class="skill-item" data-level="level12">
                    <input type="checkbox" class="skill-checkbox">
                    <div class="skill-text">Понимаю принципы CI/CD и могу объяснить их важность</div>
                </div>
                <div class="skill-item" data-level="level12">
                    <input type="checkbox" class="skill-checkbox">
                    <div class="skill-text">Умею читать YAML/JSON конфигурационные файлы</div>
                </div>
            </div>

            <div class="skills-group">
                <h4>Мониторинг и культура DevOps (SFIA: USUP, RLMT):</h4>
                <div class="skill-item" data-level="level12">
                    <input type="checkbox" class="skill-checkbox">
                    <div class="skill-text">Понимаю важность мониторинга и логирования в IT-системах</div>
                </div>
                <div class="skill-item" data-level="level12">
                    <input type="checkbox" class="skill-checkbox">
                    <div class="skill-text">Могу найти и анализировать логи приложений для поиска ошибок</div>
                </div>
                <div class="skill-item" data-level="level12">
                    <input type="checkbox" class="skill-checkbox">
                    <div class="skill-text">Понимаю принципы совместной работы dev и ops команд</div>
                </div>
                <div class="skill-item" data-level="level12">
                    <input type="checkbox" class="skill-checkbox">
                    <div class="skill-text">Знаю основы инцидент-менеджмента и эскалации проблем</div>
                </div>
            </div>
        </div>

        <div class="level-section">
            <div class="level-header">
                📈 Уровень 2 → Уровень 3 (Джуниор → Мидл DevOps)
            </div>
            
            <div class="skills-group">
                <h4>Контейнеризация и оркестрация (SFIA: ARCH, TECH):</h4>
                <div class="skill-item" data-level="level23">
                    <input type="checkbox" class="skill-checkbox">
                    <div class="skill-text">Создаю Dockerfile для различных приложений</div>
                </div>
                <div class="skill-item" data-level="level23">
                    <input type="checkbox" class="skill-checkbox">
                    <div class="skill-text">Работаю с Kubernetes (pods, services, deployments)</div>
                </div>
                <div class="skill-item" data-level="level23">
                    <input type="checkbox" class="skill-checkbox">
                    <div class="skill-text">Понимаю и применяю принципы микросервисной архитектуры</div>
                </div>
                <div class="skill-item" data-level="level23">
                    <input type="checkbox" class="skill-checkbox">
                    <div class="skill-text">Настраиваю load balancing и service discovery</div>
                </div>
            </div>

            <div class="skills-group">
                <h4>Infrastructure as Code (SFIA: ARCH, CFMG):</h4>
                <div class="skill-item" data-level="level23">
                    <input type="checkbox" class="skill-checkbox">
                    <div class="skill-text">Использую Terraform/Ansible для управления инфраструктурой</div>
                </div>
                <div class="skill-item" data-level="level23">
                    <input type="checkbox" class="skill-checkbox">
                    <div class="skill-text">Создаю и поддерживаю CI/CD пайплайны (Jenkins/GitLab CI/GitHub Actions)</div>
                </div>
                <div class="skill-item" data-level="level23">
                    <input type="checkbox" class="skill-checkbox">
                    <div class="skill-text">Версионирую инфраструктуру и применяю принципы GitOps</div>
                </div>
                <div class="skill-item" data-level="level23">
                    <input type="checkbox" class="skill-checkbox">
                    <div class="skill-text">Автоматизирую развертывание в нескольких средах (dev/staging/prod)</div>
                </div>
            </div>

            <div class="skills-group">
                <h4>Мониторинг и производительность (SFIA: USUP, PEMT):</h4>
                <div class="skill-item" data-level="level23">
                    <input type="checkbox" class="skill-checkbox">
                    <div class="skill-text">Настраиваю системы мониторинга (Prometheus, Grafana, ELK Stack)</div>
                </div>
                <div class="skill-item" data-level="level23">
                    <input type="checkbox" class="skill-checkbox">
                    <div class="skill-text">Создаю алерты и дашборды для отслеживания KPI</div>
                </div>
                <div class="skill-item" data-level="level23">
                    <input type="checkbox" class="skill-checkbox">
                    <div class="skill-text">Анализирую производительность систем и оптимизирую их</div>
                </div>
                <div class="skill-item" data-level="level23">
                    <input type="checkbox" class="skill-checkbox">
                    <div class="skill-text">Понимаю принципы SRE и участвую в on-call ротации</div>
                </div>
            </div>
        </div>

        <div class="level-section">
            <div class="level-header">
                📊 Уровень 3 → Уровень 4 (Мидл → Синьор DevOps)
            </div>
            
            <div class="skills-group">
                <h4>Архитектура и проектирование (SFIA: ARCH, EMRG):</h4>
                <div class="skill-item" data-level="level34">
                    <input type="checkbox" class="skill-checkbox">
                    <div class="skill-text">Проектирую отказоустойчивые системы с учетом RTO/RPO</div>
                </div>
                <div class="skill-item" data-level="level34">
                    <input type="checkbox" class="skill-checkbox">
                    <div class="skill-text">Принимаю решения по выбору технологий и инструментов DevOps</div>
                </div>
                <div class="skill-item" data-level="level34">
                    <input type="checkbox" class="skill-checkbox">
                    <div class="skill-text">Создаю стандарты и best practices для команды</div>
                </div>
                <div class="skill-item" data-level="level34">
                    <input type="checkbox" class="skill-checkbox">
                    <div class="skill-text">Оцениваю технические риски и планирую миграции</div>
                </div>
            </div>

            <div class="skills-group">
                <h4>Безопасность и соответствие (SFIA: SCTY, GOVN):</h4>
                <div class="skill-item" data-level="level34">
                    <input type="checkbox" class="skill-checkbox">
                    <div class="skill-text">Внедряю DevSecOps практики в пайплайны разработки</div>
                </div>
                <div class="skill-item" data-level="level34">
                    <input type="checkbox" class="skill-checkbox">
                    <div class="skill-text">Настраиваю системы аудита и соответствия (compliance)</div>
                </div>
                <div class="skill-item" data-level="level34">
                    <input type="checkbox" class="skill-checkbox">
                    <div class="skill-text">Управляю секретами и сертификатами (Vault, Sealed Secrets)</div>
                </div>
                <div class="skill-item" data-level="level34">
                    <input type="checkbox" class="skill-checkbox">
                    <div class="skill-text">Провожу security-ревью инфраструктурного кода</div>
                </div>
            </div>

            <div class="skills-group">
                <h4>Менторство и процессы (SFIA: BURM, CFMG):</h4>
                <div class="skill-item" data-level="level34">
                    <input type="checkbox" class="skill-checkbox">
                    <div class="skill-text">Обучаю junior DevOps инженеров и разработчиков</div>
                </div>
                <div class="skill-item" data-level="level34">
                    <input type="checkbox" class="skill-checkbox">
                    <div class="skill-text">Оптимизирую процессы разработки и деплоя</div>
                </div>
                <div class="skill-item" data-level="level34">
                    <input type="checkbox" class="skill-checkbox">
                    <div class="skill-text">Провожу post-mortem анализ инцидентов</div>
                </div>
                <div class="skill-item" data-level="level34">
                    <input type="checkbox" class="skill-checkbox">
                    <div class="skill-text">Создаю техническую документацию и runbook'и</div>
                </div>
            </div>
        </div>

        <div class="level-section">
            <div class="level-header">
                🚀 Уровень 4 → Уровень 5 (Синьор → Principal/Lead DevOps)
            </div>
            
            <div class="skills-group">
                <h4>Стратегическое планирование (SFIA: ITST, ICPM):</h4>
                <div class="skill-item" data-level="level45">
                    <input type="checkbox" class="skill-checkbox">
                    <div class="skill-text">Формирую техническую стратегию DevOps для организации</div>
                </div>
                <div class="skill-item" data-level="level45">
                    <input type="checkbox" class="skill-checkbox">
                    <div class="skill-text">Планирую digital transformation и облачные миграции</div>
                </div>
                <div class="skill-item" data-level="level45">
                    <input type="checkbox" class="skill-checkbox">
                    <div class="skill-text">Влияю на архитектурные решения на уровне компании</div>
                </div>
                <div class="skill-item" data-level="level45">
                    <input type="checkbox" class="skill-checkbox">
                    <div class="skill-text">Оцениваю ROI от внедрения DevOps практик</div>
                </div>
            </div>

            <div class="skills-group">
                <h4>Лидерство и трансформация (SFIA: POMT, ORCD):</h4>
                <div class="skill-item" data-level="level45">
                    <input type="checkbox" class="skill-checkbox">
                    <div class="skill-text">Возглавляю культурную трансформацию DevOps в организации</div>
                </div>
                <div class="skill-item" data-level="level45">
                    <input type="checkbox" class="skill-checkbox">
                    <div class="skill-text">Выстраиваю cross-functional команды (dev/ops/qa/security)</div>
                </div>
                <div class="skill-item" data-level="level45">
                    <input type="checkbox" class="skill-checkbox">
                    <div class="skill-text">Представляю компанию на конференциях как эксперт DevOps</div>
                </div>
                <div class="skill-item" data-level="level45">
                    <input type="checkbox" class="skill-checkbox">
                    <div class="skill-text">Развиваю DevOps community of practice</div>
                </div>
            </div>

            <div class="skills-group">
                <h4>Innovation и стандартизация (SFIA: BSIM, SLEN):</h4>
                <div class="skill-item" data-level="level45">
                    <input type="checkbox" class="skill-checkbox">
                    <div class="skill-text">Внедрил платформу/решение, используемое в масштабе компании</div>
                </div>
                <div class="skill-item" data-level="level45">
                    <input type="checkbox" class="skill-checkbox">
                    <div class="skill-text">Создаю enterprise-стандарты для DevOps практик</div>
                </div>
                <div class="skill-item" data-level="level45">
                    <input type="checkbox" class="skill-checkbox">
                    <div class="skill-text">Исследую и внедряю emerging технологии (AI/ML Ops, GitOps, etc.)</div>
                </div>
                <div class="skill-item" data-level="level45">
                    <input type="checkbox" class="skill-checkbox">
                    <div class="skill-text">Строю partnerships с vendors и open source сообществом</div>
                </div>
            </div>
        </div>

        <div class="results-section">
            <h3>📈 Ваши результаты:</h3>
            
            <div class="level-result">
                <h4>Уровень 1 → 2:</h4>
                <div class="progress-bar">
                    <div class="progress-fill" id="progress-12">0/12</div>
                </div>
                <div class="result-text" id="result-text-12">
                    Начните отмечать навыки для получения результата
                </div>
            </div>

            <div class="level-result">
                <h4>Уровень 2 → 3:</h4>
                <div class="progress-bar">
                    <div class="progress-fill" id="progress-23">0/12</div>
                </div>
                <div class="result-text" id="result-text-23">
                    Начните отмечать навыки для получения результата
                </div>
            </div>
            
            <div class="level-result">
                <h4>Уровень 3 → 4:</h4>
                <div class="progress-bar">
                    <div class="progress-fill" id="progress-34">0/12</div>
                </div>
                <div class="result-text" id="result-text-34">
                    Начните отмечать навыки для получения результата
                </div>
            </div>

            <div class="level-result">
                <h4>Уровень 4 → 5:</h4>
                <div class="progress-bar">
                    <div class="progress-fill" id="progress-45">0/12</div>
                </div>
                <div class="result-text" id="result-text-45">
                    Начните отмечать навыки для получения результата
                </div>
            </div>

            <button onclick="resetAll()" class="reset-btn">
                🔄 Сбросить все
            </button>

            <div class="share-section">
                <p><strong>💭 Поделитесь результатами:</strong></p>
                <button class="share-btn" onclick="shareResults()">📱 Поделиться</button>
                <a href="#" onclick="shareToTelegram()" class="share-btn">💬 Telegram</a>
            </div>
        </div>
    `;

    // Инициализация счетчиков
    window.sfiaScores = { level12: 0, level23: 0, level34: 0, level45: 0 };
    
    // Добавляем обработчики событий для всех skill-item
    document.querySelectorAll('.skill-item').forEach(item => {
        item.addEventListener('click', function(event) {
            // Предотвращаем конфликт с checkbox
            event.preventDefault();
            
            const level = this.getAttribute('data-level');
            const checkbox = this.querySelector('.skill-checkbox');
            
            // Переключаем состояние checkbox
            checkbox.checked = !checkbox.checked;
            
            // Обновляем счетчик
            if (checkbox.checked) {
                this.classList.add('checked');
                window.sfiaScores[level]++;
            } else {
                this.classList.remove('checked');
                window.sfiaScores[level]--;
            }
            
            updateResults();
            
            // Добавляем визуальный эффект
            this.style.transform = 'scale(1.02)';
            setTimeout(() => {
                this.style.transform = '';
            }, 150);
        });
    });
}

function updateResults() {
    updateLevelResults('12', window.sfiaScores.level12, 12);
    updateLevelResults('23', window.sfiaScores.level23, 12);
    updateLevelResults('34', window.sfiaScores.level34, 12);
    updateLevelResults('45', window.sfiaScores.level45, 12);
}

function updateLevelResults(level, score, total) {
    const progressBar = document.getElementById(`progress-${level}`);
    const resultText = document.getElementById(`result-text-${level}`);
    
    if (!progressBar || !resultText) return;
    
    const percentage = (score / total) * 100;
    progressBar.style.width = percentage + '%';
    progressBar.textContent = `${score}/${total}`;
    
    let message, className;
    
    if (level === '12') {
        if (score >= 12) {
            message = '🎉 Готовы к DevOps Junior позиции! Отличная база: Linux, Docker, автоматизация!';
            className = 'result-ready';
        } else if (score >= 8) {
            message = '👍 Почти готовы! Подтяните основы Linux и контейнеризации';
            className = 'result-almost';
        } else if (score >= 5) {
            message = '🧩 Изучайте основы: Linux, Git, Docker, мониторинг';
            className = 'result-focus';
        } else {
            message = '🌱 Начинайте с основ: командная строка, сети, скриптинг';
            className = 'result-strengthen';
        }
    } else if (level === '23') {
        if (score >= 12) {
            message = '🔥 Готовы к DevOps Engineer позиции! Kubernetes, IaC, мониторинг - все на уровне!';
            className = 'result-ready';
        } else if (score >= 8) {
            message = '👍 Почти готовы! Углубите знания в Kubernetes и Infrastructure as Code';
            className = 'result-almost';
        } else if (score >= 5) {
            message = '🧩 Развивайте: контейнеризацию, CI/CD, системы мониторинга';
            className = 'result-focus';
        } else {
            message = '📚 Укрепляйте базу: Docker, автоматизация, Git workflows';
            className = 'result-strengthen';
        }
    } else if (level === '34') {
        if (score >= 12) {
            message = '🔥 Готовы к Senior DevOps позиции! Архитектура, безопасность, лидерство!';
            className = 'result-ready';
        } else if (score >= 8) {
            message = '👍 Развивайте DevSecOps и архитектурные навыки';
            className = 'result-almost';
        } else if (score >= 5) {
            message = '🧩 Фокус на проектировании систем и менторстве';
            className = 'result-focus';
        } else {
            message = '🧱 Укрепляйте технические навыки мидл-уровня';
            className = 'result-strengthen';
        }
    } else if (level === '45') {
        if (score >= 10) {
            message = '🔥 Готовы к Principal/Lead DevOps! Стратегия, трансформация, инновации!';
            className = 'result-ready';
        } else if (score >= 6) {
            message = '👍 Развивайте стратегическое мышление и лидерские навыки в DevOps';
            className = 'result-almost';
        } else if (score >= 4) {
            message = '🧩 Фокус на организационном влиянии и культурной трансформации';
            className = 'result-focus';
        } else {
            message = '🧱 Укрепляйте экспертизу Senior DevOps уровня';
            className = 'result-strengthen';
        }
    }
    
    resultText.textContent = message;
    resultText.className = `result-text ${className}`;
}

window.resetAll = function() {
    window.sfiaScores = { level12: 0, level23: 0, level34: 0, level45: 0 };
    
    document.querySelectorAll('.skill-checkbox').forEach(checkbox => {
        checkbox.checked = false;
    });
    
    document.querySelectorAll('.skill-item').forEach(item => {
        item.classList.remove('checked');
    });
    
    updateResults();
};

window.shareResults = function() {
    const results = [];
    
    if (window.sfiaScores.level12 >= 8) results.push(`Стажер→Джуниор DevOps: ${window.sfiaScores.level12}/12`);
    if (window.sfiaScores.level23 >= 8) results.push(`Джуниор→Мидл DevOps: ${window.sfiaScores.level23}/12`);
    if (window.sfiaScores.level34 >= 8) results.push(`Мидл→Синьор DevOps: ${window.sfiaScores.level34}/12`);
    if (window.sfiaScores.level45 >= 6) results.push(`Синьор→Principal DevOps: ${window.sfiaScores.level45}/12`);
    
    const shareText = results.length > 0 
        ? `Мои результаты SFIA DevOps:\n${results.join('\n')}\n\nПроверьте свой уровень: ${window.location.href}`
        : `Прошел DevOps SFIA тест на DevOps Way!\nПроверьте свой уровень: ${window.location.href}`;
    
    if (navigator.share) {
        navigator.share({
            title: 'SFIA DevOps Calculator - DevOps Way',
            text: shareText,
            url: window.location.href
        });
    } else {
        navigator.clipboard.writeText(shareText).then(() => {
            alert('Результаты скопированы в буфер обмена!');
        });
    }
};

window.shareToTelegram = function() {
    const results = [];
    
    if (window.sfiaScores.level12 >= 8) results.push(`Стажер→Джуниор: ${window.sfiaScores.level12}/12`);
    if (window.sfiaScores.level23 >= 8) results.push(`Джуниор→Мидл: ${window.sfiaScores.level23}/12`);
    if (window.sfiaScores.level34 >= 8) results.push(`Мидл→Синьор: ${window.sfiaScores.level34}/12`);
    if (window.sfiaScores.level45 >= 6) results.push(`Синьор→Principal: ${window.sfiaScores.level45}/12`);
    
    const shareText = results.length > 0 
        ? `Мои результаты SFIA DevOps:\n${results.join('\n')}\n\nПроверьте свой уровень:`
        : `Прошел DevOps SFIA тест!\nПроверьте свой уровень:`;
    
    const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(shareText)}`;
    window.open(telegramUrl, '_blank');
};