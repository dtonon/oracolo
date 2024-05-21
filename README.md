# Oracolo

Oracle is a minimalist blog powered by [Nostr](https://njump.me), that consists of a single html file, weighing only ~140Kb. It works also without a web server; for example you can send it via email as a business card.

![Oracolo preview](docs/oracolo.jpg)

## Examples
Here you can find some generated blogs for [OpenSats](https://raw.githack.com/dtonon/oracolo/master/examples/opensats.html), [Hodlbod](https://raw.githack.com/dtonon/oracolo/master/examples/hodlbod.html) and [fiatjaf](https://raw.githack.com/dtonon/oracolo/master/examples/fiatjaf.html).

## How to use - Standard mode

1) Replace your hex public key in src/config.ts
2) Run `npm install`
3) Run `npm run build`
4) Deploy the generated dist/index.html file

## How to use - "I hate npm" mode

1) Open template/index.html with a text editor
2) Find 'replace_with_your_hex_public_key'
3) Replace it with... your hex public key :)
4) Save the file and deploy

## Why this ugly hash routing?

Because this way the blog has fully functioning permalinks, without needing any additional server-level configuration to capture all the urls.

## Caveats / To do

SEO is currently not existent, work in progress.  
No pagination in the home.