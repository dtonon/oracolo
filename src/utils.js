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