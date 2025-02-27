import { decode } from '@nostr/tools/nip19';
import { loadRelayList } from '@nostr/gadgets/lists';

export async function getConfig() {
	const authorMeta = document.querySelector('meta[name="author"]');
	const relaysMeta = document.querySelector('meta[name="relays"]');
	const topNotesMeta = document.querySelector('meta[name="top-notes"]');
	const shortNotesMeta = document.querySelector('meta[name="short-notes"]');
	const shortNotesMinCharsMeta = document.querySelector('meta[name="short-notes-min-chars"]');
	const shortFeedSummaryMaxCharsMeta = document.querySelector(
		'meta[name="short-notes-summary-max-chars"]'
	);
	const topicsMeta = document.querySelector('meta[name="topics"]');
	const commentsMeta = document.querySelector('meta[name="comments"]');

	if (!authorMeta) {
		throw new Error('Missing meta tags for configuration');
	}

	const npub = authorMeta.getAttribute('value') as string;

	let readRelays: string[] = [];
	let writeRelays: string[] = [];
	const relays = relaysMeta
		?.getAttribute?.('value')
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

	const shortNotes = (() => {
		switch (shortNotesMeta?.getAttribute?.('value') || 'carousel') {
			case 'carousel':
				return 'carousel';
			case 'main':
				return 'main';
			default:
				return '';
		}
	})();
	const topNotes = parseNumber(topNotesMeta, 2);
	const shortNotesMinChars = parseNumber(shortNotesMinCharsMeta, 800);
	const shortFeedSummaryMaxChars = parseNumber(shortFeedSummaryMaxCharsMeta, 400);
	const topics =
		topicsMeta
			?.getAttribute?.('value')
			?.split(',')
			.map((item) => item.trim())
			.filter((item) => item !== '') || [];
	const comments = (commentsMeta?.getAttribute?.('value') || 'yes') === 'yes' ? true : false;

	return {
		npub,
		readRelays,
		writeRelays,
		topNotes,
		shortNotesMinChars,
		shortNotes,
		shortFeedSummaryMaxChars,
		topics,
		comments
	};
}

function parseNumber(metaTag: Element | null, defaultValue: number): number {
	const strValue = metaTag?.getAttribute?.('value');
	if (!strValue) return defaultValue;
	let value = parseFloat(strValue);
	if (isNaN(value)) return defaultValue;
	return value;
}
