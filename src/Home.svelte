<script lang="ts">
	import { onMount } from 'svelte';
	import { Splide, SplideSlide } from '@splidejs/svelte-splide';
	import '@splidejs/svelte-splide/css';
	import { type NostrEvent } from '@nostr/tools/core';
	import { type Filter } from '@nostr/tools/filter';

	import { getConfig } from './config';
	import { pool } from '@nostr/gadgets/global';
	import { documentTitle } from './stores/documentTitleStore';
	import {
		isRootNote,
		getEventData,
		processUsersEntities,
		processEventsEntities,
		processAll,
		cleanMarkdownLinks,
		formatDate,
		getProfile
	} from './utils';
	import Loading from './Loading.svelte';
	import type { NostrUser } from '@nostr/gadgets/metadata';

	let events: NostrEvent[] = [];
	let shortEvents: NostrEvent[] = [];
	let eventIds = new Set();

	let npub = '';
	let topics: string[] = [];
	let shortFeedFull = false;

	let topNotesCount = 0;

	export let tag: string;
	export let profile: NostrUser | null;

	$: documentTitle.subscribe((value) => {
		document.title = value;
	});

	onMount(() => {
		getConfig().then(
			async ({
				npub: configNpub,
				relays,
				topNotes,
				shortNotesMinChars,
				shortNotes,
				shortFeedSummaryMaxChars,
				topics: configTopics
			}) => {
				npub = configNpub;
				profile = await getProfile(npub);
				if (!profile) {
					throw new Error('invalid npub');
				}

				topNotesCount = topNotes;
				topics = configTopics;
				shortFeedFull = shortFeedSummaryMaxChars == 0 ? true : false;

				let kindsToShow = [30023];
				if (shortNotes == 'main') {
					kindsToShow.push(1);
				}

				documentTitle.set(profile.shortName + ' home, powered by Nostr');

				let filter: Filter = {
					kinds: kindsToShow,
					authors: [profile.pubkey],
					limit: 1000
				};

				if (tag) {
					tag = tag.substring('/tags'.length);
					filter = {
						...filter,
						'#t': [tag]
					};
				}

				let subscription = pool.subscribeMany(relays, [filter], {
					onevent: async (event) => {
						// console.log('Received event:', event);
						// Check if the event ID is already in the set
						if (!eventIds.has(event.id)) {
							// If not, add the event to the events array and the event ID to the set

							// Exclude kind:1 notes with size below the limit
							if (
								event.kind == 1 &&
								(event.content.length < shortNotesMinChars || !isRootNote(event))
							) {
								return;
							}

							if (event.kind == 1 && shortFeedFull) {
								event.content = await processAll(event);
							}

							events = [...events, event];
							eventIds.add(event.id);

							// Sort the events array by created_at in descending order
							events.sort((a, b) => b.created_at - a.created_at);
						}
					},
					oneose() {
						console.log('No subscribers left. Closing subscription.');
						subscription.close();
					}
				});

				if (shortNotes == 'carousel') {
					subscription = pool.subscribeMany(
						relays,
						[
							{
								kinds: [1],
								authors: [profile.pubkey],
								limit: 1000
							}
						],
						{
							onevent: async (event) => {
								// console.log('Received event:', event);
								// Check if the event ID is already in the set
								if (
									!eventIds.has(event.id) &&
									event.content.length > shortNotesMinChars &&
									isRootNote(event)
								) {
									// If not, add the event to the shortEvents array and the event ID to the set
									event = await processCarouselShortEvent(event);
									if (event.content.length < shortNotesMinChars) {
										return;
									}
									shortEvents = [...shortEvents, event];
									eventIds.add(event.id);

									// Sort the shortEvents array by created_at in descending order
									shortEvents.sort((a, b) => b.created_at - a.created_at);
								}
							},
							oneose() {
								console.log('No subscribers left. Closing subscription.');
								subscription.close();
							}
						}
					);
				}
			}
		);
	});

	async function processCarouselShortEvent(event: NostrEvent) {
		let updatedEventContent;
		updatedEventContent = await processUsersEntities(event.content);
		updatedEventContent = processEventsEntities(updatedEventContent);
		updatedEventContent = cleanMarkdownLinks(updatedEventContent);
		event.content = updatedEventContent;
		return event;
	}

	$: topEvents =
		topNotesCount > 0
			? events
					.filter((object) => object.kind === 30023)
					.slice(0, topNotesCount)
					.map(getEventData)
			: [];
	$: listingEvents = events.slice(topNotesCount).map(getEventData);
	$: slideEvents = shortEvents.map(getEventData);
</script>

<div class="header home">
	<div class="external-link">
		Profile: <a href="https://njump.me/{npub}">{npub.slice(0, 9) + '...' + npub.slice(-5)}</a>
	</div>
	<h1>
		<div class="picture-container">
			<!-- svelte-ignore a11y-missing-attribute -->
			<img src={profile?.image} />
		</div>
		{profile?.shortName}
	</h1>
</div>

{#if topics.length > 0}
	<div class="topic-wrapper">
		<!-- svelte-ignore a11y-invalid-attribute -->
		<div><a href="#" class={tag == '' ? 'selected' : ''}>Home</a></div>
		{#each topics as topic}
			<div><a href="#tags/{topic}" class={topic == tag ? 'selected' : ''}>#{topic}</a></div>
		{/each}
	</div>
{/if}

{#if tag == ''}
	<div class="about">
		{profile?.metadata?.about || ''}
	</div>
{:else}
	<div class="separator"></div>
{/if}

{#if events.length > 0}
	{#if topEvents.length > 0}
		<div class="top-notes">
			{#each topEvents as event}
				<div class="note">
					<a href={`#${event.id}`}>
						<!-- svelte-ignore a11y-missing-attribute -->
						<img src={event.image} />
						<div class="title">{event.title}</div>
					</a>
					{#if event.summary}
						<div class="summary">{@html event.summary}</div>
					{/if}
					<div class="date">{formatDate(event.created_at)}</div>
				</div>
			{/each}
		</div>
	{/if}

	{#if slideEvents.length > 0 && !tag}
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
			{#each slideEvents as event}
				<SplideSlide>
					<a href={`#${event.id}`}>
						<div class="date">{formatDate(event.created_at, true)}</div>
						{event.summary}
					</a>
				</SplideSlide>
			{/each}
		</Splide>
	{/if}

	{#if listingEvents.length > 0}
		<div class="listing-notes" class:short-feed-full={shortFeedFull}>
			<ul>
				{#each listingEvents as event}
					<li>
						<h2><a href={`#${event.id}`}>{event.title}</a></h2>
						{#if event.kind == 1 && shortFeedFull}
							<div class="summary full">{@html event.content}</div>
						{:else if event.summary}
							<div class="summary">{event.summary}</div>
						{/if}
						{#if !(event.kind == 1 && shortFeedFull)}
							<div class="date">{formatDate(event.created_at)}</div>
						{/if}
					</li>
				{/each}
			</ul>
		</div>
	{/if}
{:else}
	<Loading />
{/if}
