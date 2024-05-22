import * as nip19 from 'nostr-tools/nip19'

export const getConfig = () => {
  const authorMeta = document.querySelector('meta[name="author"]');
  const relaysMeta = document.querySelector('meta[name="relays"]');

  if (!authorMeta || !relaysMeta) {
    throw new Error("Missing meta tags for configuration");
  }

  const npub = authorMeta.getAttribute('value');
  let publicKey;
  if (npub) {
    try {
      const { type, data } = nip19.decode(npub);
      publicKey = data;
    } catch (error) {
      console.error('Failed to decode npub:', error);
      publicKey = ''
    }
  }
  const relays = relaysMeta.getAttribute('value')?.split(',').map(url => url.trim());

  return { publicKey, relays };
};