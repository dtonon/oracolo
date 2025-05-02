import { decode } from '@nostr/tools/nip19';
import { loadRelayList } from '@nostr/gadgets/lists';

export type SiteConfig = {
  npub: string;
  readRelays: string[];
  writeRelays: string[];
  topics: string[];
  comments: boolean;
  blocks: Block[];
};

export type Block = {
  type: 'articles' | 'notes' | 'images';
  config: Config;
};

export interface Config {
  count: number;
  style: 'grid' | 'list' | 'slide' | 'board' | 'wall';
  minChars: number;
  ids?: string[];
}

export async function getConfig(): Promise<SiteConfig> {
  const authorMeta = document.querySelector('meta[name="author"]');
  const relaysMeta = document.querySelector('meta[name="relays"]');
  const topicsMeta = document.querySelector('meta[name="topics"]');
  const commentsMeta = document.querySelector('meta[name="comments"]');

  // Author
  // -------------------------------------------------------
  let npub: string;
  if (authorMeta) {
    npub = authorMeta.getAttribute('content') as string;
  } else {
    console.warn('Missing meta tags for configuration, using hodlbod as a fallback');
    npub = 'npub1jlrs53pkdfjnts29kveljul2sm0actt6n8dxrrzqcersttvcuv3qdjynqn';
  }

  // Relays
  // -------------------------------------------------------
  let readRelays: string[] = [];
  let writeRelays: string[] = [];
  const relays = relaysMeta
    ?.getAttribute?.('content')
    ?.split(',')
    .map((url) => url.trim());
  if (relays && relays.length > 0) {
    readRelays = relays;
    writeRelays = relays;
  } else {
    const rl = (await loadRelayList(decode(npub).data as string)).items;
    writeRelays = rl
      .filter((r) => r.write)
      .map((r) => r.url)
      .slice(0, 5);
    readRelays = rl.filter((r) => r.read).map((r) => r.url);
  }

  // Topics
  // -------------------------------------------------------
  const topics =
    topicsMeta
      ?.getAttribute?.('content')
      ?.split(',')
      .map((item) => item.trim())
      .filter((item) => item !== '') || [];

  // Comments
  const comments = (commentsMeta?.getAttribute?.('content') || 'no') === 'yes' ? true : false;

  // Blocks
  // -------------------------------------------------------
  let blocks: Block[] = [];
  const metaTags = document.querySelectorAll('meta');
  const PREFIX = 'block:';
  metaTags.forEach((meta) => {
    const name = meta.getAttribute('name');
    if (!name || !name.startsWith(PREFIX)) {
      return;
    }
    const value = meta.getAttribute('content');
    const options = value ? value.split('-') : [];

    let config: Config;
    const type = name.substring(PREFIX.length);
    switch (type) {
      case 'articles':
        config = { count: 2, minChars: 10, style: 'grid' };
        break;
      case 'notes':
        config = { count: 10, minChars: 0, style: 'list' };
        break;
      case 'images':
        config = { count: 10, minChars: 0, style: 'grid' };
        break;
      default:
        return;
    }

    if (options.length > 0 && !isNaN(Number(options[0]))) {
      config.count = parseInt(options[0], 10);
      options.shift();
    }
    const styleIndex = options.findIndex((opt) =>
      ['list', 'slide', 'grid', 'board', 'wall'].includes(opt)
    );
    if (styleIndex >= 0) {
      config.style = options[styleIndex] as Config['style'];
      options.splice(styleIndex, 1);
    }
    options.forEach((opt) => {
      if (opt.startsWith('m') && !isNaN(Number(opt.substring(1)))) {
        config.minChars = parseInt(opt.substring(1), 10);
      }
      if (opt.startsWith('i')) {
        config.ids = config.ids || [];
        config.ids.push(opt.substring(1));
      }
    });
    blocks.push({
      type: type as Block['type'],
      config
    });
  });

  // Fallback if no blocks are present
  if (blocks.length == 0) {
    blocks.push({ type: 'articles', config: { count: 3, style: 'grid', minChars: 10 } });
    blocks.push({ type: 'notes', config: { count: 10, style: 'slide', minChars: 400 } });
    blocks.push({ type: 'articles', config: { count: 2, style: 'grid', minChars: 10 } });
    blocks.push({ type: 'images', config: { count: 10, style: 'grid', minChars: 0 } });
    blocks.push({ type: 'articles', config: { count: 10, style: 'list', minChars: 0 } });
    blocks.push({ type: 'articles', config: { count: 2, style: 'grid', minChars: 0 } });
    blocks.push({ type: 'articles', config: { count: 30, style: 'list', minChars: 0 } });
  }

  return {
    npub,
    readRelays,
    writeRelays,
    topics,
    comments,
    blocks
  };
}
