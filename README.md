# Oracolo

## A Nostr blog in a single html file + A dynamic blog service

Oracolo is a minimalist blog powered by [Nostr](https://njump.me), that consists of a single html file, weighing only ~500Kb.
You can use whatever Nostr client that supports long format ([habla.news](https://habla.news), [yakihonne](https://yakihonne.com), [highlighter.com](https://highlighter.com), etc) to write your articles and your personal blog is automatically updated. You can also post notes and images!

You are allowed to design the structure of the homepage using "content blocks", and this can be achieved simply by using some `<meta>` tags at the beginning of the file (see below for more info). But don't worry, Oracolo is also a wizard that lets you do this without touching any code.

The HTML produced works also without a web server; for example, you can send it via email as a business card!

Finally, Oracolo is a web service. In fact it contains a server that permits to dynamically create blogs for any Nostr user. Read more below.

https://github.com/user-attachments/assets/a7db3f59-e676-469f-a3d7-c2a5c7b8d18f

## How to use

The easiest option is to visit https://oracolo.me and use the wizard to configure your blog. At the end, you can download the single HTML file, ready to upload on your hosting, or use the free Oracolo service and just point your DNS to it.

If you prefer to work with the code you can download `index.html` from the releases, configure the author and the block structure using the [configuration](#configuration) docs.

Finally you can also create [your own](#the-blog-engine) Oracolo blog service.

## Configuration

The basic configuration is a simple meta tag that specifices the author:

```html
<meta name="author" content="npub1xxxx.....">
```

There are then some optional tags:

```html
<!-- Show a menu with the selected topics, every topic loads only events with the relative tag  -->
<meta name="topics" content="topic1,topic2,topic3">

<!-- Enable comments at the bottom of the articles, with NIP-7 + NIP-46 login; -->
<meta name="comments" content="yes">

<!-- Overwrite the relays fetched using the Outbox model with hardcoded ones -->
<meta name="relays" content="my-alt-relay.com,backup-relay.com">
```

Finally the homepage structure can be configured using "blocks". There are 3 types of blocks:

| Type | Description | Nostr kind |
| - | - | - |
| `articles` | Long form articles | 30023 |
| `notes` | Short notes | 1 |
| `images` | Images | 20 |

Every block can have different styles of visualization:

| Style | Description | Available for |
| - | - | - |
| `list` | Basic vertical listing | Articles and notes |
| `grid` | Grid structure with two columns | Articles, notes and images |
| `slide` | Horizontal carousel with 3 elements | Notes |

The meta tag that defines a block has the following structure:

```html
<!-- Elements that end with ? are optional -->
<meta name="block:<type>" content="<num?>-<style>-<mXXX?>">
```

Where:
| Param | Description |
| - | - |
|`<num>`| The number of events to show |
|`<style>`| The style (list, grid, slide) |
|`<mXXXX>`| The minimum lenght that an event must have to be included |

For example:

```html
<!-- A grid with 5 articles -->
<meta name="block:articles" content="5-grid">

<!-- A carousel with 10 notes that have at least 500 characters -->
<meta name="block:notes" content="10-slide-m500">

<!-- A grid of 20 images -->
<meta name="block:images" content="20-grid">
```

You can also pin one or more events replacing the `<num>` param with the char `i` followed by the last 4-6 characters of the event ID, for example:

```html
<!-- A grid with 2 pinned articles -->
<meta name="block:articles" content="i1234-i5678-grid">
```

## The blog engine

Intead of using the single html file you can deploy the full app. It creates a web server that uses the chained subdomains of the main domain as config params, and so this avoid the necessity to manually modify the html file. The resulting (long) domanin can be used as `cname` target for an external domain!

The configurarion is derived from the meta tag structure, a little compressed to optimize the characters use (domains have a limit of 255 total chars).
The first subdomain on the left should be the npub, the you can have the configuration params:

| Subdomain starts with |  |
| - | - |
| `ba-` | Add a block of articles |
| `bn-` | Add a block of short notes |
| `bi-` | Add a block of images |
| `t-` | Create a menu with some topics |
| `c-` | Enable comments at the end of the content |

After the prefix you can happend the same content used in the meta tags. For example:

```
http://npub1jlrs53pkdfjnts29kveljul2sm0actt6n8dxrrzqcersttvcuv3qdjynqn.ba-2.ba-ib07ef.bn-slide-m400.ba-2.ba-10-list.t-nostr-groups-relays-nip44.c.localhost:45070
```
| Param | Generates |
| - | - |
| `ba-2` | 2 articles with grid style (is the default, so can be omitted) |
| `ba-ib07ef` | Pinned event |
| `bn-slide-m400` | Slide of notes with lenght min of 400 chars |
| `ba-2` | 2 more articles |
| `ba-10-list` | 10 more articles, as list |
| `t-nostr-groups-relays-nip44` | Show a top menu with these topics |
| `c` | Enable comments |

See the live version [here](http://npub1jlrs53pkdfjnts29kveljul2sm0actt6n8dxrrzqcersttvcuv3qdjynqn.ba-2.ba-ib07ef.bn-slide-m400.ba-2.ba-10-list.topics-nostr-groups-relays-nip44.oracolo.me)!

# Building

If you want to build the HTML file locally (for example if you have
made local changes to the code), you can run the local server which
will help you generate the static file for download.

First install dependencies. If you are on macOS, use homebrew:

```bash
brew install just fd go
go install github.com/joho/godotenv/cmd/godotenv@latest
```

Then you can run the server:

```bash
touch .env
BASE_DOMAIN=localhost:45070 just dev
```

This server will serve the static generator, where you can download the final index.html.
