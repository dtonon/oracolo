<script lang="ts">
	import { onMount } from 'svelte';
	import { type NostrEvent } from '@nostr/tools/core';
	import { uniqueEventsStore } from './stores/uniqueEventsStore';
	import { filterEvents } from './blockUtils.js';
	import { formatDate, getEventData } from './utils.js';

	// Block-specific props
	export let events: NostrEvent[] = [];
	export let count = 2;
	export let style = 'list';
	export let minChars = 0;
	export let ids: string[] = [];
	const kinds = [30023];

	onMount(() => {
		if (ids.length > 0) {
			style = 'highlight';
		}
	});

	// Reactive statement to filter events
	$: filteredItems = filterEvents(events, kinds, minChars, count, false, ids).map(getEventData);
</script>

<div class="articles-container">
	{#if style === 'highlight'}
		<div class="top-notes {filteredItems.length % 2 !== 0 ? 'odd' : ''}">
			{#each filteredItems as event}
				<div class="note">
					<a href={`#${event.id}`}>
						<!-- svelte-ignore a11y-missing-attribute -->
						<img src={event.image} />
						<div class="title">{event.title}</div>
					</a>
					{#if event.summary}
						<div class="summary">{@html event.summary}</div>
					{/if}
					<div>
						<span class="date">{formatDate(event.created_at)}</span>
						{#if ids.length > 0}
							<span class="pinned">- 📌 Pinned </span>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{:else if style === 'list'}
		<div class="listing-notes">
			<ul>
				{#each filteredItems as event}
					<li>
						<h2><a href={`#${event.id}`}>{event.title}</a></h2>
						{#if event.summary}
							<div class="summary">{event.summary}</div>
						{/if}
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>
