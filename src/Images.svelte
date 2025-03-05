<script lang="ts">
	import { type NostrEvent } from '@nostr/tools/core';
	import { Splide, SplideSlide } from '@splidejs/svelte-splide';
	import '@splidejs/svelte-splide/css';
	import { filterEvents } from './blockUtils.js';
	import { formatDate, getEventData } from './utils.js';

	// Block-specific props
	export let events: NostrEvent[] = [];
	export let count = 10;
	export let style = 'list';
	export let minChars = 0;
	const kinds = [20];

	// Reactive statement to filter events
	$: filteredItems = filterEvents(events, kinds, minChars, count, true).map(getEventData);
</script>

<div class="notes-container">
	{#if style === 'grid'}
		<div
			class="images {filteredItems.length % 2 !== 0 ? 'odd' : ''} {filteredItems.length == 1
				? 'single'
				: ''}"
		>
			{#each filteredItems as event}
				<div class="note">
					<a href={`#${event.id}`}>
						<!-- svelte-ignore a11y-missing-attribute -->
						<img src={event.image} />
						{#if event.title}
							<div class="title">{event.title}</div>
						{/if}
					</a>
					<!-- {#if event.summary}
						<div class="summary">{@html event.summary}</div>
					{/if} -->
					<div class="date">{formatDate(event.created_at)}</div>
				</div>
			{/each}
		</div>
	{:else if style === 'list'}
		<div class="listing-notes">
			<ul>
				{#each filteredItems as event}
					<li>
						<h2><a href={`#${event.id}`}>{event.title}</a></h2>
						<div class="summary">{event.summary}</div>
					</li>
				{/each}
			</ul>
		</div>
	{:else if style === 'slide'}
		<Splide
			class="short-notes"
			options={{
				type: 'loop',
				gap: '1rem',
				pagination: false,
				perPage: 3,
				breakpoints: {
					640: {
						perPage: 2
					}
				},
				autoplay: true
			}}
		>
			{#each filteredItems as event}
				<SplideSlide>
					<a href={`#${event.id}`}>
						<div class="date">{formatDate(event.created_at, true)}</div>
						{event.summary}
					</a>
				</SplideSlide>
			{/each}
		</Splide>
	{/if}
</div>
