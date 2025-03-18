import { type NostrEvent } from '@nostr/tools/core';
import * as nip27 from '@nostr/tools/nip27';
import { uniqueEventsStore } from './stores/uniqueEventsStore';

// this function reads the event content progressively and exits early when the threshold has been met
// this may save us some nanoseconds.
function isLengthEqualOrGreaterThanThreshold(event: NostrEvent, threshold: number): boolean {
	let curr = 0;
	for (let block of nip27.parse(event.content)) {
		switch (block.type) {
			case 'text':
				curr += block.text.length;
			case 'url':
			case 'image':
			case 'video':
			case 'audio':
			case 'reference':
				// each one of these items are supposed to be parsed and rendered in a custom way
				// for the matter of counting the note size and filtering we will assign a static
				// "length-value" to each
				curr += 14;
		}

		if (curr >= threshold) {
			return true;
		}
	}

	return false;
}

export function filterEvents(
	items: NostrEvent[],
	kinds: number[],
	minChars: number,
	count: number = 10,
	renderContentBeforeCount: boolean,
	ids: string[] | undefined
): NostrEvent[] {
	// Filter out already displayed events and match kinds
	let filteredEvents = [];

	// If we have an id count we can't go over it anyway
	if (ids && ids.length < count) count = ids.length;

	for (let i = 0; i < items.length; i++) {
		let item = items[i];

		// Check if this hasn't been displayed before
		if (uniqueEventsStore.hasBeenDisplayed(item.id)) continue;

		// Check if kind matches
		if (!kinds.includes(item.kind)) continue;

		// Check if id matches
		if (ids && ids.every((idSuffix) => !item.id.endsWith(idSuffix))) continue;

		// Check min length
		if (minChars > 0) {
			if (renderContentBeforeCount) {
				if (!isLengthEqualOrGreaterThanThreshold(item, minChars)) continue;
			} else if (item.content.length < minChars) continue;
		}

		// This one passed all the filters:
		filteredEvents.push(item);

		// Exit early if we got everything we needed
		if (filteredEvents.length === count) {
			break;
		}
	}

	// Add to displayed events
	if (filteredEvents.length > 0) {
		uniqueEventsStore.addDisplayedEvents(filteredEvents);
	}

	return filteredEvents;
}
