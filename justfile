dev:
  npm run dev

build:
  npm run build

examples:
  cp index.html blank.html
  sed -i.bak "s/replace_with_your_npub/npub10pensatlcfwktnvjjw2dtem38n6rvw8g6fv73h84cuacxn4c28eqyfn34f/g" index.html && rm -f index.html.bak
  sed -i.bak 's/<meta name="top-notes" value="0" \/>/<meta name="top-notes" value="4" \/>/g' index.html && rm index.html.bak
  npm run build
  mv dist/index.html examples/opensats.html
  cp blank.html index.html
  sed -i.bak "s/replace_with_your_npub/npub1jlrs53pkdfjnts29kveljul2sm0actt6n8dxrrzqcersttvcuv3qdjynqn/g" index.html && rm -f index.html.bak
  sed -i.bak 's/<meta name="top-notes" value="0" \/>/<meta name="top-notes" value="2" \/>/g' index.html && rm index.html.bak
  sed -i.bak 's/<meta name="include-short" value="0" \/>/<meta name="include-short" value="500" \/>/g' index.html && rm index.html.bak
  npm run build
  mv dist/index.html examples/hodlbod.html
  cp blank.html index.html
  sed -i.bak "s/replace_with_your_npub/npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6/g" index.html && rm -f index.html.bak
  npm run build
  mv dist/index.html examples/fiatjaf.html
  cp blank.html index.html
  rm blank.html

fullbuild: examples build
