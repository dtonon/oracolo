<script>
  import { onMount } from 'svelte';
  import { publicKey, relayUrl } from './config';
  import { documentTitle } from './stores/documentTitleStore';
  import { Relay } from 'nostr-tools/relay';
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
    const relay = await Relay.connect(relayUrl);
    const subscription = relay.subscribe(
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

          const profileContent = JSON.parse(profile.content);
          name = profileContent.name || null;
          picture = profileContent.picture || null;

          note1 = nip19.noteEncode(event.id)

          title = event?.tags.find(([k]) => k === 'title')?.[1] || 'No title'
          image = event?.tags.find(([k]) => k === 'image')?.[1] || undefined
          documentTitle.set(title);

          // Strip duplicate h1 title
          let note_content = note.content.replace("# " + title, '');

          // Render markdown
          let converter = new showdown.Converter()
          renderedContent = converter.makeHtml(note_content);

          // Replace "nostr:<alphanumeric string>" pointing to njump.me
          const regex = /"nostr:([a-zA-Z0-9]+)"/g;
          renderedContent = renderedContent.replace(regex, (match, group) => {
            // Construct the replacement string with "https://njump.me/<alphanumeric string>"
            return `https://njump.me/${group}`;
          });
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
  <a href="">
    <div class="picture-container">
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
      <img class="note-banner" src="{image}" />
    {/if}
    <div class="content">
      {@html renderedContent}
    </div>
  </div>
{:else}
  <p>Loading...</p>
{/if}
