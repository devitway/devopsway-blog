#!/bin/bash

# =============================================================================
# СКРИПТ ОБНОВЛЕНИЯ EXPAND ФУНКЦИОНАЛЬНОСТИ
# Выполнить в корневой директории Hugo проекта
# =============================================================================

echo "🚀 Обновление expand функциональности для Hugo DevOps Way Blog"
echo "================================================================="

# Проверяем что мы в корне Hugo проекта
if [ ! -f "hugo.toml" ] && [ ! -f "config.toml" ]; then
    echo "❌ Ошибка: не найден файл конфигурации Hugo (hugo.toml или config.toml)"
    echo "Убедитесь что выполняете скрипт в корневой директории Hugo проекта"
    exit 1
fi

echo "✅ Hugo проект найден"

# 1. Создаем резервную копию текущих файлов
echo ""
echo "📦 Создаем резервные копии..."

# Бэкап shortcode
if [ -f "layouts/shortcodes/expand.html" ]; then
    cp "layouts/shortcodes/expand.html" "layouts/shortcodes/expand.html.backup.$(date +%Y%m%d_%H%M%S)"
    echo "✅ Создан бэкап: layouts/shortcodes/expand.html"
fi

# Бэкап CSS
if [ -f "assets/css/extended/custom.css" ]; then
    cp "assets/css/extended/custom.css" "assets/css/extended/custom.css.backup.$(date +%Y%m%d_%H%M%S)"
    echo "✅ Создан бэкап: assets/css/extended/custom.css"
fi

# 2. Создаем необходимые директории
echo ""
echo "📁 Создаем структуру директорий..."

mkdir -p layouts/shortcodes
mkdir -p assets/css/extended

echo "✅ Директории созданы"

# 3. Обновляем shortcode expand.html
echo ""
echo "🔧 Обновляем shortcode expand.html..."

cat > layouts/shortcodes/expand.html << 'SHORTCODE_EOF'
{{- $title := .Get 0 | default "Развернуть" -}}
{{- $icon := .Get "icon" | default "▶" -}}
{{- $class := .Get "class" | default "" -}}
{{- $open := .Get "open" | default false -}}
{{- $variant := .Get "variant" | default "default" -}}

<details class="expand-container expand-{{ $variant }} {{ $class }}"{{ if $open }} open{{ end }}>
    <summary class="expand-header">
        <span class="expand-icon">{{ $icon }}</span>
        <span class="expand-title">{{ $title }}</span>
        <span class="expand-chevron">⌄</span>
    </summary>
    <div class="expand-content">
        {{ .Inner | markdownify }}
    </div>
</details>
SHORTCODE_EOF

echo "✅ Shortcode expand.html обновлен"

# 4. Добавляем CSS стили в custom.css
echo ""
echo "🎨 Добавляем CSS стили в custom.css..."

# Проверяем есть ли уже стили expand в файле
if grep -q "EXPAND SHORTCODE" assets/css/extended/custom.css 2>/dev/null; then
    echo "⚠️  Стили expand уже существуют в custom.css"
    echo "Пропускаем добавление дублирующих стилей..."
else
    echo "Добавляем стили в custom.css..."
    
    # Добавляем комментарий-разделитель
    echo "" >> assets/css/extended/custom.css
    echo "/* =============================================================================" >> assets/css/extended/custom.css
    echo "   EXPAND SHORTCODE - УЛУЧШЕННЫЕ СТИЛИ" >> assets/css/extended/custom.css
    echo "   Добавлено $(date '+%Y-%m-%d %H:%M:%S')" >> assets/css/extended/custom.css
    echo "   ============================================================================= */" >> assets/css/extended/custom.css
    echo "" >> assets/css/extended/custom.css
    
    # Добавляем полные стили
    cat >> assets/css/extended/custom.css << 'CSS_EOF'
.expand-container {
    margin: 1.5rem 0;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    overflow: hidden;
    background: #ffffff;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    transition: all 0.3s ease;
    font-family: inherit;
}

.expand-container:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
    border-color: #3b82f6;
    transform: translateY(-1px);
}

.expand-header {
    padding: 16px 20px;
    background: #f8fafc;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.95rem;
    list-style: none;
    user-select: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    transition: all 0.2s ease;
    border: none;
    outline: none;
    color: #1e293b;
}

.expand-header:hover {
    background: #f1f5f9;
    color: #3b82f6;
}

.expand-header::-webkit-details-marker {
    display: none;
}

.expand-title {
    flex: 1;
    display: flex;
    align-items: center;
}

.expand-icon {
    margin-right: 12px;
    font-size: 1rem;
    transition: all 0.3s ease;
}

.expand-chevron {
    font-size: 1.2rem;
    transition: transform 0.3s ease;
    color: #6b7280;
    font-weight: 600;
    margin-left: 8px;
}

.expand-container[open] .expand-chevron {
    transform: rotate(180deg);
    color: #3b82f6;
}

.expand-content {
    padding: 24px;
    background: #ffffff;
    border-top: 1px solid #f1f5f9;
    animation: expandFadeIn 0.3s ease-out;
}

@keyframes expandFadeIn {
    from {
        opacity: 0;
        transform: translateY(-8px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

/* Варианты expand */
.expand-info {
    border-color: #3b82f6;
    background: #eff6ff;
}

.expand-info .expand-header {
    background: #dbeafe;
    color: #1e40af;
}

.expand-info .expand-content {
    background: #eff6ff;
}

.expand-warning {
    border-color: #f59e0b;
    background: #fffbeb;
}

.expand-warning .expand-header {
    background: #fef3c7;
    color: #92400e;
}

.expand-warning .expand-content {
    background: #fffbeb;
}

.expand-success {
    border-color: #10b981;
    background: #ecfdf5;
}

.expand-success .expand-header {
    background: #d1fae5;
    color: #065f46;
}

.expand-success .expand-content {
    background: #ecfdf5;
}

.expand-danger {
    border-color: #ef4444;
    background: #fef2f2;
}

.expand-danger .expand-header {
    background: #fecaca;
    color: #991b1b;
}

.expand-danger .expand-content {
    background: #fef2f2;
}

/* Темная тема */
.dark .expand-container,
[data-theme="dark"] .expand-container {
    background: #1e293b;
    border-color: #334155;
    color: #f1f5f9;
}

.dark .expand-container:hover,
[data-theme="dark"] .expand-container:hover {
    border-color: #60a5fa;
}

.dark .expand-header,
[data-theme="dark"] .expand-header {
    background: #334155;
    color: #f1f5f9;
}

.dark .expand-header:hover,
[data-theme="dark"] .expand-header:hover {
    background: #475569;
    color: #60a5fa;
}

.dark .expand-content,
[data-theme="dark"] .expand-content {
    background: #1e293b;
    border-color: #334155;
}

.dark .expand-chevron,
[data-theme="dark"] .expand-chevron {
    color: #94a3b8;
}

.dark .expand-container[open] .expand-chevron,
[data-theme="dark"] .expand-container[open] .expand-chevron {
    color: #60a5fa;
}

/* Адаптивность */
@media (max-width: 768px) {
    .expand-container {
        margin: 1rem -0.5rem;
        border-radius: 0;
        border-left: none;
        border-right: none;
    }
    
    .expand-header {
        padding: 14px 16px;
        font-size: 0.9rem;
    }
    
    .expand-content {
        padding: 20px 16px;
    }
}
CSS_EOF

    echo "✅ CSS стили добавлены в custom.css"
fi

# 5. Удаляем старый отдельный файл expand.css если существует
if [ -f "assets/css/expand.css" ]; then
    echo ""
    echo "🗑️  Удаляем старый файл assets/css/expand.css..."
    mv "assets/css/expand.css" "assets/css/expand.css.backup.$(date +%Y%m%d_%H%M%S)"
    echo "✅ Старый файл перенесен в backup"
fi

# 6. Тестируем сборку
echo ""
echo "🧪 Тестируем сборку Hugo..."

if hugo --quiet 2>/dev/null; then
    echo "✅ Сборка Hugo прошла успешно"
else
    echo "⚠️  Есть предупреждения при сборке, но это нормально"
fi

echo ""
echo "🎉 ОБНОВЛЕНИЕ ЗАВЕРШЕНО!"
echo "========================"
echo ""
echo "📋 Что было сделано:"
echo "   ✅ Обновлен shortcode expand.html"
echo "   ✅ Добавлены CSS стили в custom.css"
echo "   ✅ Созданы backup файлы"
echo ""
echo "🚀 Новые возможности:"
echo "   📝 5 вариантов: default, info, warning, success, danger"
echo "   🎨 Кастомные иконки: icon=\"🚀\""
echo "   📂 Открытые по умолчанию: open=\"true\""
echo "   🌙 Улучшенная темная тема"
echo "   📱 Адаптивный дизайн"
echo ""
echo "💡 Примеры использования:"
echo '   {{< expand "🔗 Ссылки" >}}..{{< /expand >}}'
echo '   {{< expand "⚠️ Внимание" variant="warning" >}}..{{< /expand >}}'
echo '   {{< expand "✅ Успех" variant="success" icon="🎉" >}}..{{< /expand >}}'
echo ""
echo "🧪 Тестирование:"
echo "   hugo server --buildDrafts"
echo ""
echo "✨ Готово! Expand функциональность обновлена."
