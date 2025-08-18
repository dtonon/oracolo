export PATH := "./node_modules/.bin:" + env_var('PATH')

watch:
  #!/usr/bin/env bash
  go build -tags=dev
  godotenv ./oracolo &
  pid1=$!
  ./build.js watch &
  pid2=$!
  trap "kill $pid1 $pid2" SIGINT SIGTERM SIGQUIT EXIT
  wait

dev:
  #!/usr/bin/env bash
  for jsfile in $(fd --base-directory src --regex 'svelte|ts'); do
    if [ "src/$jsfile" -nt dist/out.js ]; then
      ./build.js
      break
    fi
  done
  go build
  godotenv ./oracolo

build:
  ./build.js prod
  CGO_ENABLED=1 GOOS=linux GOARCH=amd64 CC=$(which musl-gcc) go build -ldflags="-s -w -linkmode external -extldflags '-static'"

deploy target: build
    scp oracolo {{target}}:oracolo/oracolo-new
    ssh {{target}} 'systemctl stop oracolo'
    ssh {{target}} 'mv oracolo/oracolo-new oracolo/oracolo'
    ssh {{target}} 'systemctl start oracolo'
