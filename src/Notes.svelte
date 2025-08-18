<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { type NostrEvent } from '@nostr/tools/core';
  import { Splide, SplideSlide } from '@splidejs/svelte-splide';
  import '@splidejs/svelte-splide/css';
  import { formatDate, getEventData, processContent, type EventData } from './utils.js';
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
        const processed = [];
        if (style === 'board' || style === 'wall') {
          for (const item of items) {
            processed.push(await processContent(item));
          }
          items = processed;
        }
      }
    })();
  });

  // Boardlayout logic
  let gridContainer: HTMLDivElement;

  async function setupBoardLayout() {
    if (style !== 'board' || !gridContainer) return;

    await tick(); // Ensure DOM is updated

    // Clear previous content
    gridContainer.innerHTML = '';

    // Create two columns dynamically
    const columns = [document.createElement('div'), document.createElement('div')];

    // Style columns
    columns.forEach((column, index) => {
      column.classList.add('board-column');
      gridContainer.appendChild(column);
    });

    // Tracking column heights
    const columnHeights = [0, 0];

    // Place items in the shortest column
    items.forEach((event, index) => {
      const itemElement = document.createElement('div');
      itemElement.classList.add('item');

      // Create content similar to existing grid structure
      const linkElement = document.createElement('a');
      linkElement.href = `#${event.id}`;

      // Image (if exists)
      if (event.image) {
        const imgElement = document.createElement('img');
        imgElement.src = event.image;
        linkElement.appendChild(imgElement);
      }

      // Title
      const titleElement = document.createElement('h2');
      titleElement.textContent = event.title;
      linkElement.appendChild(titleElement);

      // Content with cropping logic
      const contentElement = document.createElement('div');
      contentElement.classList.add('content');
      contentElement.innerHTML = event.renderedContent;

      // Check content height
      const tempContentElement = document.createElement('div');
      tempContentElement.innerHTML = event.renderedContent;
      tempContentElement.style.position = 'absolute';
      tempContentElement.style.visibility = 'hidden';
      document.body.appendChild(tempContentElement);

      const contentHeight = tempContentElement.offsetHeight;
      document.body.removeChild(tempContentElement);

      if (contentHeight > window.innerHeight * 0.8) {
        contentElement.classList.add('cropped');
        contentElement.style.maxHeight = '80vh';
        contentElement.style.position = 'relative';
        contentElement.style.overflow = 'hidden';

        // Add fade overlay
        const fadeOverlay = document.createElement('div');
        fadeOverlay.classList.add('content-fade');
        contentElement.appendChild(fadeOverlay);
      }

      linkElement.appendChild(contentElement);

      // // Date
      // const dateElement = document.createElement('span');
      // dateElement.classList.add('date');
      // dateElement.textContent = formatDate(event.created_at);
      // linkElement.appendChild(dateElement);

      // Pinned indicator
      if (ids && ids.some((id) => event.id.endsWith(id))) {
        const pinnedElement = document.createElement('span');
        pinnedElement.classList.add('pinned');
        pinnedElement.textContent = '- 📌 Pinned';
        linkElement.appendChild(pinnedElement);
      }

      itemElement.appendChild(linkElement);

      // Determine the shortest column
      const shortestColumnIndex = columnHeights[0] <= columnHeights[1] ? 0 : 1;
      columns[shortestColumnIndex].appendChild(itemElement);

      // Update column height
      // Use a slight estimate as exact height might not be immediately available
      columnHeights[shortestColumnIndex] += 400; // Approximate height
    });

    // Add odd class if needed
    if (items.length % 2 !== 0) {
      gridContainer.classList.add('odd');
    }
  }

  // Reactive statement to trigger layout setup
  $: if (items.length > 0 && style == 'board') {
    setupBoardLayout();
  }

  // Reflow on window resize
  onMount(() => {
    const handleResize = () => {
      if (style == 'board') {
        setupBoardLayout();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  });
</script>

{#if items.length > 0}
  <section class="block notes">
    {#if style === 'grid' || style === 'board'}
      <div bind:this={gridContainer} class="grid {style === 'board' ? 'full-notes' : ''}">
        {#if style !== 'board'}
          {#each items as event}
            <div class="item">
              <a href={`#${event.id}`}>
                {#if event.image}
                  <!-- svelte-ignore a11y-missing-attribute -->
                  <img src={event.image} />
                {/if}
                <h2>{event.title}</h2>
                <div class="summary">{event.summary}</div>
                {#if ids && ids.some((id) => event.id.endsWith(id))}
                  <span class="pinned">- 📌 Pinned </span>
                {/if}
              </a>
            </div>
          {/each}
        {/if}
      </div>
    {:else if style === 'list' || style === 'wall'}
      <div class="list">
        <ul>
          {#each items as event}
            <li class={style === 'wall' ? 'fullNote' : ''}>
              <a href={`#${event.id}`}>
                <h2>{event.title}</h2>
                {#if style === 'wall'}
                  <div class="content">{@html event.renderedContent}</div>
                {:else}
                  <div class="summary">{event.summary}</div>
                {/if}
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
