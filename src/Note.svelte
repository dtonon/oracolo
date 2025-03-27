<script lang="ts">
  import { onMount } from 'svelte';
  import { type SiteConfig } from './config';
  import { documentTitle } from './stores/documentTitleStore';
  import { getEventData, processAll, formatDate, getProfile, type EventData } from './utils';
  import { pool } from '@nostr/gadgets/global';
  import { neventEncode } from '@nostr/tools/nip19';
  import 'zapthreads';
  import { type NostrUser } from '@nostr/gadgets/metadata';

  let replyRelays: string[];
  let note: EventData;
  let renderedContent = '';
  let nevent = '';
  let comments = false;

  $: documentTitle.subscribe((value) => {
    document.title = value;
  });

  export let id: string;
  export let profile: NostrUser | null;
  export let config: SiteConfig;

  onMount(async () => {
    if (!profile) {
      throw new Error('invalid npub');
      return;
    }

    replyRelays = config.readRelays;

    profile = await getProfile(config.npub);
    if (!profile) {
      throw new Error('npub is invalid');
    }
    nevent = neventEncode({ id });
    comments = config.comments;

    pool.subscribeManyEose(config.writeRelays, [{ ids: [id] }], {
      onevent: async (event) => {
        console.log('Received event:', event);
        note = getEventData(event);
        documentTitle.set(note.title);
        renderedContent = await processAll(note);
      },
      onclose() {
        console.log('Finish, subscription closed.');
      }
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

{#if note && Object.keys(note).length > 0}
  <div class="event-wrapper">
    <div class="date">{formatDate(note.created_at, true)}</div>
    <h1>{note.title}</h1>
    {#if note.image}
      <!-- svelte-ignore a11y-missing-attribute -->
      <img class={note.image ? 'note-image' : 'note-banner'} src={note.image} />
    {/if}
    <div class="content">
      {@html renderedHtml}
    </div>
  </div>
  {#if comments}
    <zap-threads anchor={nevent} relays={replyRelays.join(',')} />
  {/if}
{:else}
  <!-- <Loading /> Temorary disabled, it creates scrolling issue -->
{/if}
