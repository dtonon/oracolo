<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { type NostrUser } from '@nostr/gadgets/metadata';

  import { getConfig, type SiteConfig } from './config';
  import { getProfile, downloadHtmlApp } from './utils';
  import Home from './Blog.svelte';
  import Note from './Note.svelte';
  import ThemeSwitch from './ThemeSwitch.svelte';

  let currentHash = '';
  let profile: NostrUser | null = null;
  let missingConfig = false;
  let name = '';
  let picture: string | null = null;
  let relays: string[] = [];
  let comments = false;
  let config: SiteConfig;

  onMount(() => {
    // Check if the URL has a download parameter
    const urlParams = new URLSearchParams(window.location.search);
    const shouldDownload = urlParams.get('download') === 'true';

    getConfig()
      .then(async (configOrUndefined) => {
        // Early return if config is undefined
        if (!configOrUndefined) {
          missingConfig = true;
          return;
        } else {
          config = configOrUndefined;
        }

        // Destructure with default values to satisfy TypeScript
        const {
          npub = '',
          readRelays = [],
          writeRelays = [],
          comments = false
        } = configOrUndefined;

        // Validate config
        if (!npub) {
          missingConfig = true;
          return;
        }

        relays = Array.from(new Set(readRelays.concat(writeRelays)));

        if (comments) {
          try {
            await import('window.nostr.js');
            console.log('window.nostr.js has been successfully loaded');
          } catch (error) {
            console.error('Failed to load window.nostr.js:', error);
          }
        }

        handleHashChange();
        window.addEventListener('hashchange', handleHashChange);

        profile = await getProfile(npub);
        if (profile) {
          name = profile.metadata.name || profile.shortName;
          picture = profile.image || null;

          if (shouldDownload) {
            downloadHtmlApp();
          }
        } else {
          missingConfig = true;
          return;
        }
      })
      .catch((error) => {
        console.error('Error fetching config:', error);
        missingConfig = true;
        return;
      });
  });

  onDestroy(() => {
    window.removeEventListener('hashchange', handleHashChange);
  });

  function handleHashChange() {
    const newHash = window.location.hash.substring(1); // Remove the leading #
    if (newHash !== currentHash) {
      currentHash = newHash;
    }
  }
</script>

{#if missingConfig}
  <div class="unfinished-setup">
    <h1>Oracolo</h1>
    <h2>Missing config!</h2>
    <p>
      You need to <a href="https://github.com/dtonon/oracolo?tab=readme-ov-file#configuration"
        >configure your blog</a
      >
      adding some meta tags inside this HTML file.<br /><br />
      Are you lazy? Use the handy web wizard at <a href="https://oracolo.me">oracolo.me</a>.
    </p>
  </div>
{/if}

{#if profile && Object.keys(profile).length > 0}
  {#key currentHash}
    {#if currentHash === ''}
      <Home tag="" {profile} {config} />
    {:else if currentHash.startsWith('tags/')}
      <Home tag={currentHash} {profile} {config} />
    {:else}
      <Note id={currentHash} {profile} {config} />
    {/if}
  {/key}
{/if}

<div class="footer">
  This blog is powered by <a href="https://github.com/dtonon/oracolo">Oracolo</a> and Nostr.
  <a href="https://oracolo.me">Make your own</a>.<br /><br />

  {#if !missingConfig}
    Would you like to host this website yourself? It's just one HTML file,
    <button on:click={() => downloadHtmlApp()} class="link-button">download it</button>.<br /><br />

    {#if relays.length > 0}
      This page connects to some servers (Nostr relays) to retrieve data: {relays.join(', ')}
    {/if}
  {/if}
</div>

<ThemeSwitch />
