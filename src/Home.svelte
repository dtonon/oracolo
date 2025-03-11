<script lang="ts">
	import { onMount } from 'svelte';
	import { type NostrEvent } from '@nostr/tools/core';
	import { type Filter } from '@nostr/tools/filter';

	import { getConfig } from './config';
	import { pool } from '@nostr/gadgets/global';
	import { documentTitle } from './stores/documentTitleStore';
	import { getProfile, isRootNote } from './utils';
	import Loading from './Loading.svelte';
	import type { NostrUser } from '@nostr/gadgets/metadata';
	import Articles from './Articles.svelte';
	import Notes from './Notes.svelte';
	import Images from './Images.svelte';
	import { uniqueEventsStore } from './stores/uniqueEventsStore';

	let events: NostrEvent[] = [];
	let finishedLoading = false;

	let npub = '';
	let topics: string[] = [];

	let blocks: { type: string; config: any }[];

	export let tag: string;
	export let profile: NostrUser | null;

	$: documentTitle.subscribe((value) => {
		document.title = value;
	});

	// Reset events mapping when the var refresh
	$: if (events) {
		uniqueEventsStore.reset();
	}

	onMount(() => {
		uniqueEventsStore.reset();

		getConfig().then(
			async ({ npub: configNpub, writeRelays, topics: configTopics, blocks: configBlocks }) => {
				npub = configNpub;
				profile = await getProfile(npub);
				if (!profile) {
					throw new Error('invalid npub');
				}

				topics = configTopics;
				blocks = configBlocks;

				documentTitle.set(profile.shortName + ' home, powered by Nostr');

				// Fetch all possible data
				let filters: Filter[] = [
					{
						kinds: [1],
						authors: [profile.pubkey],
						limit: 1000
					},
					{
						kinds: [30023],
						authors: [profile.pubkey],
						limit: 1000
					},
					{
						kinds: [20],
						authors: [profile.pubkey],
						limit: 1000
					}
				];

				if (tag) {
					tag = tag.substring('/tags'.length);
					filters = filters.map((filter) => ({
						...filter,
						'#t': [tag]
					}));
				}

				pool.subscribeManyEose(writeRelays, filters, {
					onevent: async (event) => {
						if (!isRootNote(event)) {
							return;
						}
						events = [...events, event].sort((a, b) => b.created_at - a.created_at);
					},
					onclose() {
						finishedLoading = true;
						console.log('Got', events.length, 'events');
						console.log('Finish, subscription closed.');
					}
				});
			}
		);
	});
</script>

{#if profile}
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
{/if}

{#if topics.length > 0}
	<div class="topic-wrapper">
		<!-- svelte-ignore a11y-invalid-attribute -->
		<div><a href="#" class={tag == '' ? 'selected' : ''}>Home</a></div>
		{#each topics as topic}
			<div><a href="#tags/{topic}" class={topic == tag ? 'selected' : ''}>#{topic}</a></div>
		{/each}
	</div>
{/if}

{#if blocks && events.length > 0}
	{#each blocks as block}
		{#if block.type === 'articles'}
			<Articles {events} {...block.config} />
		{:else if block.type === 'notes'}
			<Notes {events} {...block.config} />
		{:else if block.type === 'images'}
			<Images {events} {...block.config} />
		{/if}
	{/each}
{/if}

{#if tag.length > 0 && finishedLoading && uniqueEventsStore.getDisplayedEventsCount() < 12}
	<Articles {events} count={40} style="grid" />
	<Images {events} count={40} style="grid" />
	<Notes {events} count={40} style="grid" />
{/if}
