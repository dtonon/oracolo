<script lang="ts">
  import { onMount } from 'svelte';
  import { Splide, SplideSlide } from '@splidejs/svelte-splide';
  import '@splidejs/svelte-splide/css';
  import { formatDate, type EventData } from './utils.js';
  import type { Config } from './config.js';
  import { EventSource } from './blockUtils.js';

  // Block-specific props
  export let source: EventSource;
  export let count: Config['count'];
  export let style: Config['style'];
  export let minChars: Config['minChars'];
  export let ids: string[] | undefined = undefined;
  export let noMoreEvents = false;

  let items: EventData[] = [];
  onMount(() => {
    (async () => {
      if (ids) {
        style = 'grid';
        items = await source.fetchIds(ids);
      } else {
        items = await source.pluck(count, minChars);
      }
    })();
  });
</script>

{#if items.length > 0}
  <section class="block notes">
    {#if style === 'grid'}
      <div class="grid {items.length % 2 !== 0 ? 'odd' : ''}">
        {#each items as event}
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
              <span class="date">{formatDate(event.created_at)}</span>
              {#if ids && ids.some((id) => event.id.endsWith(id))}
                <span class="pinned">- 📌 Pinned </span>
              {/if}
            </a>
          </div>
        {/each}
      </div>
    {:else if style === 'list'}
      <div class="list">
        <ul>
          {#each items as event}
            <li>
              <a href={`#${event.id}`}>
                <h2>{event.title}</h2>
                <div class="summary">{event.summary}</div>
              </a>
            </li>
          {/each}
        </ul>
      </div>
    {:else if style === 'slide' && noMoreEvents}
      <Splide
        class="slide"
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
        {#each items as event}
          <SplideSlide>
            <a href={`#${event.id}`}>
              <div class="date">{formatDate(event.created_at, true)}</div>
              <div class="summary">{event.summary}</div>
            </a>
          </SplideSlide>
        {/each}
      </Splide>
    {/if}
  </section>
{/if}
