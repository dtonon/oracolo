<script>
  import { onMount, onDestroy } from 'svelte';
  import { publicKey, relayUrl } from './config';
  import Home from './Home.svelte';
  import Note from './Note.svelte';
  import { Relay } from 'nostr-tools/relay';

  let currentHash = '';
  let profile;
  let name = '';
  let picture = '';

  const handleHashChange = () => {
    const newHash = window.location.hash.substr(1); // Remove the leading #
    if (newHash !== currentHash) {
      currentHash = newHash;
    }
  };

  onMount(async () => {
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);

    const relay = await Relay.connect(relayUrl);
    const metadataSubscription = relay.subscribe(
      [
        {
          kinds: [0],
          authors: [publicKey],
          limit: 1,
        }
      ],
      {
        onevent(event) {
          profile = event
          const parsedContent = JSON.parse(profile.content);
          name = parsedContent.name || null;
          picture = parsedContent.picture || null;
        },
        oneose() {
          metadataSubscription.close();
        }
      }
    );

  });

  onDestroy(() => {
    window.removeEventListener('hashchange', handleHashChange);
  });
</script>

{#if currentHash === ''}
  {#if profile}
    <Home {profile} />
  {/if}
{:else}
  {#if profile}
    <Note id={currentHash} {profile} />
  {/if}
{/if}

<div class="footer">This blog is powerd by Oracolo and Nostr, <a href="https://njump.me">read more</a></div>