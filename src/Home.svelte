<script>
  import { onMount } from 'svelte';
  import { publicKey, relayUrls } from './config';
  import { documentTitle } from './stores/documentTitleStore';
  import { SimplePool } from 'nostr-tools/pool';
  import * as nip19 from 'nostr-tools/nip19'

  let events = [];
  let eventIds = new Set();

  let name = '';
  let picture = '';
  let about = '';
  let npub = '';

  export let profile;

  $: documentTitle.subscribe(value => {
    document.title = value;
  });


  onMount(async () => {
    const parsedContent = JSON.parse(profile.content);
    name = parsedContent.name || null;
    picture = parsedContent.picture || null;
    about = parsedContent.about || null;
    npub = nip19.npubEncode(publicKey)

    documentTitle.set(name + " home, powerd by Nostr");

    const pool = new SimplePool()
    let subscription = pool.subscribeMany(
      relayUrls,
      [
        {
          kinds: [30023],
          authors: [publicKey],
          limit: 10,
        }
      ],
      {
        onevent(event) {
          console.log('Received event:', event);
          // Check if the event ID is already in the set
          if (!eventIds.has(event.id)) {
            // If not, add the event to the events array and the event ID to the set
            events = [...events, event];
            eventIds.add(event.id);
          }
          
          // Sort the events array by created_at in descending order
          events.sort((a, b) => b.created_at - a.created_at);
        },
        oneose() {
          console.log('No subscribers left. Closing subscription.');
          subscription.close();
        }
      }
    );

  });

  function extractTitle(event) {
    let tags = event.tags;
    for (const tag of tags) {
      if (tag[0] === "title") {
        return tag[1];
      }
    }
    return null;
  }

  function extractSummary(event) {
    let tags = event.tags;
    for (const tag of tags) {
      if (tag[0] === "summary") {
        return tag[1];
      }
    }
    return null;
  }
</script>

<div class="header home">
  <div class="external-link">
    Profile: <a href="https://njump.me/{npub}">{npub.slice(0, 9) + "..." + npub.slice(-5)}</a>
  </div>
  <h1>
    <div class="picture-container">
      <!-- svelte-ignore a11y-missing-attribute -->
      <img src="{picture}" />
    </div>
    {name}
  </h1>
</div>

<div class="about">
  {about}
</div>

<div class="listing">
  {#if events.length > 0}
    <ul>
      {#each events as event}
        <li>
          <a href={`#${event.id}`}>{extractTitle(event)}</a>
          {#if extractSummary(event) }
            <div class="summary">{extractSummary(event)}</div>
          {/if}
          <div class="date">{new Intl.DateTimeFormat('en-US', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(event.created_at * 1000))}</div>
        </li>
      {/each}
    </ul>
  {:else}
    <p>Loading...</p>
  {/if}
</div>