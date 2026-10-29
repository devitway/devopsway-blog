---
title: "zellij пошагово: рабочий терминал на сервере, который переживает обрыв ssh"
date: 2026-10-29T17:51:00+03:00
lastmod: 2026-10-29T17:51:00+03:00
draft: false
categories: ["DevOps основы"]
tags: ["zellij", "terminal", "ssh", "tmux", "fzf", "linux", "devops"]
author: "DevOps Way"
description: "Пошаговая сборка рабочего места на zellij 0.45.1: установка с проверкой контрольной суммы, панели и вкладки, раскладка файлом, detach/attach, воскрешение сессии после падения сервера, автоматическое переподключение при обрыве ssh и меню сессий на fzf. Каждая команда прогнана на чистой Ubuntu 22.04."
showToc: true
TocOpen: false
hidemeta: false
comments: true
disableHLJS: false
---

В посте ["Из браузера в терминал"](https://t.me/DevITWay/232) было обещание: наберутся реакции – будет пошаговая статья. Реакции набрались, вот статья.

К концу на сервере будет свой zellij: панели и вкладки, рабочее место из файла раскладки, отключение без потери работы, воскрешение сессии после падения сервера, переподключение при обрыве ssh и меню сессий по Alt s. Нужен только опыт работы с ssh, с tmux и screen можно не быть знакомым.

Всё ниже прогнано на чистой Ubuntu 22.04 с zellij 0.45.1, последним релизом на конец октября 2026. Клавиши даны для пресета Default. Поведение, взятое из исходников, помечено файлом из тега `v0.45.1`.

## Установка

В репозиториях Ubuntu 22.04 zellij нет. Проще всего взять готовый статический бинарь из релиза на GitHub:

```bash
V=0.45.1
A=zellij-x86_64-unknown-linux-musl      # на ARM: zellij-aarch64-unknown-linux-musl
cd /tmp
curl -fsSLO https://github.com/zellij-org/zellij/releases/download/v$V/$A.tar.gz
curl -fsSLO https://github.com/zellij-org/zellij/releases/download/v$V/$A.sha256sum
tar -xzf $A.tar.gz
echo "$(cut -d' ' -f1 $A.sha256sum)  zellij" | sha256sum -c -
install -D -m 755 zellij ~/.local/bin/zellij
```

Обычный `sha256sum -c $A.sha256sum` здесь упадёт с `FAILED open or read`. В файле лежит хэш самого бинаря, записанный под путём сборки `target/x86_64-unknown-linux-musl/release/zellij`. Поэтому сначала распаковываем, потом сверяем хэш с распакованным `zellij` и ждём ответа `zellij: OK`.

В релизе есть ещё сборка `zellij-no-web-…` без встроенного веб-сервера, если он не нужен.

Ubuntu добавляет `~/.local/bin` в PATH из `~/.profile`, и только если каталог существовал на момент входа. Каталог только что создан, поэтому перед проверкой версии перелогиньтесь или выполните `source ~/.profile`:

```bash
zellij --version
# zellij 0.45.1
```

Команда, выполненная по ssh без входа в шелл (`ssh srv 'zellij ls'`), `~/.profile` не читает и ответит `command not found`. Поэтому в скриптах ниже PATH выставлен явно.

## Первый запуск и режимы

```bash
zellij
```

Первым откроется окно First Run Setup Wizard с выбором из двух пресетов:

| Пресет | Как входить в режимы | Кому подходит |
|---|---|---|
| Default | сразу Ctrl-клавишей: Ctrl p – панели, Ctrl t – вкладки | тем, кто не пользуется этими сочетаниями в шелле и редакторе |
| Unlock First | сначала Ctrl g, потом буква: Ctrl g p, Ctrl g t | тем, кому нужны Ctrl p, Ctrl n, Ctrl s в bash, vim или emacs |

В статье используется Default, он выбирается по Enter. Выбор сохранится в `~/.config/zellij/config.kdl`. Этот файл zellij создаёт уже при первом запуске, в нём полный конфиг со всеми клавишами. После выбора пресета zellij переписывает его, а прежнюю версию кладёт рядом как `config.kdl.bak`.

При каждом старте сессии поверх экрана выходит окно About Zellij с подсказкой дня. Esc его закрывает, Ctrl c отключает подсказки при старте. Закрыть его стоит сразу: пока оно на экране, у вкладки включён слой плавающих панелей, и Alt n откроет новую панель плавающей поверх экрана.

Строка статуса внизу показывает режимы и их клавиши, поэтому учить таблицу наизусть не нужно:

| Клавиша | Режим | Для чего |
|---|---|---|
| Ctrl p | PANE | панели |
| Ctrl t | TAB | вкладки |
| Ctrl n | RESIZE | размер панелей |
| Ctrl h | MOVE | перестановка панелей |
| Ctrl s | SCROLL | прокрутка и поиск по выводу |
| Ctrl o | SESSION | отключиться, менеджер сессий |
| Ctrl b | TMUX | клавиши в духе tmux: `"`, `%`, `c`, `n`, `p` |
| Ctrl g | LOCKED | все клавиши, кроме Ctrl g, уходят программе в панели |
| Ctrl q | – | выйти из zellij и убить сессию, об этом ниже |

Из любого режима в обычный возвращают Esc или Enter.

У Default есть цена: Ctrl p в bash – предыдущая команда, а zellij перехватывает его раньше. Когда сочетание нужно программе внутри панели, нажмите Ctrl g. Строка статуса покажет `-- INTERFACE LOCKED --`, Ctrl p уйдёт в bash, а повторный Ctrl g снимет блокировку.

Если вы на macOS, Alt-сочетания доходят до сервера, только когда Option в терминале работает как Meta (в iTerm2 это настройка Esc+ для клавиши Option).

## Панели и вкладки

| Действие | Клавиши |
|---|---|
| Новая панель, zellij сам выберет место | Alt n или Ctrl p n |
| Новая панель справа / снизу | Ctrl p r / Ctrl p d |
| Перейти в соседнюю панель | Alt + стрелка или Alt h/j/k/l |
| Закрыть панель | Ctrl p x |
| Развернуть панель на всю вкладку и обратно | Ctrl p f |
| Показать или скрыть плавающие панели | Alt f или Ctrl p w |
| Сделать текущую панель плавающей и вернуть обратно | Ctrl p e |
| Новая панель в стопку | Ctrl p s |
| Переименовать панель | Ctrl p c, имя, Enter |
| Изменить размер | Ctrl n и стрелки, или Alt + и Alt - |
| Новая вкладка | Ctrl t n |
| Переименовать вкладку | Ctrl t r, имя, Enter |
| Вкладка по номеру | Ctrl t 1…9 |
| Предыдущая открытая вкладка | Ctrl t Tab |
| Закрыть вкладку | Ctrl t x |
| Поиск по выводу панели | Ctrl s s, текст, Enter; n и p – следующее и предыдущее совпадение; Ctrl c – вернуться |

Несколько деталей, которые видно только в работе:

- Alt l в самой правой панели переходит на следующую вкладку, с последней вкладки – на первую. Alt h работает так же влево.
- Если плавающих панелей во вкладке ещё нет, первое Ctrl p w или Alt f создаёт новую плавающую.
- В стопке видна целиком одна панель, от остальных остаются строки заголовков. Это удобно, когда панелей много, а экран маленький.
- Alt + растит текущую панель: соседние сворачиваются в стопку, после нескольких нажатий панель занимает всю вкладку. Alt - уменьшает её обратно.

## Сессии: отключиться и вернуться

Сессия – это сервер zellij со всеми вкладками и процессами внутри. Без имени zellij придумает случайное (`loyal-yak`, `splendid-peach`), своё задаётся ключом `-s`:

```bash
zellij -s work
```

В сессии запустите что-нибудь долгое, например `sleep 100000`, и отключитесь: Ctrl o d. Терминал вернётся в шелл с сообщением `Bye from Zellij!`, а процесс продолжит работать:

```bash
zellij ls -n                 # список сессий; -n – без цветов, удобно для скриптов
# work [Created 25s ago]
pgrep -a -x sleep
# 2508457 sleep 100000
zellij attach work           # вернуться: вкладки, панели и sleep на месте
```

Остальные команды для сессий:

```bash
zellij attach -c work        # подключиться, а если сессии нет – создать
zellij kill-session work     # остановить сервер: процессы умрут, раскладка останется
zellij delete-session work   # удалить остановленную сессию совсем
```

Изнутри сессии список всех сессий с числом вкладок и подключённых клиентов открывает Ctrl o w (Session Manager).

## Ctrl q и правка конфига

По умолчанию Ctrl q в zellij – `Quit` (`zellij-utils/assets/config/default.kdl:198`): все процессы сессии завершаются. После этого `zellij ls` покажет `work [...] (EXITED - attach to resurrect)`. Вкладки вернуть можно, но всё запущенное придётся поднимать заново. Ctrl q стоит переназначить на отключение раньше, чем он сработает случайно:

```bash
sed -i 's/bind "Ctrl q" { Quit; }/bind "Ctrl q" { Detach; }/' ~/.config/zellij/config.kdl
grep -n 'Ctrl q' ~/.config/zellij/config.kdl
# 174:        bind "Ctrl q" { Detach; }
```

Новые клавиши гарантированно подхватываются при следующем подключении: Ctrl o d, затем `zellij attach work`. После этого Ctrl q отключает от сессии, а `zellij ls` показывает её живой, без `EXITED`.

Остальное в `config.kdl` можно не трогать. В рабочем конфиге на главном сервере руками изменены ровно две строки, всё остальное записал мастер первого запуска:

```diff
-        bind "Ctrl q" { Quit; }
+        bind "Ctrl q" { Detach; }
+        bind "Alt s" { Run "/home/ubuntu/.local/bin/lc-pick" { floating true; close_on_exit true; name "сессии"; }; }
```

Про Alt s – в разделе о меню.

## Раскладка: рабочее место одной командой

Раскладка – это файл KDL с описанием вкладок, панелей и команд. Файлы из `~/.config/zellij/layouts/` можно вызывать по имени, например `~/.config/zellij/layouts/work.kdl` ниже вызывается как `work`:

```kdl
layout {
    default_tab_template {
        pane size=1 borderless=true {
            plugin location="zellij:tab-bar"
        }
        children
        pane size=2 borderless=true {
            plugin location="zellij:status-bar"
        }
    }
    tab name="код" focus=true cwd="~/project" {
        pane split_direction="vertical" {
            pane size="65%"
            pane command="git" {
                args "log" "--oneline" "-20"
            }
        }
    }
    tab name="сервер" {
        pane command="htop"
        pane command="df" size="30%" {
            args "-h"
        }
    }
}
```

`default_tab_template` – шаблон для каждой вкладки: сверху строка вкладок, снизу строка статуса, на месте `children` – панели самой вкладки. Без шаблона zellij откроет вкладки голыми, без этих двух строк. `pane command=` запускает программу вместо шелла. Когда программа завершается, панель остаётся на экране с кодом выхода в заголовке, например `git log --oneline -20 [ EXIT CODE: 0 ]`.

`~/project` замените на свой каталог. Если каталога нет, zellij ошибку не покажет и откроет панели в том каталоге, откуда запущен.

Запуск:

```bash
zellij -s dev -n work        # -n – раскладка по имени или по пути к файлу
```

Если сессия `dev` уже есть, zellij откажется: `Session with name "dev" already exists. Use attach command to connect to it or specify a different name.` Обёртка, которая сама выбирает между созданием и подключением, – в разделе о переподключении.

Рабочая раскладка на главном сервере короче. В ней одна вкладка, меню агентов, а остальные вкладки открываются из меню:

```kdl
layout {
    default_tab_template {
        pane size=1 borderless=true {
            plugin location="zellij:tab-bar"
        }
        children
        pane size=2 borderless=true {
            plugin location="zellij:status-bar"
        }
    }
    tab name="☰ меню (Alt-s)" focus=true {
        pane command="/home/ubuntu/.local/bin/lc-pick" {
            args "--loop"
        }
    }
}
```

## Воскрешение после падения сервера

Сохранение сессий включено по умолчанию (`zellij-server/src/screen.rs:8074`). Раз в 60 секунд (`zellij-server/src/background_jobs.rs:124`) zellij записывает раскладку сессии в `~/.cache/zellij/contract_version_1/session_info/<имя>/session-layout.kdl`: вкладки, панели, их каталоги и команды, запущенные в панелях. `sleep 100000`, набранный руками в шелле, попадает туда как команда панели:

```kdl
pane command="sleep" cwd="home/ubuntu/zellij-statya" size="50%" {
    args "100000"
    start_suspended true
}
```

Сохранить сразу, не дожидаясь минуты:

```bash
zellij action save-session
```

Теперь уроним сервер. `zellij kill-session work` и `kill -9` процесса `zellij --server` ведут себя одинаково: процессы в панелях умирают вместе с сервером, а сессия остаётся в списке:

```bash
zellij ls -n
# work [Created 10s ago] (EXITED - attach to resurrect)
pgrep -a -x sleep | grep 100000 || echo "sleep умер вместе с сервером"
# sleep умер вместе с сервером
```

`zellij attach work` вернёт вкладки, панели и каталоги, но команды сразу не запустит. Из-за `start_suspended true` на месте каждой будет:

```text
Waiting to run: sleep 100000
<ENTER> run, <ESC> drop to shell, <Ctrl-c> exit
```

Чтобы запустить все команды сразу:

```bash
zellij attach -f work        # --force-run-commands
pgrep -a -x sleep | grep 100000
# 2513575 sleep 100000
```

PID новый: воскрешение запускает команды заново, прежние процессы погибли вместе с сервером. Состояние программ и вывод на экране пропадают, раскладка и каталоги остаются. Если сервер упал раньше первого сохранения, воскрешать нечего: сессия, созданная и убитая в первые секунды, из `zellij ls` пропадает целиком. Файл раскладки лежит в `~/.cache`, а сокеты сервера – в `/tmp/zellij-<uid>/`.

## Переподключение при обрыве ssh

Сама сессия на сервере обрыв переживает, ssh-клиент – нет. Его нужно запустить заново и снова подключиться. Это делают две маленькие обёртки: скрипт на сервере и функция на ноутбуке.

Скрипт на сервере, `~/.local/bin/work-attach`, выбирает одно из трёх действий:

```bash
#!/usr/bin/env bash
# work-attach – войти в zellij-сессию: создать, воскресить или подключиться
export PATH="$HOME/.local/bin:$PATH"
S="${1:-work}"
st=$(zellij ls -n 2>/dev/null | grep -E "^$S ")
if [ -z "$st" ]; then
  exec zellij -s "$S" -n work            # сессии нет – поднять из раскладки
elif echo "$st" | grep -q EXITED; then
  exec zellij attach -f "$S"             # сервер умер – воскресить и сразу запустить команды
else
  exec zellij attach "$S"                # живая – подключиться
fi
```

```bash
chmod +x ~/.local/bin/work-attach
```

Ветки нужны потому, что `zellij attach -c` создаёт сессию без раскладки, а `zellij -s` с раскладкой падает на существующем имени. `export PATH` стоит из-за того, что по ssh без входа в шелл `~/.local/bin` в PATH не попадает.

Функция на ноутбуке, в `~/.bashrc` или `~/.zshrc`. `srv` – хост из `~/.ssh/config`:

```bash
w() {
  while :; do
    ssh -t -o ServerAliveInterval=10 -o ServerAliveCountMax=3 srv "~/.local/bin/work-attach" && break
    echo "связь потеряна, переподключаюсь через 3 с (Ctrl-C – выход)"; sleep 3
  done
}
```

При отключении по Ctrl q zellij выходит с кодом 0, ssh возвращает 0, и цикл заканчивается. При обрыве ssh завершается с кодом 255, и цикл подключается снова.

Без `ServerAlive*` функция бесполезна при самом частом обрыве, когда сеть пропала, а TCP-соединение формально не закрыто. ssh тогда просто висит. Это проверялось так: ssh пускался через `socat`, который потом замораживался `kill -STOP`. С параметрами из функции (10 секунд × 3 проверки) новое соединение поднялось через 42 секунды после заморозки. С `ServerAliveInterval=0` ssh провисел почти три минуты без признаков жизни, после чего проверку остановили. Те же параметры можно прописать и для хоста в `~/.ssh/config`.

На главном сервере эта пара называется `lc` и `lc-attach` и устроена так же. Есть одно отличие: при подключении к живой сессии фокус сразу переходит на первую вкладку с меню, даже если отключались с другой:

```bash
#!/usr/bin/env bash
# lc-attach – вход в рабочее место: zellij-сессия "lc" (создать / подключиться / воскресить)
export PATH="$HOME/.local/bin:$PATH"
S="${LC_SESSION:-lc}"
st=$(zellij ls -n 2>/dev/null | grep -E "^$S ")
if [ -z "$st" ]; then
  exec zellij -s "$S" -n "$HOME/.config/zellij/layouts/lc.kdl"
elif echo "$st" | grep -q EXITED; then
  exec zellij attach -f "$S"
else
  ( sleep 1.5; zellij --session "$S" action go-to-tab 1 ) >/dev/null 2>&1 &
  exec zellij attach "$S"
fi
```

## Меню сессий на fzf

Когда сессий больше двух, удобно выбирать их из списка с поиском. fzf ставится из пакета (`sudo apt install fzf`, на Ubuntu 22.04 это версия 0.29) или бинарём из релиза на GitHub. Скрипт ниже проверен на 0.29 и 0.74.5.

`~/.local/bin/zpick`:

```bash
#!/usr/bin/env bash
# zpick – меню zellij-сессий на fzf.
# Enter – перейти, новое имя + Enter – создать, Esc – выход.
export PATH="$HOME/.local/bin:$PATH"
out=$(zellij ls -n 2>/dev/null | fzf --print-query --reverse --prompt='сессия> ' \
        --header='Enter – перейти · новое имя – создать · Esc – выход' \
        --preview='zellij -s {1} action list-tabs 2>/dev/null || echo "сервер не запущен, Enter воскресит"')
[ $? -eq 130 ] && exit 0
name=$(sed -n 2p <<<"$out" | awk '{print $1}')
name=${name:-$(sed -n 1p <<<"$out")}
[ -n "$name" ] || exit 0
if [ -n "$ZELLIJ" ]; then
  zellij action switch-session "$name"   # уже внутри zellij – переключиться
else
  exec work-attach "$name"               # из шелла – войти
fi
```

```bash
chmod +x ~/.local/bin/zpick
```

Справа в превью – вкладки выбранной сессии. `--print-query` нужен для новых сессий: если набрать имя, которого нет в списке, скрипт получит набранный текст и создаст сессию с этим именем. Внутри zellij переменная `ZELLIJ` задана, и скрипт переключает текущий терминал на другую сессию через `zellij action switch-session`. Той же командой создаётся сессия с новым именем (раскладка у неё стандартная, `work` применяется только при входе из шелла) и воскрешается остановленная.

Чтобы меню открывалось плавающим окном поверх любой вкладки, в `config.kdl` в блок `shared_except "locked" {` добавляется одна строка:

```kdl
        bind "Alt s" { Run "zpick" { floating true; close_on_exit true; name "сессии"; }; }
```

В пресете Default сочетание Alt s свободно. После переподключения к сессии Alt s открывает окно "сессии" со списком, выбор переключает сессию, окно закрывается само (`close_on_exit`).

На главном сервере то же меню (`lc-pick`) работает поверх реестра сессий агентов со всех четырёх серверов. Enter открывает сессию агента во вкладке или переходит в уже открытую. Есть клавиши завершить, скрыть и обновить, в превью – карточка сессии. Реестр – отдельный скрипт под эту задачу, поэтому здесь показан общий вариант над `zellij ls`. Принцип тот же: fzf над списком, Alt s через `Run`, вкладка меню в раскладке.

## Веб-клиент

В zellij встроен веб-сервер: сессию можно открыть из браузера. По умолчанию он выключен. Запускается командой `zellij web`, вход по токену из `zellij web --create-token`, слушает `127.0.0.1:8082` (`zellij-client/src/web_client/mod.rs:96-99`). Сессии, запущенные из терминала, в браузер по умолчанию не отдаются (`web_sharing`, по умолчанию `"off"`). Общий доступ для такой сессии включается в окне Share (Ctrl o s). В этой статье веб-клиент не прогонялся, подробности – в документации zellij.

## Шпаргалка

| Что | Как |
|---|---|
| Новая сессия с именем | `zellij -s work` |
| Сессия из раскладки | `zellij -s dev -n work` |
| Список сессий | `zellij ls -n` |
| Отключиться | Ctrl o d (после правки конфига – Ctrl q) |
| Подключиться | `zellij attach work` |
| Подключиться или создать | `zellij attach -c work` |
| Воскресить и сразу запустить команды | `zellij attach -f work` |
| Сохранить раскладку сессии сейчас | `zellij action save-session` |
| Остановить / удалить | `zellij kill-session work` / `zellij delete-session work` |
| Менеджер сессий | Ctrl o w |
| Заблокировать клавиши zellij | Ctrl g |
| Новая панель / перейти | Alt n / Alt + стрелки |
| Плавающие панели | Alt f |
| Вкладки | Ctrl t, затем n, r, x, 1…9 |
| Поиск по выводу | Ctrl s s |

Как к такому терминалу подключены RAG и общая память агентов, будет в отдельной статье.
