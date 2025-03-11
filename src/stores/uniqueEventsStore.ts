import { writable } from 'svelte/store';

function createUniqueEventsStore() {
	const { subscribe, update, set } = writable({
		ids: new Set<string>(),
		displayedEvents: [] as any[]
	});

	return {
		subscribe,
		addDisplayedEvents: (events: any[]) => {
			update((store) => {
				// Create a new Set to avoid mutating the original
				const newIds = new Set(store.ids);

				// Add new event IDs to the set
				events.forEach((event) => newIds.add(event.id));

				// Append new events to displayed events
				const newDisplayedEvents = [
					...store.displayedEvents,
					...events.filter((event) => !store.ids.has(event.id))
				];

				return {
					ids: newIds,
					displayedEvents: newDisplayedEvents
				};
			});
		},
		hasBeenDisplayed: (eventId: string) => {
			let isDisplayed = false;

			// Use get method instead of update to avoid side effects
			const unsubscribe = uniqueEventsStore.subscribe((store) => {
				isDisplayed = store.ids.has(eventId);
			});

			// Immediately unsubscribe to prevent memory leaks
			unsubscribe();

			return isDisplayed;
		},
		getDisplayedEventsCount: () => {
			let count = 0;
			const unsubscribe = subscribe((store) => {
				count = store.displayedEvents.length;
			});
			unsubscribe();
			return count;
		},
		reset: () => set({ ids: new Set<string>(), displayedEvents: [] })
	};
}

export const uniqueEventsStore = createUniqueEventsStore();
