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
	let relays = relaysMeta
		?.getAttribute?.('value')
		?.split(',')
		.map((url) => url.trim());
	if (!relays || relays.length === 0) {
		relays = (await loadRelayList(decode(npub).data as string)).items
			.filter((r) => r.write)
			.map((r) => r.url);
	}

	const topNotes = parseFloat(topNotesMeta?.getAttribute?.('value') || '2') || 2;
	const shortNotesMinChars =
		parseFloat(shortNotesMinCharsMeta?.getAttribute?.('value') || '800') || 800;
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
	const shortFeedSummaryMaxChars =
		parseFloat(shortFeedSummaryMaxCharsMeta?.getAttribute?.('value') || '400') || 400;
	const topics =
		topicsMeta
			?.getAttribute?.('value')
			?.split(',')
			.map((item) => item.trim())
			.filter((item) => item !== '') || [];
	const comments = (commentsMeta?.getAttribute?.('value') || 'yes') === 'yes' ? true : false;

	return {
		npub,
		relays,
		topNotes,
		shortNotesMinChars,
		shortNotes,
		shortFeedSummaryMaxChars,
		topics,
		comments
	};
}
