<script>
  import { onMount } from 'svelte';
  import { getConfig } from './config';
  import { documentTitle } from './stores/documentTitleStore';
  import { SimplePool } from 'nostr-tools/pool';
  import showdown from 'showdown';
  import * as nip19 from 'nostr-tools/nip19'

  let note = {};
  let title = '';
  let image = '';
  let renderedContent = '';
  let note1 = '';
  
  let name = '';
  let picture = '';

  $: documentTitle.subscribe(value => {
    document.title = value;
  });

  export let id;
  export let profile;

  onMount(async () => {
    const { publicKey, relays } = getConfig();

    const profileContent = JSON.parse(profile.content);
    name = profileContent.name || null;
    picture = profileContent.picture || null;
    note1 = nip19.noteEncode(id)

    const pool = new SimplePool()
    let subscription = pool.subscribeMany(
      relays,
      [
        {
          authors: [publicKey],
          ids: [id],
        }
      ],
      {
        onevent(event) {
          console.log('Received event:', event);
          note = event;

          title = event?.tags.find(([k]) => k === 'title')?.[1] || 'No title'
          image = event?.tags.find(([k]) => k === 'image')?.[1] || undefined
          documentTitle.set(title);

          // Strip duplicate h1 title
          let note_content = note.content.replace("# " + title, '');

          // Prefix plain "nevent1|note1|npub1|nprofile|<alphanumeric string>" with nostr: for further processing
          // Include also entities without prefix inside a markdown link, e.g. [text](nevent1xxxxx)
          const regexEntities = /(^|\s|\n|\()(nevent1\w+|note1\w+|npub1\w+|nprofile1\w+)(?=\s|\n|\)|$)/gm;
          note_content = note_content.replace(regexEntities, (match, p1, group1) => {
            const shortenedString = group1.slice(0, 24);
            return `${p1}nostr:${group1}`;
          });

          // Transform plain nostr:(nevent1|note1|npub1|nprofile)<alphanumeric string> in markdown links
          const regexPrefixedEntities = /(^|\s|\n)nostr:(nevent1\w+|note1\w+|npub1\w+|nprofile1\w+)(?=\s|\n|$)/gm;
          note_content = note_content.replace(regexPrefixedEntities, (match, p1, group1) => {
            const shortenedString = group1.slice(0, 24);
            return `${p1}[${shortenedString}...](nostr:${group1})`;
          });

          // Transform "nostr:<alphanumeric string>" inside a markedown link with a njump.me link
          const regexNostrLinks = /\(nostr:([a-zA-Z0-9]+)\)/g;
          note_content = note_content.replace(regexNostrLinks, (match, group) => {
            // Construct the replacement string with "https://njump.me/<alphanumeric string>
            return `(https://njump.me/${group})`;
          });

          // Render markdown
          let converter = new showdown.Converter()
          renderedContent = converter.makeHtml(note_content);

        },
        oneose() {
          console.log('No subscribers left. Closing subscription.');
          subscription.close();
        }
      }
    );
  });

</script>

<div class="header note">
  <div class="external-link">
    Note: <a href="https://njump.me/{note1}">{note1.slice(0, 9) + "..." + note1.slice(-5)}</a>
  </div>
  <!-- svelte-ignore a11y-invalid-attribute -->
  <a href="">
    <div class="picture-container">
      <!-- svelte-ignore a11y-missing-attribute -->
      <img src="{picture}" />
    </div>
    <span>{name} homepage</span>
  </a>
</div>

{#if Object.keys(note).length > 0}
  <div class="note_wrapper">
    <div class="date">{new Intl.DateTimeFormat('en-US', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(note.created_at * 1000))}</div>
    <h1>{title}</h1>
    {#if image }
      <!-- svelte-ignore a11y-missing-attribute -->
      <img class="note-banner" src="{image}" />
    {/if}
    <div class="content">
      {@html renderedContent}
    </div>
  </div>
{:else}
  <p>Loading...</p>
{/if}
