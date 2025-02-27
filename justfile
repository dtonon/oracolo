export PATH := "./node_modules/.bin:" + env_var('PATH')

dev:
  #!/usr/bin/env bash
  for jsfile in $(fd --base-directory src --regex 'svelte|ts'); do
    if [ "src/$jsfile" -nt dist/index.html ]; then
      vite build --mode development
      break
    fi
  done
  templ generate
  go build
  godotenv ./oracolo

build:
  vite build
  templ generate
  go build -ldflags='-s -w'

examples:
  cp index.html blank.html
  sed -i.bak "s/replace_with_your_npub/npub10pensatlcfwktnvjjw2dtem38n6rvw8g6fv73h84cuacxn4c28eqyfn34f/g" index.html && rm -f index.html.bak
  sed -i.bak 's/<meta name="top-notes" value="2" \/>/<meta name="top-notes" value="4" \/>/g' index.html && rm index.html.bak
  sed -i.bak 's/<meta name="short-notes" value="carousel" \/>/<meta name="short-notes" value="" \/>/g' index.html && rm index.html.bak
  vite build
  mv dist/index.html examples/opensats.html
  cp blank.html index.html
  sed -i.bak "s/replace_with_your_npub/npub1jlrs53pkdfjnts29kveljul2sm0actt6n8dxrrzqcersttvcuv3qdjynqn/g" index.html && rm -f index.html.bak
  sed -i.bak 's/<meta name="top-notes" value="2" \/>/<meta name="top-notes" value="2" \/>/g' index.html && rm index.html.bak
  sed -i.bak 's/<meta name="topics" value="" \/>/<meta name="topics" value="coracle, privacy, nostr" \/>/g' index.html && rm index.html.bak
  vite build
  mv dist/index.html examples/hodlbod.html
  cp blank.html index.html
  sed -i.bak "s/replace_with_your_npub/npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6/g" index.html && rm -f index.html.bak
  sed -i.bak 's/<meta name="top-notes" value="2" \/>/<meta name="top-notes" value="0" \/>/g' index.html && rm index.html.bak
  sed -i.bak 's/<meta name="short-notes" value="carousel" \/>/<meta name="short-notes" value="main" \/>/g' index.html && rm index.html.bak
  sed -i.bak 's/<meta name="topics" value="" \/>/<meta name="topics" value="nostr, bitcoin, economics" \/>/g' index.html && rm index.html.bak
  vite build
  mv dist/index.html examples/fiatjaf.html
  cp blank.html index.html
  rm blank.html

fullbuild: examples build
