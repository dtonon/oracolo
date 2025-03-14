import { type NostrEvent } from '@nostr/tools/core';
import { uniqueEventsStore } from './stores/uniqueEventsStore';
import { processUsersEntities, processEventsEntities, cleanMarkdownLinks } from './utils.js';

async function renderEventContent(event: NostrEvent) {
	let updatedEventContent = event.content;
	updatedEventContent = await processUsersEntities(updatedEventContent);
	updatedEventContent = processEventsEntities(updatedEventContent);
	updatedEventContent = cleanMarkdownLinks(updatedEventContent);
	event.content = updatedEventContent;
	return event;
}

export function filterEvents(
	items: NostrEvent[],
	kinds: number[],
	minChars: number,
	count: number = 10,
	renderContentBeforeCount: boolean,
	ids: string[] = []
): NostrEvent[] {
	// Filter out already displayed events and match kinds
	let filteredEvents = items;

	filteredEvents = filteredEvents
		.filter((item) => !uniqueEventsStore.hasBeenDisplayed(item.id))
		.filter((item) => kinds.includes(item.kind));

	if (ids.length > 0) {
		let foundEvent: NostrEvent | undefined;
		if (ids.length == 1) {
			// Performance tweak using find
			foundEvent = filteredEvents.find((event) => event.id.endsWith(ids[0]));
			if (foundEvent) {
				filteredEvents = [foundEvent];
			}
		} else {
			filteredEvents = filteredEvents.filter((event) => ids.some((id) => event.id.endsWith(id)));
		}
	}

	filteredEvents = filteredEvents.filter((item) => kinds.includes(item.kind));

	// If rendering content is required, process it
	if (renderContentBeforeCount) {
		// This is where we have the async problem
		filteredEvents = filteredEvents.map((event) => {
			try {
				// We can't synchronously await here
				renderEventContent(event);
				return event;
			} catch (error) {
				console.warn('Event content processing failed:', error);
				return event;
			}
		});
	}

	// Apply additional filters
	filteredEvents = filteredEvents.filter((item) => item.content.length >= minChars).slice(0, count);

	// Add to displayed events
	if (filteredEvents.length > 0) {
		uniqueEventsStore.addDisplayedEvents(filteredEvents);
	}

	return filteredEvents;
}
