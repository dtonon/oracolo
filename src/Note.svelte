<script>
  import { onMount } from 'svelte';
  import { getConfig } from './config';
  import { documentTitle } from './stores/documentTitleStore';
  import { getEventData, processAll, formatDate } from './utils';
  import { pool } from './stores/websocket';
  import * as nip19 from 'nostr-tools/nip19'
  import "zapthreads";
  import Loading from './Loading.svelte';

  let relays;
  let note = {};
  let title = '';
  let image = '';
  let renderedContent = '';
  let note1 = '';
  let comments = false;

  let name = '';
  let picture = '';

  $: documentTitle.subscribe(value => {
    document.title = value;
  });

  export let id;
  export let profile;

  onMount(async () => {
    const { relays: configRelays, comments: configComments } = getConfig();

    relays = configRelays;
    const profileContent = JSON.parse(profile.content);
    name = profileContent.name || null;
    picture = profileContent.picture || null;
    note1 = nip19.noteEncode(id);
    comments = configComments;

    let subscription = pool.subscribeMany(
      relays,
      [
        {
          authors: [profile.pubkey],
          ids: [id],
        }
      ],
      {
        onevent: async(event) => {
          let note_content
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

  $: renderedHtml = renderedContent;

</script>

<div class="header note">
  <div class="external-link">
    Note: <a href="https://njump.me/{note1}">{note1.slice(0, 9) + "..." + note1.slice(-5)}</a>
  </div>
  <!-- svelte-ignore a11y-invalid-attribute -->
  <a href="#">
    <div class="picture-container">
      <!-- svelte-ignore a11y-missing-attribute -->
      <img src="{picture}" />
    </div>
    <span>{name} homepage</span>
  </a>
</div>

{#if Object.keys(note).length > 0}
  <div class="note-wrapper">
    <div class="date">{formatDate(note.created_at, true)}</div>
    <h1>{note.title}</h1>
    {#if note.image }
      <!-- svelte-ignore a11y-missing-attribute -->
      <img class="note-banner" src="{note.image}" />
    {/if}
    <div class="content">
      {@html renderedHtml}
    </div>
  </div>
  {#if comments }
    <zap-threads anchor="{note1}" relays="{relays}" />
  {/if}
{:else}
  <Loading />
{/if}
