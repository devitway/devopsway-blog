---
title: "Git Mastery — серия из 9 уроков + Challenge"
description: "От SSH-ключа до worktree и bisect. Каждый урок sandbox-verified, с артефактом в ~/.gitconfig и мини-тестом."
---

## О серии

9 уроков от базовых операций до продвинутых инструментов. Каждый урок:

- проверен в sandbox (все bash-блоки исполняемы)
- даёт конкретный артефакт: алиас, конфиг, скрипт
- содержит мини-тест с ответами
- занимает 30--60 минут

## Карта серии

| Урок | Тема | Ключевой навык | SFIA |
|------|------|----------------|------|
| [День 0: SSH](/posts/day-00-ssh/) | Ключи, агент, config | `ssh -T git@github.com` без пароля | 2 |
| [День 1: Три состояния](/posts/day-01-three-states/) | working / staging / committed | `git add -p` вместо `git add .` | 2 |
| [День 2: Восстановление](/posts/day-02-reset-recovery/) | reflog, fsck, reset | Найти потерянный коммит за 2 команды | 2 |
| [День 3: Ветки и merge](/posts/day-03-branches-merge/) | ff vs --no-ff, конфликты, diff3 | Читать `git log --graph` | 3 |
| [День 4: Rebase](/posts/day-04-rebase/) | rebase vs merge, interactive, golden rule | Чистить коммиты перед PR через `rebase -i` | 3 |
| [День 5: Hooks](/posts/day-05-hooks/) | pre-commit, commit-msg, core.hooksPath | Блокировать секреты до коммита | 3 |
| [День 6: Bisect](/posts/git-bisect/) | Бинарный поиск, bisect run, skip | Найти регрессию среди 1000 коммитов за 10 шагов | 2--3 |
| [День 7: Cherry-pick и rerere](/posts/git-cherrypick-rerere/) | Точечный перенос, память о конфликтах | Перенести hotfix между ветками | 2--3 |
| [День 8: Worktree](/posts/day-08-worktree/) | Параллельные рабочие деревья | Hotfix без `git stash` | 2--3 |
| [Challenge](/posts/git-master-final-challenge/) | 10 проблем в одном репозитории | Все навыки серии вместе | 3 |

## Порядок прохождения

Уроки выстроены последовательно: День 0 настраивает SSH, День 1 объясняет три состояния, День 2 показывает, как их восстановить. Дни 3--4 --- ветвление. Дни 5--8 --- продвинутые инструменты. Challenge проверяет всё вместе.

Можно начать с любого урока, но ссылки и мини-тесты предполагают знание предыдущих.

## Артефакты серии

После прохождения в вашем `~/.gitconfig` будут:

```ini
[alias]
    s  = status -sb
    d  = diff
    dc = diff --cached
    l  = log --oneline -10
    tree  = log --all --graph --decorate --oneline
    graph = log --all --graph --decorate --oneline
    undo  = reset --soft HEAD~1
    br = branch -vv
    rb  = rebase
    rbi = rebase -i
    rbc = rebase --continue
    rba = rebase --abort
    pick = cherry-pick --allow-empty --keep-redundant-commits
    wt  = worktree
    wta = worktree add
    wtl = worktree list
    wtr = worktree remove

[merge]
    conflictStyle = diff3
    ff = false

[pull]
    rebase = true
    ff = only

[rebase]
    autoStash = true

[rerere]
    enabled = true
    autoupdate = true
```

Плюс папка `.githooks/` с pre-commit, commit-msg и pre-push.
