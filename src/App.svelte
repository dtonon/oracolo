<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { getConfig } from './config';
  import { getProfile } from './utils';
  import Home from './Home.svelte';
  import Note from './Note.svelte';

  let currentHash = '';
  let profile: import('nostr-tools').Event;
  let missingConfig = false;
  let name = '';
  let picture = '';
  let relays;
  let comments = false;

  const handleHashChange = () => {
    const newHash = window.location.hash.substr(1); // Remove the leading #
    if (newHash !== currentHash) {
      currentHash = newHash;
    }
  };

  onMount(async () => {
    const { npub, relays: configRelays, comments: configComments } = getConfig();
    relays = configRelays;
    comments = configComments;

    if (comments) {
      try {
        await import('window.nostr.js');
        console.log('window.nostr.js has been successfully loaded');
        // You can place any initialization code here if needed
      } catch (error) {
        console.error('Failed to load window.nostr.js:', error);
      }
    }

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);

    profile = await getProfile(npub);
    if (profile) {
      const parsedContent = JSON.parse(profile.content);
      name = parsedContent.name || null;
      picture = parsedContent.picture || null;
    } else {
      missingConfig = true
    }

  });

  onDestroy(() => {
    window.removeEventListener('hashchange', handleHashChange);
  });
</script>

{#if missingConfig }
  <div class="unfinished-setup">
    <h1>Oracolo</h1>
    <h2>Missing config!</h2>
    You need to set (at least) the <strong>author meta tag</strong> by updating this html file! Open it with an editor, look at the first lines and personalize them.
  </div>
{/if}

{#if profile && Object.keys(profile).length > 0}
  {#key  currentHash}
    {#if currentHash === ''}
        <Home tag='' {profile}/>
    {:else if currentHash.startsWith("tags/")}
        <Home tag={currentHash} {profile}/>
    {:else}
        <Note id={currentHash} {profile} />
    {/if}
  {/key}
{/if}

<div class="footer">
  This blog is powered by <a href="https://github.com/dtonon/oracolo">Oracolo</a> and Nostr, <a href="https://njump.me">read more</a><br/><br/>
  {#if relays }
    This page connects to some servers (Nostr relays) to retrieve data: {relays.join(', ')}
  {/if}
</div>
