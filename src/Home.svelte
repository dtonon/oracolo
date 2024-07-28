<script>
  import { onMount } from 'svelte';
  import { getConfig } from './config';
  import { pool } from './stores/websocket';
  import { documentTitle } from './stores/documentTitleStore';
  import { isRootNote, getEventData, processUsersEntities, processEventsEntities, processAll, cleanMarkdownLinks, formatDate } from './utils';
  import * as nip19 from 'nostr-tools/nip19'
  import { Splide, SplideSlide } from '@splidejs/svelte-splide';
  import '@splidejs/svelte-splide/css';
  import Loading from './Loading.svelte';

  let events = [];
  let shortEvents = [];
  let eventIds = new Set();

  let name = '';
  let picture = '';
  let about = '';
  let npub = '';
  let publicKey = '';
  let topics = '';
  let shortFeedFull = false;

  let topNotesCount = 0;

  export let tag;
  export let profile;

  $: documentTitle.subscribe(value => {
    document.title = value;
  });

  let splide;

  onMount(async () => {
    const { npub: configNpub, relays, topNotes, shortChars, shortFeed, shortFeedSummary, topics: configTopics } = getConfig();

    npub = configNpub
    publicKey = profile.pubkey
    const parsedContent = JSON.parse(profile.content);
    name = parsedContent.name || null;
    picture = parsedContent.picture || null;
    about = parsedContent.about || null;
    topNotesCount = topNotes;
    topics = configTopics;
    shortFeedFull = shortFeedSummary == 0 ? true : false;

    let kindsToShow = [30023];
    if (shortFeed) {
      kindsToShow.push(1);
    }

    documentTitle.set(name + " home, powered by Nostr");

    let filter = {
      kinds: kindsToShow,
      authors: [publicKey],
      limit: 500,
    };

    if (tag) {
      tag = tag.substring("/tags".length);
      filter = {
        ...filter,
        "#t":  [tag],
      };
    };

    let subscription = pool.subscribeMany(
      relays,
      [
        filter
      ],
      {
        onevent: async(event) => {
          // console.log('Received event:', event);
          // Check if the event ID is already in the set
          if (!eventIds.has(event.id)) {
            // If not, add the event to the events array and the event ID to the set

            // Exclude kind:1 notes with size below the limit
            if (event.kind == 1 && (event.content.length < shortChars || !isRootNote(event))) {
                return
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
      }
    );

    if (shortChars > 0 && !shortFeed) {
      subscription = pool.subscribeMany(
        relays,
        [
          {
            kinds: [1],
            authors: [publicKey],
            limit: 1000,
          }
        ],
        {
          onevent: async(event) => {
            // console.log('Received event:', event);
            // Check if the event ID is already in the set
            if (!eventIds.has(event.id) && event.content.length > shortChars && isRootNote(event)) {
              // If not, add the event to the shortEvents array and the event ID to the set
              event = await processCarouselShortEvent(event);
              if (event.content.length < shortChars) {
                return
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

  });

  async function processCarouselShortEvent(event) {
    let updatedEventContent;
    updatedEventContent = await processUsersEntities(event.content);
    updatedEventContent = processEventsEntities(updatedEventContent);
    updatedEventContent = cleanMarkdownLinks(updatedEventContent);
    event.content = updatedEventContent
    return event;
  }

  let asyncListingEvents = [];

  $: topEvents = topNotesCount > 0 ? events.slice(0, topNotesCount).map(getEventData) : [];
  $: listingEvents = events.slice(topNotesCount).map(getEventData);
  $: slideEvents = shortEvents.map(getEventData);

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

{#if topics.length > 0 }
  <div class="topic-wrapper">
    <div><a href="#" class={tag == '' ? "selected" : ""}>Home</a></div>
    {#each topics as topic}
      <div><a href="#tags/{topic}" class={topic == tag ? "selected" : ""}>#{topic}</a></div>
    {/each}
  </div>
{/if}

{#if tag == ''}
  <div class="about">
    {about}
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
              <img src="{event.image}" />
              <div class="title">{event.title}</div>
            </a>
            {#if event.summary }
              <div class="summary">{@html event.summary}</div>
            {/if}
            <div class="date">{formatDate(event.created_at)}</div>
          </div>
        {/each}
    </div>
  {/if}

  {#if (slideEvents.length > 0) && !(tag) }
  <Splide class="short-notes" options={ {
    type: 'loop',
    gap: '1rem',
    pagination: false,
    perPage: 3,
    breakpoints: {
      640: {
        perPage: 2,
      },
    },
    autoplay : true,
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
              {#if event.kind == 1 && shortFeedFull }
                <div class="summary full">{@html event.content}</div>
              {:else if event.summary }
                <div class="summary">{event.summary}</div>
              {/if}
              {#if !(event.kind == 1 && shortFeedFull) }
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
