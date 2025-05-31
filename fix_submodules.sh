#!/bin/bash

echo "=== DevOps Way Blog - Исправление субмодулей ==="

# Проверяем текущий статус
echo "1. Проверяем текущее состояние..."
git status
echo ""

# Проверяем субмодули
echo "2. Проверяем субмодули..."
git submodule status
echo ""

# Проверяем .gitmodules
echo "3. Содержимое .gitmodules:"
cat .gitmodules
echo ""

# Проверяем папку themes
echo "4. Содержимое папки themes:"
ls -la themes/ || echo "Папка themes не существует"
echo ""

# Исправляем субмодули
echo "5. Исправляем субмодули..."

# Удаляем старые субмодули если есть
if [ -d "themes/PaperMod" ]; then
    echo "Удаляем существующую папку themes/PaperMod..."
    rm -rf themes/PaperMod
fi

# Очищаем git submodule cache
echo "Очищаем кэш субмодулей..."
git submodule deinit -f themes/PaperMod 2>/dev/null || true
git rm -f themes/PaperMod 2>/dev/null || true

# Создаем папку themes если не существует
mkdir -p themes

# Добавляем субмодуль заново
echo "Добавляем субмодуль PaperMod..."
git submodule add --force https://github.com/adityatelange/hugo-PaperMod.git themes/PaperMod

# Инициализируем и обновляем субмодули
echo "Инициализируем субмодули..."
git submodule update --init --recursive

# Проверяем результат
echo "6. Проверяем результат..."
echo "Статус субмодулей:"
git submodule status
echo ""
echo "Содержимое themes/PaperMod:"
ls -la themes/PaperMod/ | head -10
echo ""

# Тестируем Hugo
echo "7. Тестируем Hugo сборку..."
hugo version
echo ""

# Проверяем конфигурацию
echo "Проверяем конфигурацию Hugo..."
hugo config | head -20
echo ""

# Пробуем собрать сайт
echo "Пробуем собрать сайт..."
hugo --minify --cleanDestinationDir --gc

if [ $? -eq 0 ]; then
    echo "✅ Сборка успешна!"
    echo "Сайт собран в папку: public/"
    ls -la public/ | head -10
else
    echo "❌ Ошибка сборки"
    exit 1
fi

echo ""
echo "8. Коммитим изменения..."
git add .
git status

echo ""
echo "=== Готово! ==="
echo "Теперь выполните:"
echo "git commit -m 'Fix PaperMod submodule and Hugo config'"
echo "git push origin main"
