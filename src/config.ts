import * as nip19 from 'nostr-tools/nip19'

export const getConfig = () => {
  const authorMeta = document.querySelector('meta[name="author"]');
  const relaysMeta = document.querySelector('meta[name="relays"]');
  const topNotesMeta = document.querySelector('meta[name="top-notes"]');
  const shortCharsMeta = document.querySelector('meta[name="short-chars"]');
  const topicsMeta = document.querySelector('meta[name="topics"]');

  if (!authorMeta || !relaysMeta || !topNotesMeta || !shortCharsMeta || !topicsMeta) {
    throw new Error("Missing meta tags for configuration");
  }

  const npub = authorMeta.getAttribute('value');
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

  const charCount = shortCharsMeta.getAttribute('value');
  const shortChars = toNumber(charCount);

  const topics = topicsMeta.getAttribute('value')?.split(',').map(item => item.trim()).filter(item => item !== '');

  return { npub, relays, topNotes, shortChars, topics };
};