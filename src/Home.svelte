<script>
  import { onMount } from 'svelte';
  import { getConfig } from './config';
  import { documentTitle } from './stores/documentTitleStore';
  import { SimplePool } from 'nostr-tools/pool';
  import * as nip19 from 'nostr-tools/nip19'

  let events = [];
  let eventIds = new Set();

  let name = '';
  let picture = '';
  let about = '';
  let npub = '';

  let topNotesCount = 0;

  export let profile;

  $: documentTitle.subscribe(value => {
    document.title = value;
  });


  onMount(async () => {
    const { publicKey, relays, topNotes } = getConfig();

    const parsedContent = JSON.parse(profile.content);
    name = parsedContent.name || null;
    picture = parsedContent.picture || null;
    about = parsedContent.about || null;
    npub = nip19.npubEncode(publicKey)
    topNotesCount = topNotes;

    documentTitle.set(name + " home, powerd by Nostr");

    const pool = new SimplePool()
    let subscription = pool.subscribeMany(
      relays,
      [
        {
          kinds: [30023],
          authors: [publicKey],
          limit: 500,
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

  function getEventData(event) {
    return {
      id: event.id,
      created_at: event.created_at,
      title: event?.tags.find(([k]) => k === 'title')?.[1] || 'No title',
      image: event?.tags.find(([k]) => k === 'image')?.[1] || undefined,
      summary: event?.tags.find(([k]) => k === 'summary')?.[1] || undefined,
    };
  }

  $: topEvents = topNotesCount > 0 ? events.slice(0, topNotesCount).map(getEventData) : [];
  $: listingEvents = events.slice(topNotesCount).map(getEventData);

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

{#if events.length > 0}
  {#if topEvents.length > 0}
    <div class="top-notes">
        {#each topEvents as event}
          <div class="note">
            <a href={`#${event.id}`}>
              <!-- svelte-ignore a11y-missing-attribute -->
              <img src="{event.image}" />
              <div class="title">{event.title}</div>
            </a>
            {#if event.summary }
              <div class="summary">{event.summary}</div>
            {/if}
            <div class="date">{new Intl.DateTimeFormat('en-US', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(event.created_at * 1000))}</div>
          </div>
        {/each}
    </div>
  {/if}

  {#if listingEvents}
    <div class="listing-notes">
        <ul>
          {#each listingEvents as event}
            <li>
              <a href={`#${event.id}`}>{event.title}</a>
              {#if event.summary }
                <div class="summary">{event.summary}</div>
              {/if}
              <div class="date">{new Intl.DateTimeFormat('en-US', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(event.created_at * 1000))}</div>
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  {:else}
    <p>Loading...</p>
  {/if}