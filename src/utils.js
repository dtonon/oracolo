import { getConfig } from './config';
import { SimplePool } from 'nostr-tools/pool';
import { nip19 } from 'nostr-tools';

export function isRootNote(event) {
  // Loop through the tags and check the condition
  for (let tag of event.tags) {
    if (tag[0] === 'e' && (tag[3] === 'root' || tag[3] === 'reply')) {
      return false;
    }
  }
  return true;
}

export function getEventData(event) {
  let extractedTitle;
  let extractedSummary;

  if (event.kind == 30023) {
    extractedTitle = event?.tags.find(([k]) => k === 'title')?.[1] || 'No title'
    extractedSummary = event?.tags.find(([k]) => k === 'summary')?.[1] || undefined
  } else {
    extractedTitle = "Note of " + new Intl.DateTimeFormat('en-US', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(event.created_at * 1000))
    extractedSummary = event.content.slice(0, 200) + "..."
  }

  return {
    id: event.id,
    created_at: event.created_at,
    title: extractedTitle,
    image: event?.tags.find(([k]) => k === 'image')?.[1] || undefined,
    summary: extractedSummary,
    content: event.content,
  };
}

export async function getProfile(code) {
  let publicKey;
  if (/^(nprofile|npub)/.test(code)) {
    try {
      const { type, data } = nip19.decode(code);
      if (type === 'npub') {
        publicKey = data;
      } else if (type === 'nprofile') {
        publicKey = data.pubkey;
      }
    } catch (error) {
      console.error('Failed to decode npub:', error);
      return null;
    }
  } else if (code.length === 64) {
    publicKey = code;
  } else {
    console.error('Invalid code format');
    return null;
  }

  const { relays } = getConfig();
  const pool = new SimplePool();

  return new Promise((resolve, reject) => {
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
          subscription.close();
          resolve(event);
        },
        onerror(error) {
          console.error(`Subscription error: ${error}`);
          subscription.close();
          reject(error);
        }
      }
    );
  });
}

export async function processUsersEntities(content) {
  const regexPrefixedEntities = /nostr:(npub1\w+|nprofile1\w+)/g;
  const matches = content.match(regexPrefixedEntities) || [];

  const replacementPromises = matches.map(async (match) => {
    try {
      const profile = await getProfile(match.slice(6)); // Remove "nostr:" prefix

      if (profile) {
        const parsedContent = JSON.parse(profile.content);
        const name = parsedContent.name || match.slice(0, 24);
        return { match, replacement: `[${name}](${match})` };
      } else {
        return { match, replacement: match }; // Fallback to original match
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      return { match, replacement: match }; // Fallback to original match
    }
  });

  const replacements = await Promise.all(replacementPromises);
  let processedContent = content;
  replacements.forEach(({ match, replacement }) => {
    processedContent = processedContent.replace(match, replacement);
  });

  return processedContent;
}

export function processEventsEntities(content) {
  // Prefix plain "nevent1|note1|npub1|nprofile|<alphanumeric string>" with nostr: for further processing
  // Include also entities without prefix inside a markdown link, e.g. [text](nevent1xxxxx)
  const regexEntities = /(^|\s|\n|\()(nevent1\w+|note1\w+|npub1\w+|nprofile1\w+)(?=\s|\n|\)|$)/gm;
  content = content.replace(regexEntities, (match, p1, group1) => {
    const shortenedString = group1.slice(0, 24);
    return `${p1}nostr:${group1}`;
  });

  // Transform plain nostr:(nevent1|note1|npub1|nprofile)<alphanumeric string> in markdown links
  const regexPrefixedEntities = /(^|\s|\n)nostr:(nevent1\w+|note1\w+|npub1\w+|nprofile1\w+)(?=\s|\n|$)/gm;
  content = content.replace(regexPrefixedEntities, (match, p1, group1) => {
    const shortenedString = group1.slice(0, 24);
    return `${p1}[${shortenedString}...](nostr:${group1})`;
  });
  // Transform "nostr:<alphanumeric string>" inside a markedown link with a njump.me link
  const regexNostrLinks = /\(nostr:([a-zA-Z0-9]+)\)/g;
  content = content.replace(regexNostrLinks, (match, group) => {
    // Construct the replacement string with "https://njump.me/<alphanumeric string>
    return `(https://njump.me/${group})`;
  });
  return content;
}

export function cleanMarkdownLinks(text) {
  // Regular expression to match markdown links
  const regexMarkdownLinks = /\[([^\]]+)\]\(([^)]+)\)/g;

  // Replace markdown links with just the text
  const cleanedText = text.replace(regexMarkdownLinks, (match, p1) => p1);

  return cleanedText;
}

export function processImageUrls(text) {
  // Regular expression to match the image URL
  const imageUrlRegex = /\s+(https?:\/\/\S+\.(?:png|jpg|jpeg|gif|bmp))\s+/gi;
  
  // Replace the image URL with Markdown syntax
  const markdownText = text.replace(imageUrlRegex, (match, group) => {
      return `![Image](${group})`; // Markdown syntax for displaying an image
  });

  return markdownText;
}

export function processVideoUrls(text) {
  // Regular expression to match the video URL
  const videoUrlRegex = /\s+(https?:\/\/\S+\.(?:mp4|webm|ogg|mov))(\s+|$)/gi;
  
  // Replace the video URL with HTML <video> tag
  const htmlText = text.replace(videoUrlRegex, (match, group) => {
      return `<video controls><source src="${group}" type="video/mp4"></video>`; // HTML <video> tag
  });

  return htmlText;
}


export function formatDate(timestamp) {
  // Options for Intl.DateTimeFormat to get the desired format
  const options = { day: '2-digit', month: 'long', year: 'numeric' };
  
  // Create a new Date object from the timestamp (assumes timestamp is in seconds)
  const date = new Date(timestamp * 1000);

  // Format the date parts using Intl.DateTimeFormat
  const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(date);

  // Extract day, month, and year from the parts
  let day, month, year;
  parts.forEach(part => {
    if (part.type === 'day') day = part.value;
    if (part.type === 'month') month = part.value;
    if (part.type === 'year') year = part.value;
  });

  // Combine parts into the desired format: "XX Month Year"
  return `${day} ${month} ${year}`;
}