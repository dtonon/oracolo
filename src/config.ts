import * as nip19 from 'nostr-tools/nip19'

export const getConfig = () => {
  const authorMeta = document.querySelector('meta[name="author"]');
  const relaysMeta = document.querySelector('meta[name="relays"]');
  const topNotesMeta = document.querySelector('meta[name="top-notes"]');
  const includeShortMeta = document.querySelector('meta[name="include-short"]');

  if (!authorMeta || !relaysMeta || !topNotesMeta || !includeShortMeta) {
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
  const topNotes = topNotesMeta.getAttribute('value') || 0;

  function toNumber(charCount) {
    if (charCount === null || charCount === undefined || charCount.trim() === "") {
      return 0;
    } else {
      let number = parseFloat(charCount);
      return isNaN(number) ? 0 : number;
    }
  }

  const charCount = includeShortMeta.getAttribute('value');
  const includeShort = toNumber(charCount);

  return { publicKey, relays, topNotes, includeShort };
};