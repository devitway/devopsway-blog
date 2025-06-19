// assets/js/diagram-system.js - Исправленная версия
(function() {
    'use strict';

    // Предотвращение множественной инициализации
    if (window.DiagramSystem) {
        return;
    }

    console.log('Инициализация системы диаграмм...');

    class DiagramSystem {
        constructor() {
            this.initialized = false;
            this.diagramContainers = new Map();
            this.zoomBehaviors = new Map();
            this.currentTransforms = new Map();
            
            // Привязка методов к контексту
            this.init = this.init.bind(this);
            this.createDiagram = this.createDiagram.bind(this);
            this.setupZoom = this.setupZoom.bind(this);
            this.resetZoom = this.resetZoom.bind(this);
            this.zoomIn = this.zoomIn.bind(this);
            this.zoomOut = this.zoomOut.bind(this);
        }

        init() {
            if (this.initialized) {
                console.log('Система диаграмм уже инициализирована');
                return;
            }

            console.log('Запуск инициализации системы диаграмм');
            
            // Проверяем наличие D3
            if (typeof d3 === 'undefined') {
                console.error('D3.js не загружен! Система диаграмм не может работать.');
                return;
            }

            // Ищем все контейнеры диаграмм
            const diagramElements = document.querySelectorAll('[data-diagram-type]');
            console.log(`Найдено ${diagramElements.length} элементов диаграмм`);

            diagramElements.forEach((element, index) => {
                try {
                    const diagramType = element.getAttribute('data-diagram-type');
                    const diagramId = element.id || `diagram-${index}`;
                    element.id = diagramId;

                    console.log(`Создание диаграммы ${diagramId} типа ${diagramType}`);
                    this.createDiagram(element, diagramType, diagramId);
                } catch (error) {
                    console.error('Ошибка при создании диаграммы:', error);
                }
            });

            // Создаем глобальные обработчики
            this.setupGlobalControls();
            this.initialized = true;
            
            console.log('Система диаграмм успешно инициализирована');
        }

        createDiagram(container, type, id) {
            // Очищаем контейнер
            container.innerHTML = '';

            // Создаем структуру диаграммы
            const diagramWrapper = document.createElement('div');
            diagramWrapper.className = 'diagram-wrapper';
            diagramWrapper.innerHTML = `
                <div class="diagram-controls">
                    <button class="diagram-btn" onclick="window.DiagramSystem.resetZoom('${id}')">
                        🔄 Сбросить
                    </button>
                    <button class="diagram-btn" onclick="window.DiagramSystem.zoomIn('${id}')">
                        🔍 Увеличить
                    </button>
                    <button class="diagram-btn" onclick="window.DiagramSystem.zoomOut('${id}')">
                        🔎 Уменьшить
                    </button>
                    <button class="diagram-btn" onclick="window.DiagramSystem.highlightCriticalPath('${id}')">
                        ⚡ Критический путь
                    </button>
                </div>
                <div class="diagram-container-inner">
                    <svg class="diagram-svg" id="svg-${id}"></svg>
                    <div class="diagram-info" id="info-${id}" style="display: none;">
                        <h4 id="info-title-${id}">Информация</h4>
                        <p id="info-content-${id}">Выберите элемент для просмотра деталей</p>
                    </div>
                    <div class="zoom-indicator" id="zoom-${id}">Zoom: 100%</div>
                </div>
            `;

            container.appendChild(diagramWrapper);

            // Инициализируем диаграмму на основе типа
            switch (type) {
                case 'microservices':
                    this.createMicroservicesDiagram(id);
                    break;
                case 'architecture':
                    this.createArchitectureDiagram(id);
                    break;
                case 'network':
                    this.createNetworkDiagram(id);
                    break;
                default:
                    console.warn(`Неизвестный тип диаграммы: ${type}`);
                    this.createDefaultDiagram(id);
            }
        }

        createMicroservicesDiagram(id) {
            const svg = d3.select(`#svg-${id}`);
            const width = 800;
            const height = 600;
            
            svg.attr('viewBox', `0 0 ${width} ${height}`)
               .attr('preserveAspectRatio', 'xMidYMid meet');

            // Данные микросервисов
            const nodes = [
                { id: 'gateway', name: 'API Gateway', type: 'gateway', x: 400, y: 50, 
                  description: 'Единая точка входа для всех клиентских запросов' },
                { id: 'auth', name: 'Auth Service', type: 'service', x: 200, y: 150,
                  description: 'Сервис аутентификации и авторизации' },
                { id: 'user', name: 'User Service', type: 'service', x: 400, y: 150,
                  description: 'Управление профилями пользователей' },
                { id: 'catalog', name: 'Catalog Service', type: 'service', x: 600, y: 150,
                  description: 'Каталог товаров и поиск' },
                { id: 'order', name: 'Order Service', type: 'service', x: 300, y: 250,
                  description: 'Обработка заказов' },
                { id: 'payment', name: 'Payment Service', type: 'service', x: 500, y: 250,
                  description: 'Обработка платежей' },
                { id: 'userdb', name: 'User DB', type: 'database', x: 200, y: 350,
                  description: 'База данных пользователей' },
                { id: 'orderdb', name: 'Order DB', type: 'database', x: 400, y: 350,
                  description: 'База данных заказов' },
                { id: 'redis', name: 'Redis Cache', type: 'cache', x: 600, y: 350,
                  description: 'Кэш для быстрого доступа к данным' }
            ];

            const links = [
                { source: 'gateway', target: 'auth', type: 'normal' },
                { source: 'gateway', target: 'user', type: 'normal' },
                { source: 'gateway', target: 'catalog', type: 'normal' },
                { source: 'gateway', target: 'order', type: 'critical' },
                { source: 'order', target: 'payment', type: 'critical' },
                { source: 'auth', target: 'userdb', type: 'normal' },
                { source: 'user', target: 'userdb', type: 'normal' },
                { source: 'order', target: 'orderdb', type: 'critical' },
                { source: 'catalog', target: 'redis', type: 'normal' }
            ];

            this.renderDiagram(svg, nodes, links, id);
            this.setupZoom(svg, id);
        }

        createArchitectureDiagram(id) {
            // Аналогично createMicroservicesDiagram, но с другими данными
            const svg = d3.select(`#svg-${id}`);
            const width = 800;
            const height = 600;
            
            svg.attr('viewBox', `0 0 ${width} ${height}`)
               .attr('preserveAspectRatio', 'xMidYMid meet');

            // Простая архитектурная диаграмма
            const nodes = [
                { id: 'frontend', name: 'Frontend', type: 'frontend', x: 400, y: 100,
                  description: 'Пользовательский интерфейс' },
                { id: 'backend', name: 'Backend API', type: 'backend', x: 400, y: 300,
                  description: 'Серверная логика' },
                { id: 'database', name: 'Database', type: 'database', x: 400, y: 500,
                  description: 'Хранилище данных' }
            ];

            const links = [
                { source: 'frontend', target: 'backend', type: 'normal' },
                { source: 'backend', target: 'database', type: 'normal' }
            ];

            this.renderDiagram(svg, nodes, links, id);
            this.setupZoom(svg, id);
        }

        createNetworkDiagram(id) {
            // Сетевая диаграмма
            const svg = d3.select(`#svg-${id}`);
            const width = 800;
            const height = 600;
            
            svg.attr('viewBox', `0 0 ${width} ${height}`)
               .attr('preserveAspectRatio', 'xMidYMid meet');

            // Сетевые узлы
            const nodes = [
                { id: 'router', name: 'Router', type: 'network', x: 400, y: 100,
                  description: 'Основной маршрутизатор' },
                { id: 'switch1', name: 'Switch 1', type: 'network', x: 200, y: 250,
                  description: 'Коммутатор 1' },
                { id: 'switch2', name: 'Switch 2', type: 'network', x: 600, y: 250,
                  description: 'Коммутатор 2' },
                { id: 'server1', name: 'Server 1', type: 'server', x: 100, y: 400,
                  description: 'Веб-сервер' },
                { id: 'server2', name: 'Server 2', type: 'server', x: 300, y: 400,
                  description: 'База данных' },
                { id: 'server3', name: 'Server 3', type: 'server', x: 500, y: 400,
                  description: 'Файловый сервер' },
                { id: 'server4', name: 'Server 4', type: 'server', x: 700, y: 400,
                  description: 'Резервный сервер' }
            ];

            const links = [
                { source: 'router', target: 'switch1', type: 'normal' },
                { source: 'router', target: 'switch2', type: 'normal' },
                { source: 'switch1', target: 'server1', type: 'normal' },
                { source: 'switch1', target: 'server2', type: 'normal' },
                { source: 'switch2', target: 'server3', type: 'normal' },
                { source: 'switch2', target: 'server4', type: 'normal' }
            ];

            this.renderDiagram(svg, nodes, links, id);
            this.setupZoom(svg, id);
        }

        createDefaultDiagram(id) {
            const svg = d3.select(`#svg-${id}`);
            const width = 800;
            const height = 600;
            
            svg.attr('viewBox', `0 0 ${width} ${height}`)
               .attr('preserveAspectRatio', 'xMidYMid meet');

            // Простая диаграмма по умолчанию
            svg.append('text')
               .attr('x', width / 2)
               .attr('y', height / 2)
               .attr('text-anchor', 'middle')
               .attr('font-size', '24px')
               .attr('fill', '#666')
               .text('Диаграмма не настроена');
        }

        renderDiagram(svg, nodes, links, diagramId) {
            // Очищаем SVG
            svg.selectAll('*').remove();

            // Создаем группу для зума
            const container = svg.append('g').attr('class', 'zoom-container');
            const linksGroup = container.append('g').attr('class', 'links');
            const nodesGroup = container.append('g').attr('class', 'nodes');

            // Сохраняем контейнер для зума
            this.diagramContainers.set(diagramId, container);
            this.currentTransforms.set(diagramId, d3.zoomIdentity);

            // Отрисовка связей
            const linkElements = linksGroup.selectAll('.link')
                .data(links)
                .enter()
                .append('line')
                .attr('class', d => `link ${d.type}`)
                .attr('stroke', d => d.type === 'critical' ? '#e53e3e' : '#a0aec0')
                .attr('stroke-width', d => d.type === 'critical' ? 3 : 2)
                .attr('stroke-dasharray', d => d.type === 'critical' ? '5,5' : 'none')
                .attr('x1', d => {
                    const source = nodes.find(n => n.id === d.source);
                    return source ? source.x : 0;
                })
                .attr('y1', d => {
                    const source = nodes.find(n => n.id === d.source);
                    return source ? source.y : 0;
                })
                .attr('x2', d => {
                    const target = nodes.find(n => n.id === d.target);
                    return target ? target.x : 0;
                })
                .attr('y2', d => {
                    const target = nodes.find(n => n.id === d.target);
                    return target ? target.y : 0;
                });

            // Отрисовка узлов
            const nodeElements = nodesGroup.selectAll('.node')
                .data(nodes)
                .enter()
                .append('g')
                .attr('class', d => `node ${d.type}`)
                .attr('transform', d => `translate(${d.x}, ${d.y})`)
                .style('cursor', 'pointer')
                .on('click', (event, d) => this.showNodeInfo(d, diagramId))
                .on('mouseover', (event, d) => this.highlightNode(d, diagramId))
                .on('mouseout', (event, d) => this.unhighlightNode(d, diagramId));

            // Добавляем прямоугольники для узлов
            nodeElements.append('rect')
                .attr('width', d => Math.max(80, d.name.length * 8))
                .attr('height', 40)
                .attr('x', d => -Math.max(40, d.name.length * 4))
                .attr('y', -20)
                .attr('rx', 5)
                .attr('ry', 5)
                .attr('fill', d => this.getNodeColor(d.type))
                .attr('stroke', d => this.getNodeStrokeColor(d.type))
                .attr('stroke-width', 2);

            // Добавляем текст для узлов
            nodeElements.append('text')
                .attr('text-anchor', 'middle')
                .attr('dy', '0.35em')
                .attr('fill', 'white')
                .attr('font-size', '12px')
                .attr('font-weight', '600')
                .style('pointer-events', 'none')
                .text(d => d.name);

            console.log(`Диаграмма ${diagramId} отрисована с ${nodes.length} узлами и ${links.length} связями`);
        }

        getNodeColor(type) {
            const colors = {
                'gateway': '#667eea',
                'service': '#48bb78',
                'database': '#ed8936',
                'cache': '#38b2ac',
                'queue': '#9f7aea',
                'external': '#e53e3e',
                'frontend': '#4299e1',
                'backend': '#48bb78',
                'network': '#805ad5',
                'server': '#38a169'
            };
            return colors[type] || '#a0aec0';
        }

        getNodeStrokeColor(type) {
            const colors = {
                'gateway': '#5a67d8',
                'service': '#38a169',
                'database': '#dd6b20',
                'cache': '#319795',
                'queue': '#805ad5',
                'external': '#c53030',
                'frontend': '#3182ce',
                'backend': '#38a169',
                'network': '#6b46c1',
                'server': '#2f855a'
            };
            return colors[type] || '#718096';
        }

        setupZoom(svg, diagramId) {
            const container = this.diagramContainers.get(diagramId);
            if (!container) {
                console.error(`Контейнер для диаграммы ${diagramId} не найден`);
                return;
            }

            const zoom = d3.zoom()
                .scaleExtent([0.3, 3])
                .on('zoom', (event) => {
                    const transform = event.transform;
                    this.currentTransforms.set(diagramId, transform);
                    container.attr('transform', transform);
                    this.updateZoomIndicator(diagramId, transform.k);
                });

            svg.call(zoom);
            this.zoomBehaviors.set(diagramId, zoom);

            console.log(`Зум настроен для диаграммы ${diagramId}`);
        }

        updateZoomIndicator(diagramId, scale) {
            const indicator = document.getElementById(`zoom-${diagramId}`);
            if (indicator) {
                indicator.textContent = `Zoom: ${Math.round(scale * 100)}%`;
            }
        }

        showNodeInfo(node, diagramId) {
            const infoPanel = document.getElementById(`info-${diagramId}`);
            const infoTitle = document.getElementById(`info-title-${diagramId}`);
            const infoContent = document.getElementById(`info-content-${diagramId}`);

            if (infoPanel && infoTitle && infoContent) {
                infoTitle.textContent = node.name;
                infoContent.textContent = node.description || 'Описание не доступно';
                infoPanel.style.display = 'block';

                // Автоматически скрыть через 5 секунд
                setTimeout(() => {
                    infoPanel.style.display = 'none';
                }, 5000);
            }
        }

        highlightNode(node, diagramId) {
            const svg = d3.select(`#svg-${diagramId}`);
            svg.selectAll('.node')
               .style('opacity', d => d.id === node.id ? 1 : 0.6);
            svg.selectAll('.link')
               .style('opacity', d => d.source === node.id || d.target === node.id ? 1 : 0.3);
        }

        unhighlightNode(node, diagramId) {
            const svg = d3.select(`#svg-${diagramId}`);
            svg.selectAll('.node').style('opacity', 1);
            svg.selectAll('.link').style('opacity', 1);
        }

        // Публичные методы для управления зумом
        resetZoom(diagramId) {
            const svg = d3.select(`#svg-${diagramId}`);
            const zoom = this.zoomBehaviors.get(diagramId);
            if (zoom) {
                svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity);
                this.updateZoomIndicator(diagramId, 1);
            }
        }

        zoomIn(diagramId) {
            const svg = d3.select(`#svg-${diagramId}`);
            const zoom = this.zoomBehaviors.get(diagramId);
            if (zoom) {
                svg.transition().duration(300).call(zoom.scaleBy, 1.5);
            }
        }

        zoomOut(diagramId) {
            const svg = d3.select(`#svg-${diagramId}`);
            const zoom = this.zoomBehaviors.get(diagramId);
            if (zoom) {
                svg.transition().duration(300).call(zoom.scaleBy, 1 / 1.5);
            }
        }

        highlightCriticalPath(diagramId) {
            const svg = d3.select(`#svg-${diagramId}`);
            
            // Скрыть все обычные связи
            svg.selectAll('.link')
               .style('opacity', d => d.type === 'critical' ? 1 : 0.1);

            // Подсветить критические узлы
            svg.selectAll('.node')
               .style('opacity', 0.3);

            // Восстановить через 3 секунды
            setTimeout(() => {
                svg.selectAll('.link').style('opacity', 1);
                svg.selectAll('.node').style('opacity', 1);
            }, 3000);
        }

        setupGlobalControls() {
            // Создаем глобальные методы
            window.resetZoom = this.resetZoom.bind(this);
            window.zoomIn = this.zoomIn.bind(this);
            window.zoomOut = this.zoomOut.bind(this);
            window.highlightCriticalPath = this.highlightCriticalPath.bind(this);
        }
    }

    // Создаем и экспортируем экземпляр
    window.DiagramSystem = new DiagramSystem();

    // Автоматическая инициализация при загрузке DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            // Небольшая задержка для загрузки D3
            setTimeout(() => {
                window.DiagramSystem.init();
            }, 100);
        });
    } else {
        // DOM уже загружен
        setTimeout(() => {
            window.DiagramSystem.init();
        }, 100);
    }

    console.log('Система диаграмм подключена и готова к инициализации');
})();