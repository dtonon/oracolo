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

examples:
  cp index.html blank.html
  sed -i.bak "s/replace_with_your_npub/npub10pensatlcfwktnvjjw2dtem38n6rvw8g6fv73h84cuacxn4c28eqyfn34f/g" index.html && rm -f index.html.bak
  sed -i.bak 's/<meta name="top-notes" value="2" \/>/<meta name="top-notes" value="4" \/>/g' index.html && rm index.html.bak
  sed -i.bak 's/<meta name="short-notes" value="carousel" \/>/<meta name="short-notes" value="" \/>/g' index.html && rm index.html.bak
  ./build.js
  mv dist/index.html examples/opensats.html
  cp blank.html index.html
  sed -i.bak "s/replace_with_your_npub/npub1jlrs53pkdfjnts29kveljul2sm0actt6n8dxrrzqcersttvcuv3qdjynqn/g" index.html && rm -f index.html.bak
  sed -i.bak 's/<meta name="top-notes" value="2" \/>/<meta name="top-notes" value="2" \/>/g' index.html && rm index.html.bak
  sed -i.bak 's/<meta name="topics" value="" \/>/<meta name="topics" value="coracle, privacy, nostr" \/>/g' index.html && rm index.html.bak
  ./build.js
  mv dist/index.html examples/hodlbod.html
  cp blank.html index.html
  sed -i.bak "s/replace_with_your_npub/npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6/g" index.html && rm -f index.html.bak
  sed -i.bak 's/<meta name="top-notes" value="2" \/>/<meta name="top-notes" value="0" \/>/g' index.html && rm index.html.bak
  sed -i.bak 's/<meta name="short-notes" value="carousel" \/>/<meta name="short-notes" value="main" \/>/g' index.html && rm index.html.bak
  sed -i.bak 's/<meta name="topics" value="" \/>/<meta name="topics" value="nostr, bitcoin, economics" \/>/g' index.html && rm index.html.bak
  ./build.js
  mv dist/index.html examples/fiatjaf.html
  cp blank.html index.html
  rm blank.html

fullbuild: examples build
