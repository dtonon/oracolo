import { decode } from '@nostr/tools/nip19';
import { loadRelayList } from '@nostr/gadgets/lists';

export async function getConfig() {
	const authorMeta = document.querySelector('meta[name="author"]');
	const relaysMeta = document.querySelector('meta[name="relays"]');
	const topicsMeta = document.querySelector('meta[name="topics"]');
	const commentsMeta = document.querySelector('meta[name="comments"]');

	// Author
	// -------------------------------------------------------
	if (!authorMeta) {
		throw new Error('Missing meta tags for configuration');
	}
	const npub = authorMeta.getAttribute('content') as string;

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
		writeRelays = rl.filter((r) => r.write).map((r) => r.url);
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
	interface Config {
		count?: number;
		style?: string;
		minChars?: number;
		ids?: string[];
	}

	let blocks: { type: string; config: any }[] = [];
	const metaTags = document.querySelectorAll('meta');
	const PREFIX = 'block:';
	metaTags.forEach((meta) => {
		const name = meta.getAttribute('name');
		if (!name || !name.startsWith(PREFIX)) {
			return;
		}
		const type = name.substring(PREFIX.length);
		if (!['articles', 'notes', 'images'].includes(type)) {
			return;
		}
		const value = meta.getAttribute('content');
		const options = value ? value.split('-') : [];

		const config: Config = {
			ids: []
		};

		if (options.length > 0 && !isNaN(Number(options[0]))) {
			config.count = parseInt(options[0], 10);
			options.shift();
		}
		const styleIndex = options.findIndex((opt) => ['list', 'slide', 'grid'].includes(opt));
		if (styleIndex >= 0) {
			config.style = options[styleIndex];
			options.splice(styleIndex, 1);
		}
		options.forEach((opt) => {
			if (opt.startsWith('m') && !isNaN(Number(opt.substring(1)))) {
				config.minChars = parseInt(opt.substring(1), 10);
			}
			if (opt.startsWith('i')) {
				config.ids.push(opt.substring(1));
			}
		});
		blocks.push({
			type,
			config
		});
	});

	// Fallback if no blocks are present
	if (blocks.length == 0) {
		blocks.push({ type: 'articles', config: { count: 3, style: 'grid' } });
		blocks.push({ type: 'notes', config: { count: 10, style: 'slide', minChars: 400 } });
		blocks.push({ type: 'articles', config: { count: 2, style: 'grid' } });
		blocks.push({ type: 'images', config: { count: 10, style: 'grid' } });
		blocks.push({ type: 'articles', config: { count: 10, style: 'list' } });
		blocks.push({ type: 'articles', config: { count: 2, style: 'grid' } });
		blocks.push({ type: 'articles', config: { count: 30, style: 'list' } });
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

function parseNumber(metaTag: Element | null, defaultValue: number): number {
	const strValue = metaTag?.getAttribute?.('content');
	if (!strValue) return defaultValue;
	let value = parseFloat(strValue);
	if (isNaN(value)) return defaultValue;
	return value;
}
