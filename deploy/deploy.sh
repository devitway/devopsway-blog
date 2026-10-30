#!/usr/bin/env bash
# deploy.sh – собрать блог из origin/main и атомарно подменить опубликованную версию.
# Живёт на bots в /opt/devopsway-blog/bin/deploy.sh (копия, не из src: ключ GitHub Actions
# с command= запускает только её). Ручной запуск: /opt/devopsway-blog/bin/deploy.sh
set -euo pipefail
D=/opt/devopsway-blog
HUGO_IMAGE=ghcr.io/gohugoio/hugo:v0.161.1
KEEP=3
BUILD=devopsway-blog-build   # имя контейнера сборки: обрыв деплоя не оставляет его висеть с блокировкой hugo

exec 9>"$D/.lock"
flock 9
docker rm -f "$BUILD" >/dev/null 2>&1 || true

cd "$D/src"
git fetch -q origin main
git reset -q --hard origin/main
git submodule update -q --init --recursive

rev=$(git rev-parse --short HEAD)
rel="releases/$rev-$(date +%Y%m%d%H%M%S)"
mkdir -p "$D/$rel"
# оборванная сборка (ошибка, обрыв ssh) не оставляет недособранный релиз
ok=0
trap 'docker rm -f "$BUILD" >/dev/null 2>&1 || true; [ "$ok" = 1 ] || rm -r -- "${D:?}/$rel"' EXIT
trap 'exit 1' HUP INT TERM

timeout 300 docker run --rm --name "$BUILD" -u "$(id -u):$(id -g)" -e HUGO_ENVIRONMENT=production \
  -v "$D/src:/project" -v "$D/$rel:/out" -w /project \
  --entrypoint hugo "$HUGO_IMAGE" \
  --minify --gc --destination /out --cacheDir /tmp/hugo_cache

test -s "$D/$rel/index.html"
test -s "$D/$rel/404.html"

ln -sfn "$rel" "$D/html.new"
mv -Tf "$D/html.new" "$D/html"
ok=1

ls -1dt "$D"/releases/*/ | tail -n +$((KEEP + 1)) | xargs -r rm -r --
echo "published $rev -> $rel"
