<script lang="ts">
	import { onMount } from 'svelte';
	import { getConfig } from './config';
	import { documentTitle } from './stores/documentTitleStore';
	import { getEventData, processAll, formatDate, getProfile } from './utils';
	import { pool } from '@nostr/gadgets/global';
	import { neventEncode } from '@nostr/tools/nip19';
	import 'zapthreads';
	import Loading from './Loading.svelte';
	import { type NostrUser } from '@nostr/gadgets/metadata';

	let relays: string[];
	let note: ReturnType<typeof getEventData>;
	let renderedContent = '';
	let nevent = '';
	let comments = false;

	$: documentTitle.subscribe((value) => {
		document.title = value;
	});

	export let id: string;
	export let profile: NostrUser | null;

	onMount(() => {
		getConfig().then(async ({ npub, relays: configRelays, comments: configComments }) => {
			relays = configRelays;
			profile = await getProfile(npub);
			if (!profile) {
				throw new Error('npub is invalid');
			}
			nevent = neventEncode({ id });
			comments = configComments;

			let subscription = pool.subscribeMany(
				relays,
				[
					{
						ids: [id]
					}
				],
				{
					onevent: async (event) => {
						console.log('Received event:', event);
						note = getEventData(event);
						documentTitle.set(note.title);
						renderedContent = await processAll(note);
					},
					oneose() {
						console.log('No subscribers left. Closing subscription.');
						subscription.close();
					}
				}
			);
		});
	});

	$: renderedHtml = renderedContent;
</script>

<div class="header note">
	<div class="external-link">
		Note: <a href="https://njump.me/{nevent}"
			>{nevent.substring(0, 12) + '...' + nevent.slice(-5)}</a
		>
	</div>
	<!-- svelte-ignore a11y-invalid-attribute -->
	<a href="#">
		<div class="picture-container">
			<!-- svelte-ignore a11y-missing-attribute -->
			<img src={profile?.image} />
		</div>
		<span>{profile?.shortName} homepage</span>
	</a>
</div>

{#if Object.keys(note).length > 0}
	<div class="note-wrapper">
		<div class="date">{formatDate(note.created_at, true)}</div>
		<h1>{note.title}</h1>
		{#if note.image}
			<!-- svelte-ignore a11y-missing-attribute -->
			<img class="note-banner" src={note.image} />
		{/if}
		<div class="content">
			{@html renderedHtml}
		</div>
	</div>
	{#if comments}
		<zap-threads anchor={nevent} {relays} />
	{/if}
{:else}
	<Loading />
{/if}
