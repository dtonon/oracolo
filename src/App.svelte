<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { getConfig } from './config';
  import Home from './Home.svelte';
  import Note from './Note.svelte';
  import { SimplePool } from 'nostr-tools/pool';

  let currentHash = '';
  let profile: import('nostr-tools').Event;
  let name = '';
  let picture = '';
  let settedPublicKey;

  const handleHashChange = () => {
    const newHash = window.location.hash.substr(1); // Remove the leading #
    if (newHash !== currentHash) {
      currentHash = newHash;
    }
  };

  onMount(async () => {
    const { publicKey, relays } = getConfig();
    settedPublicKey = publicKey

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);

    const pool = new SimplePool()
    let subscription = pool.subscribeMany(
      relays,
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
          subscription.close();
        }
      }
    );

  });

  onDestroy(() => {
    window.removeEventListener('hashchange', handleHashChange);
  });
</script>

{#if settedPublicKey === 'replace_with_your_hex_public_key' }
  <div class="unfinished-setup">
    <h1>Missing config!</h1>
    You need to personalize (at least) the publicKey meta tag updating this html file! Open it with an editor, look at the first lines and personalize them.
  </div>
{/if}

{#if profile && Object.keys(profile).length > 0}
  {#if currentHash === ''}
      <Home {profile} />
  {:else}
      <Note id={currentHash} {profile} />
  {/if}
{/if}

<div class="footer">This blog is powerd by <a href="https://github.com/dtonon/oracolo">Oracolo</a> and Nostr, <a href="https://njump.me">read more</a></div>