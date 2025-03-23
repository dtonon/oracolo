<script lang="ts">
  import { onMount } from 'svelte';
  import { type NostrEvent } from '@nostr/tools/core';
  import { filterEvents } from './blockUtils.js';
  import { formatDate, getEventData } from './utils.js';

  // Block-specific props
  export let events: NostrEvent[] = [];
  export let count = 2;
  export let style = 'grid';
  export let minChars = 10;
  export let ids: string[] | undefined = undefined;
  const kinds = [30023];

  onMount(() => {
    if (ids) {
      style = 'grid';
    }
  });

  $: filteredItems = filterEvents(events, kinds, minChars, count, false, ids).map(getEventData);
</script>

{#if filteredItems.length > 0}
  <section class="block articles">
    {#if style === 'grid'}
      <div class="grid {filteredItems.length % 2 !== 0 ? 'odd' : ''}">
        {#each filteredItems as event}
          <div class="item">
            <a href={`#${event.id}`}>
              <!-- svelte-ignore a11y-missing-attribute -->
              {#if event.image}
                <img src={event.image} />
              {/if}
              <div class="title">{event.title}</div>

              {#if event.summary}
                <div class="summary">{@html event.summary}</div>
              {/if}
              <div>
                <span class="date">{formatDate(event.created_at)}</span>
                {#if ids && ids.some((id) => event.id.endsWith(id))}
                  <span class="pinned">- 📌 Pinned</span>
                {/if}
              </div>
            </a>
          </div>
        {/each}
      </div>
    {:else if style === 'list'}
      <div class="list">
        <ul>
          {#each filteredItems as event}
            <li>
              <a href={`#${event.id}`}>
                <h2>{event.title}</h2>
                {#if event.summary}
                  <div class="summary">{event.summary}</div>
                {/if}
              </a>
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  </section>
{/if}
