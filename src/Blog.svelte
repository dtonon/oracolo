<script lang="ts">
  import { onMount } from 'svelte';

  import { type SiteConfig, type Block } from './config';
  import { documentTitle } from './stores/documentTitleStore';
  import Loading from './Loading.svelte';
  import type { NostrUser } from '@nostr/gadgets/metadata';
  import Articles from './Articles.svelte';
  import Notes from './Notes.svelte';
  import Images from './Images.svelte';
  import { loaded, totalDisplayedNotes, EventSource } from './blockUtils';

  let npub = '';
  let topics: string[] = [];
  let blocks: Block[];

  let noteSource: EventSource;
  let imageSource: EventSource;
  let articleSource: EventSource;

  export let tag: string;
  export let profile: NostrUser | null;
  export let config: SiteConfig;

  $: documentTitle.subscribe((value) => {
    document.title = value;
  });

  onMount(() => {
    if (!profile) {
      throw new Error('invalid npub');
    }
    npub = config.npub;
    topics = config.topics;
    blocks = config.blocks;

    documentTitle.set(profile.shortName + ' home, powered by Nostr');

    // fetch only required data
    const tagFilter = tag ? { '#t': [tag.substring('/tags'.length)] } : {};

    noteSource = new EventSource(config.writeRelays, {
      kinds: [1],
      authors: [profile.pubkey],
      ...tagFilter
    });
    imageSource = new EventSource(config.writeRelays, {
      kinds: [20],
      authors: [profile.pubkey],
      ...tagFilter
    });
    articleSource = new EventSource(config.writeRelays, {
      kinds: [30023],
      authors: [profile.pubkey],
      ...tagFilter
    });
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
  <div class="topic-wrapper" class:hidden={!$loaded}>
    <!-- svelte-ignore a11y-invalid-attribute -->
    <div><a href="#" class={tag == '' ? 'selected' : ''}>Home</a></div>
    {#each topics as topic}
      <div><a href="#tags/{topic}" class={topic == tag ? 'selected' : ''}>#{topic}</a></div>
    {/each}
  </div>
{/if}

{#if blocks}
  <div class:hidden={!$loaded}>
    {#each blocks as block}
      {#if block.type === 'articles'}
        <Articles source={articleSource} {...block.config} />
      {:else if block.type === 'notes'}
        <Notes source={noteSource} {...block.config} noMoreEvents={$loaded} />
      {:else if block.type === 'images'}
        <Images source={imageSource} {...block.config} />
      {/if}
    {/each}
  </div>
{/if}

{#if tag.length > 0 && $loaded && $totalDisplayedNotes < 12}
  <Articles source={articleSource} minChars={10} count={40} style="grid" />
  <Images source={imageSource} minChars={0} count={40} style="grid" />
  <Notes source={noteSource} minChars={0} count={40} style="grid" />
{/if}

<div class:hidden={$loaded}>
  <Loading />
</div>

<style>
  .hidden {
    display: none;
  }
</style>
