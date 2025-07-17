#!/bin/bash

# =============================================================================
# СКРИПТ ОПТИМИЗАЦИИ ЗАГОЛОВКОВ DEVOPS WAY С ВОЗМОЖНОСТЬЮ ОТКАТА
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${SCRIPT_DIR}/backups/headers_$(date +%Y%m%d_%H%M%S)"
CSS_FILE="assets/css/extended/custom.css"
HUGO_CONFIG="hugo.toml"

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функция логирования
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Проверка окружения
check_environment() {
    log "Проверка окружения..."
    
    if [[ ! -f "$HUGO_CONFIG" ]]; then
        error "hugo.toml не найден. Запустите скрипт из корня Hugo проекта."
        exit 1
    fi
    
    if [[ ! -f "$CSS_FILE" ]]; then
        error "Файл $CSS_FILE не найден."
        exit 1
    fi
    
    # Проверка Hugo
    if ! command -v hugo &> /dev/null; then
        error "Hugo не установлен."
        exit 1
    fi
    
    # Проверка Git
    if ! command -v git &> /dev/null; then
        warning "Git не найден. Резервное копирование будет только локальным."
    fi
    
    success "Окружение готово"
}

# Создание резервной копии
create_backup() {
    log "Создание резервной копии..."
    
    mkdir -p "$BACKUP_DIR"
    
    # Копируем важные файлы
    cp "$CSS_FILE" "$BACKUP_DIR/"
    cp "$HUGO_CONFIG" "$BACKUP_DIR/"
    
    # Копируем связанные CSS файлы
    if [[ -f "assets/css/extended/dark-theme-enhanced.css" ]]; then
        cp "assets/css/extended/dark-theme-enhanced.css" "$BACKUP_DIR/"
    fi
    
    # Создаем манифест бэкапа
    cat > "$BACKUP_DIR/backup_manifest.txt" << EOF
Backup created: $(date)
Hugo version: $(hugo version 2>/dev/null || echo "unknown")
Git commit: $(git rev-parse HEAD 2>/dev/null || echo "unknown")
Changed files:
- $CSS_FILE
- $HUGO_CONFIG
EOF
    
    # Git commit текущего состояния (если возможно)
    if command -v git &> /dev/null && git rev-parse --git-dir > /dev/null 2>&1; then
        git add .
        git commit -m "Backup before header optimization - $(date)" || true
    fi
    
    success "Резервная копия создана: $BACKUP_DIR"
}

# Применение оптимизаций
apply_optimizations() {
    log "Применение оптимизаций заголовков..."
    
    # 1. Добавляем оптимизированные стили в конец custom.css
    cat >> "$CSS_FILE" << 'EOF'

/* =============================================================================
   ОПТИМИЗИРОВАННЫЕ ЗАГОЛОВКИ - ДОБАВЛЕНО АВТОМАТИЧЕСКИ
   ============================================================================= */

/* Базовые переменные */
:root {
  --h1-desktop: 2.25rem; --h2-desktop: 2rem; --h3-desktop: 1.5rem;
  --h1-tablet: 2rem; --h2-tablet: 1.75rem; --h3-tablet: 1.375rem;
  --h1-mobile: 1.5rem; --h2-mobile: 1.375rem; --h3-mobile: 1.25rem;
  --h1-small: 1.25rem; --h2-small: 1.125rem; --h3-small: 1rem;
}

/* Оптимизированные заголовки */
.post-title, .assessment-intro h2, h1 {
  font-size: var(--h1-desktop);
  line-height: 1.2;
  letter-spacing: -0.02em;
  max-width: 32ch;
  text-wrap: balance;
}

.section-header, .level-header, h2 {
  font-size: var(--h2-desktop);
  line-height: 1.3;
  letter-spacing: -0.01em;
}

.skills-group h4, h3 {
  font-size: var(--h3-desktop);
  line-height: 1.4;
}

/* Tablet */
@media screen and (max-width: 1199px) and (min-width: 768px) {
  .post-title, .assessment-intro h2, h1 { font-size: var(--h1-tablet); }
  .section-header, .level-header, h2 { font-size: var(--h2-tablet); }
  .skills-group h4, h3 { font-size: var(--h3-tablet); }
}

/* Mobile */
@media screen and (max-width: 767px) and (min-width: 481px) {
  .post-title, .assessment-intro h2, h1 { 
    font-size: var(--h1-mobile); 
    line-height: 1.25; 
    margin-bottom: 0.75rem; 
  }
  .section-header, .level-header, h2 { font-size: var(--h2-mobile); }
  .skills-group h4, h3 { font-size: var(--h3-mobile); }
}

/* Small Mobile */
@media screen and (max-width: 480px) {
  .post-title, .assessment-intro h2, h1 { 
    font-size: var(--h1-small); 
    line-height: 1.2; 
    word-break: break-word; 
    hyphens: auto; 
  }
  .section-header, .level-header, h2 { 
    font-size: var(--h2-small); 
    padding: 0.75rem 1rem; 
  }
  .skills-group h4, h3 { font-size: var(--h3-small); }
}

/* Улучшения читаемости */
.post-title, .assessment-intro h2, h1, h2, h3, h4 {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

/* Вспомогательные классы */
.mobile-title { display: none; }
@media screen and (max-width: 767px) {
  .desktop-title { display: none; }
  .mobile-title { display: block; }
}

EOF
    
    success "Стили оптимизации добавлены"
}

# Тестирование сборки
test_build() {
    log "Тестирование сборки Hugo..."
    
    # Пробуем собрать сайт
    if hugo --buildDrafts --buildFuture --gc --cleanDestinationDir --quiet; then
        success "Сборка прошла успешно"
        
        # Проверяем размеры CSS
        if [[ -f "public/css/extended/custom.css" ]]; then
            local css_size=$(stat -f%z "public/css/extended/custom.css" 2>/dev/null || stat -c%s "public/css/extended/custom.css" 2>/dev/null || echo "unknown")
            log "Размер CSS файла: $css_size байт"
        fi
        
        return 0
    else
        error "Сборка не удалась"
        return 1
    fi
}

# Проверка производительности
check_performance() {
    log "Проверка производительности..."
    
    # Проверяем размер файлов
    local css_size=$(stat -f%z "$CSS_FILE" 2>/dev/null || stat -c%s "$CSS_FILE" 2>/dev/null || echo "0")
    log "Размер CSS файла: $css_size байт"
    
    if [[ $css_size -gt 100000 ]]; then
        warning "CSS файл стал больше 100KB. Рассмотрите оптимизацию."
    fi
    
    # Минификация в production
    if [[ "${HUGO_ENVIRONMENT:-}" == "production" ]]; then
        log "Production режим: применяем минификацию"
        hugo --minify --gc --cleanDestinationDir
    fi
}

# Откат изменений
rollback() {
    local backup_dir="$1"
    
    if [[ ! -d "$backup_dir" ]]; then
        error "Директория бэкапа не найдена: $backup_dir"
        return 1
    fi
    
    warning "Выполняется откат изменений..."
    
    # Восстанавливаем файлы
    if [[ -f "$backup_dir/$(basename "$CSS_FILE")" ]]; then
        cp "$backup_dir/$(basename "$CSS_FILE")" "$CSS_FILE"
        success "CSS файл восстановлен"
    fi
    
    if [[ -f "$backup_dir/$(basename "$HUGO_CONFIG")" ]]; then
        cp "$backup_dir/$(basename "$HUGO_CONFIG")" "$HUGO_CONFIG"
        success "Hugo конфигурация восстановлена"
    fi
    
    # Тестируем после отката
    if test_build; then
        success "Откат выполнен успешно"
    else
        error "Проблемы после отката. Проверьте файлы вручную."
    fi
}

# Главная функция
main() {
    log "🚀 Запуск оптимизации заголовков DevOps Way"
    
    # Проверяем параметры
    case "${1:-apply}" in
        "rollback")
            if [[ -z "${2:-}" ]]; then
                error "Укажите путь к директории бэкапа: $0 rollback /path/to/backup"
                exit 1
            fi
            rollback "$2"
            exit $?
            ;;
        "apply")
            ;;
        *)
            echo "Использование:"
            echo "  $0 apply          - Применить оптимизации"
            echo "  $0 rollback DIR   - Откатить изменения из бэкапа"
            exit 1
            ;;
    esac
    
    # Проверки
    check_environment
    
    # Создаем бэкап
    create_backup
    
    # Применяем изменения
    if apply_optimizations; then
        log "Оптимизации применены"
    else
        error "Ошибка при применении оптимизаций"
        rollback "$BACKUP_DIR"
        exit 1
    fi
    
    # Тестируем
    if test_build; then
        log "Тестирование прошло успешно"
    else
        warning "Ошибки при сборке. Выполняется откат..."
        rollback "$BACKUP_DIR"
        exit 1
    fi
    
    # Проверка производительности
    check_performance
    
    success "🎉 Оптимизация заголовков завершена успешно!"
    echo
    echo "📁 Резервная копия: $BACKUP_DIR"
    echo "🔄 Для отката: $0 rollback $BACKUP_DIR"
    echo "📊 Рекомендации по контенту:"
    echo "   - Сократите длинные заголовки до 50-60 символов"
    echo "   - Рассмотрите альтернативные заголовки для мобильных"
    echo "   - Используйте классы .mobile-title/.desktop-title для разных версий"
    echo
    echo "🧪 Тестирование:"
    echo "   hugo server --buildDrafts"
    echo "   Проверьте на устройствах: 320px, 768px, 1200px+"
}

# Запуск
main "$@"
