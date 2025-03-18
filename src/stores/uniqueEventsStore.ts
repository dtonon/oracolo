import type { NostrEvent } from '@nostr/tools/core';

const ids = new Set<string>();

export const uniqueEventsStore = {
	reset() {
		ids.clear();
	},
	addDisplayedEvents(events: NostrEvent[]) {
		for (let i = 0; i < events.length; i++) {
			let event = events[i];
			if (ids.has(event.id)) continue;

			ids.add(event.id);
		}
	},
	hasBeenDisplayed(eventId: string) {
		return ids.has(eventId);
	},
	getDisplayedEventsCount() {
		return ids.size;
	}
};
