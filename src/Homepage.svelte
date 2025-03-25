<script lang="ts">
  import { onMount } from 'svelte';
  import { decode } from '@nostr/tools/nip19';
  import { type NostrEvent } from '@nostr/tools/core';
  import { pool } from '@nostr/gadgets/global';
  import { loadRelayList } from '@nostr/gadgets/lists';
  import type { Filter } from '@nostr/tools/filter';

  import { getProfile } from './utils';
  import Loading from './Loading.svelte';
  import ThemeSwitch from './ThemeSwitch.svelte';
  import { fade } from 'svelte/transition';

  // User data
  let npub = '';
  let userName = '';
  let userPicture = '';
  let isLoading = false;
  let userFound = false;
  let error = '';
  let userWriteRelays: string[] = [];
  let userPubkey = '';
  let pinnedEventError = '';

  // Blog configuration
  let topics: string[] = [];
  let newTopic = '';
  let enableComments = false;

  // Block selection
  type BlockType = 'articles' | 'notes' | 'images' | undefined;
  type BlockStyle = 'list' | 'grid' | 'slide' | undefined;
  type SelectionMode = 'automatic' | 'pinned';

  let isAddPinnedDisabled: boolean;
  $: isAddPinnedDisabled = selectionMode === 'pinned' && newpinnedEvents.length === 0;

  interface Block {
    type: BlockType;
    count: number;
    style: BlockStyle;
    minChars?: number;
    isPinned?: boolean;
    pinnedEvents?: string[];
  }

  // This tracks whether we need to update the previews when the block type changes
  let previousBlockType: BlockType = 'articles';
  let previousSelectionMode: SelectionMode = 'automatic';

  // Update block style when type changes
  $: {
    // Only for pinned blocks
    if (selectionMode === 'pinned') {
      // If block type has changed, reset and clear all pinned events
      if (newBlockType !== previousBlockType || selectionMode !== previousSelectionMode) {
        // Clear all pinned events when type changes
        if (newBlockType !== previousBlockType && newpinnedEvents.length > 0) {
          newpinnedEvents = [];
          pinnedPreviews = {};
          pinnedEventError = '';
        }

        previousBlockType = newBlockType;
        previousSelectionMode = selectionMode;
      }
    } else {
      previousSelectionMode = selectionMode;
    }
  }

  let blocks: Block[] = [];
  let newBlockType: BlockType = 'articles';
  let newBlockCount = 5;
  let newBlockStyle: BlockStyle = 'grid';
  let newBlockMinChars: number | undefined = undefined;
  let selectionMode: SelectionMode = 'automatic';
  let newpinnedEvents: string[] = [];
  let newPinnedId = '';

  // Domain preview
  let domainPreview = '';
  let baseDomain = '';
  let userDomain = '';

  // Dragging state
  let draggedBlockIndex: number | null = null;
  let dropTargetIndex: number | null = null;

  function isValidNpub(value: string): boolean {
    try {
      if (value.startsWith('npub1')) {
        const decoded = decode(value);
        return decoded.type === 'npub';
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  function isValidNip05(value: string): boolean {
    // Simple check for user@domain.tld format
    return /^([a-zA-Z0-9-_.]+)@([a-zA-Z0-9-.]+)$/.test(value);
  }

  function getBaseDomain(): string {
    const url = new URL(window.location.href);
    return `${url.hostname}${url.port ? ':' + url.port : ''}`;
  }

  function resetUserSearch() {
    userFound = false;
    npub = '';
    error = '';
    blocks = [];
    topics = [];
    enableComments = false;
    newpinnedEvents = [];
    pinnedPreviews = {};
    pinnedEventError = '';
    updateDomainPreview();
    setTimeout(() => {
      npubInput.focus();
    });
  }

  async function searchUser() {
    if (!isValidNpub(npub) && !isValidNip05(npub)) {
      error = 'Please enter a valid npub or NIP-05 address';
      return;
    }

    isLoading = true;
    error = '';
    userFound = false;

    // Reset pinned elements when searching for a new user identifier
    newpinnedEvents = [];
    pinnedPreviews = {};
    pinnedEventError = '';

    // Remove all pinned blocks from the blocks array
    blocks = blocks.filter((block) => !block.isPinned);

    try {
      const userProfile = await getProfile(npub);

      if (userProfile) {
        userName = userProfile.metadata.name || userProfile.shortName || '';
        userPicture = userProfile.image || '';
        npub = userProfile.npub; // Force it to override the possible NIP-05
        userFound = true;
        userPubkey = userProfile.pubkey;

        // Get the user's write relays
        const rl = (await loadRelayList(decode(npub).data as string)).items;
        userWriteRelays = rl.filter((r) => r.write).map((r) => r.url);

        updateDomainPreview();
      } else {
        error = 'User not found in any of the relays';
      }
    } catch (e) {
      error = 'Error searching for user';
      console.error('Error fetching profile:', e);
    } finally {
      isLoading = false;
    }
  }

  // ------------------------------------------------------------
  // Topics handling
  // ------------------------------------------------------------

  function addTopic() {
    if (!newTopic) return;

    // Split input by commas
    const newTopics = newTopic
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t !== '');

    let topicsAdded = false;
    newTopics.forEach((topic) => {
      if (!topics.includes(topic)) {
        topics = [...topics, topic];
        topicsAdded = true;
      }
    });

    if (topicsAdded) {
      newTopic = '';
      updateDomainPreview();
    }
  }

  function removeTopic(topic: string) {
    topics = topics.filter((t) => t !== topic);
    updateDomainPreview();
  }

  let draggedTopicIndex: number | null = null;
  let dragOverTopicIndex: number | null = null;

  function handleTopicDragStart(e: DragEvent, index: number) {
    draggedTopicIndex = index;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
    }
  }

  function handleTopicDragOver(e: DragEvent, index: number) {
    e.preventDefault();
    if (draggedTopicIndex !== null && draggedTopicIndex !== index) {
      dragOverTopicIndex = index;
    }
  }

  function handleTopicDrop(e: DragEvent) {
    e.preventDefault();
    if (draggedTopicIndex !== null && dragOverTopicIndex !== null) {
      const newTopics = [...topics];
      const [movedTopic] = newTopics.splice(draggedTopicIndex, 1);
      newTopics.splice(dragOverTopicIndex, 0, movedTopic);
      topics = newTopics;
      updateDomainPreview();
    }
    draggedTopicIndex = null;
    dragOverTopicIndex = null;
  }

  function handleTopicDragEnd() {
    draggedTopicIndex = null;
    dragOverTopicIndex = null;
  }

  // ------------------------------------------------------------
  // Pinned event IDs handling
  // ------------------------------------------------------------
  interface PinnedEventPreview {
    id: string; // The event ID (hex) for fetching/storing (set after fetch for naddr)
    entityCode?: string; // Original bech32 code or address (undefined for raw hex)
    identifierCode?: string; // d-tag for addressable events
    kind?: number;
    pubkey?: string;
    preview: string;
    type: BlockType;
    isLoading: boolean;
    imageUrl?: string;
    typeValid?: boolean; // Flag indicating if event kind matches the expected type
  }

  let pinnedPreviews: { [key: string]: PinnedEventPreview } = {};

  const blockTypeToKind = (type: BlockType) => {
    switch (type) {
      case 'articles':
        return 30023;
      case 'notes':
        return 1;
      case 'images':
        return 20;
    }
  };

  async function addPinnedId() {
    if (!newPinnedId) return;

    pinnedEventError = '';

    const pinnedEvents = newPinnedId
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id !== '');

    let idsAdded = false;
    for (const id of pinnedEvents) {
      try {
        const eventData = extractEventData(id);

        // Invalid ID check
        if (
          eventData.type === undefined ||
          (['note', 'nevent', 'hex'].includes(eventData.type) &&
            (!eventData.eventId || !/^[0-9a-f]{64}$/i.test(eventData.eventId)))
        ) {
          pinnedEventError = `Invalid event ID format: ${id}`;
          console.log(pinnedEventError);
          continue;
        }

        // For naddr, validate the required fields
        if (
          eventData.type === 'naddr' &&
          (!eventData.pubkey || !eventData.dTag || eventData.kind === undefined)
        ) {
          pinnedEventError = `Invalid naddr format: ${id}`;
          console.log(pinnedEventError);
          continue;
        }

        // TODO: Refactor the checks merging note+nevent+hex and naddr as much as possible

        // For direct event IDs (note, nevent, hex), use the actual hex event ID
        if (['note', 'nevent', 'hex'].includes(eventData.type) && eventData.eventId) {
          // Check if we already have this exact event ID in our list
          if (newpinnedEvents.includes(eventData.eventId)) {
            pinnedEventError = `Duplicate event: "${shortenEventId(id)}" already in list`;
            newPinnedId = '';
            continue;
          }

          // Check existing previews for matching event IDs
          const duplicateEntry = Object.entries(pinnedPreviews).find(
            ([_, preview]) => preview && preview.id === eventData.eventId
          );

          if (duplicateEntry) {
            pinnedEventError = `Duplicate event: "${shortenEventId(id)}" matches "${shortenEventId(duplicateEntry[0])}"`;
            newPinnedId = '';
            continue;
          }

          // Store the actual event ID directly
          newpinnedEvents = [...newpinnedEvents, eventData.eventId];

          // Set initial state with all available data from extraction
          let updatedPreviews = { ...pinnedPreviews };

          updatedPreviews[eventData.eventId] = {
            id: eventData.eventId,
            entityCode: ['note', 'nevent', 'hex'].includes(eventData.type) ? id : undefined,
            preview: 'Loading...',
            type: newBlockType,
            isLoading: true
          };
          pinnedPreviews = updatedPreviews;

          // Fetch the preview data
          const result = await fetchPinnedEventPreview(id, newBlockType);

          // Handle errors
          if (result.error) {
            pinnedEventError = result.error;
            console.log(pinnedEventError);

            // Remove from IDs and previews
            newpinnedEvents = newpinnedEvents.filter((i) => i !== eventData.eventId);
            let updatedPreviews = { ...pinnedPreviews };
            delete updatedPreviews[eventData.eventId];
            pinnedPreviews = updatedPreviews;
            continue;
          }

          // Check if the event is of the expected type
          if (!result.typeValid) {
            // Set a more user-friendly error message explaining the type mismatch
            pinnedEventError = `Type mismatch: Found ${result.detectedType} (kind ${result.event!.kind}) but expected ${newBlockType} (kind ${blockTypeToKind(newBlockType)})`;
            console.warn(pinnedEventError);

            // Remove from IDs and previews - we don't want to add events of the wrong type
            newpinnedEvents = newpinnedEvents.filter((i) => i !== eventData.eventId);
            let updatedPreviews = { ...pinnedPreviews };
            delete updatedPreviews[eventData.eventId];
            pinnedPreviews = updatedPreviews;

            newPinnedId = '';

            // Skip this event entirely
            continue;
          }

          // Update preview with the returned data
          let localUpdatedPreviews = { ...pinnedPreviews };
          localUpdatedPreviews[eventData.eventId] = {
            id: eventData.eventId,
            entityCode: ['note', 'nevent', 'hex'].includes(eventData.type) ? id : undefined,
            preview: result.preview ? result.preview : '',
            imageUrl: result.imageUrl,
            isLoading: false,
            type: result.detectedType,
            typeValid: result.typeValid
          };
          pinnedPreviews = localUpdatedPreviews;
        }
        // For naddr, check by identifier code + kind + pubkey
        else if (eventData.type === 'naddr') {
          // Check existing previews for matching addressable parameters
          const duplicateEntry = Object.entries(pinnedPreviews).find(
            ([_, preview]) =>
              preview &&
              preview.identifierCode === eventData.dTag &&
              preview.kind === eventData.kind &&
              preview.pubkey === eventData.pubkey
          );

          if (duplicateEntry) {
            pinnedEventError = `Duplicate addressable event: "${shortenEventId(id)}" matches "${shortenEventId(duplicateEntry[0])}"`;
            continue;
          }

          // Check for direct event ID match in existing previews that might be the same event
          // This handles the case where an naddr might point to a known event
          let directIdMatch = false;
          // We don't have the event ID yet, so need to do a deeper search
          if (eventData.pubkey && eventData.kind && eventData.dTag) {
            const existingHexEvent = Object.entries(pinnedPreviews).find(
              ([previewKey, preview]) =>
                // Skip tempKey entries and loading entries
                previewKey !== `naddr:${id}` &&
                !previewKey.startsWith('naddr:') &&
                preview &&
                !preview.isLoading &&
                // Match on kind and pubkey for possible match
                preview.kind === eventData.kind &&
                preview.pubkey === eventData.pubkey
            );

            if (existingHexEvent) {
              directIdMatch = true;
              pinnedEventError = `Potential duplicate event: "${shortenEventId(id)}" might match "${shortenEventId(existingHexEvent[0])}"`;
              newPinnedId = '';
              continue;
            }
          }

          if (directIdMatch) {
            continue;
          }

          // For naddr, we need to fetch the event to get its ID first
          // Then we can check for duplicates with the actual ID
          // First fetch the event to get its ID - we do this BEFORE adding anything to the UI
          const result = await fetchPinnedEventPreview(id, newBlockType);

          // If we get an error, stop processing this ID
          if (result.error) {
            pinnedEventError = result.error;
            console.log(pinnedEventError);
            continue;
          }

          // Check if the event is of the expected type
          if (!result.typeValid) {
            // Set a more user-friendly error message explaining the type mismatch
            pinnedEventError = `Type mismatch: Found ${result.detectedType} (kind ${result.event!.kind}) but expected ${newBlockType} (kind ${blockTypeToKind(newBlockType)})`;
            console.warn(pinnedEventError);

            // Skip this event entirely since it's the wrong type
            continue;
          }

          // We need the actual event object
          const event = result.event;

          if (event === undefined) {
            console.log(`Undefined event`);
            continue;
          }

          // Now check if this event ID is already in our list (duplicate check with real ID)
          const duplicateById = Object.entries(pinnedPreviews).find(
            ([_, preview]) => preview && !preview.isLoading && preview.id === event.id // Match on actual event ID
          );

          if (duplicateById) {
            pinnedEventError = `Duplicate event detected: "${shortenEventId(id)}" matches "${shortenEventId(duplicateById[0])}"`;
            newPinnedId = '';
            continue;
          }

          // If we got here, it's a valid new event - add it to our IDs list with the real event ID
          newpinnedEvents = [...newpinnedEvents, event.id];

          // Create the preview with all the data we've already fetched
          let updatedPreviews = { ...pinnedPreviews };

          // Create the preview with the event ID and data we already have
          updatedPreviews[event.id] = {
            id: event.id,
            entityCode: id,
            identifierCode: eventData.dTag,
            kind: eventData.kind,
            pubkey: eventData.pubkey,
            preview: result.preview ? result.preview : '',
            imageUrl: result.imageUrl,
            isLoading: false,
            type: result.detectedType,
            typeValid: result.typeValid
          };
          pinnedPreviews = updatedPreviews;
        } else {
          // Unknown type - shouldn't get here due to earlier validation
          continue;
        }
        idsAdded = true;
      } catch (error) {
        pinnedEventError = `Error processing ID ${id}: ${(error as any).message}`;
        console.error(pinnedEventError);
      }
    }

    // Clear input
    if (idsAdded) {
      newPinnedId = '';
    } else if (!pinnedEventError) {
      console.log('? - No new event IDs added');
    }
  }

  function removePinnedId(id: string) {
    newpinnedEvents = newpinnedEvents.filter((i) => i !== id);

    // Also remove the preview with a new object to trigger reactivity
    const updatedPreviews = { ...pinnedPreviews };
    delete updatedPreviews[id];
    pinnedPreviews = updatedPreviews;

    pinnedEventError = '';
  }
  interface PinnedEventPreviewResult {
    error?: string;
    event?: NostrEvent;
    preview?: string;
    imageUrl?: string;
    detectedType?: BlockType;
    typeValid?: boolean;
    originalId?: string;
  }

  async function fetchPinnedEventPreview(
    originalId: string,
    type: BlockType
  ): Promise<PinnedEventPreviewResult> {
    // Get eventData for relay info and filter creation
    const eventData = extractEventData(originalId);

    try {
      // Collect relays from the extracted data and merge with user write relays
      let eventRelays: string[] = eventData.relays || [];
      const relays = [...new Set([...eventRelays, ...userWriteRelays])];

      // Use the shared blockTypeToKind for later type checking, but don't restrict the search

      let filter: Filter;
      if (
        eventData.type &&
        ['note', 'nevent', 'hex'].includes(eventData.type) &&
        eventData.eventId
      ) {
        filter = {
          ids: [eventData.eventId],
          authors: [userPubkey]
        };
      } else if (eventData.type === 'naddr' && eventData.pubkey && eventData.dTag) {
        filter = {
          authors: [eventData.pubkey],
          '#d': [eventData.dTag]
        };
      } else {
        throw new Error('Failed to create a valid filter from event data');
      }

      let foundEvent = false;

      // Create a promise that will resolve when we get the event or time out
      return new Promise<PinnedEventPreviewResult>((resolve) => {
        // Cleanup timeout to avoid hanging connections
        const timeoutId = setTimeout(() => {
          if (!foundEvent) {
            resolve({
              error: `Timeout waiting for event: ${shortenEventId(originalId)}`
            });
          }
        }, 15000);

        // Subscribe to the event
        const sub = pool.subscribeMany(relays, [filter], {
          onevent(event) {
            foundEvent = true;
            clearTimeout(timeoutId);

            let preview = '';
            let imageUrl = undefined;
            let detectedType: BlockType = type;
            let typeValid = true; // Flag to track if the event kind matches the expected type

            try {
              // Determine what type of event we found
              if (event.kind === 30023) {
                detectedType = 'articles';
                preview = event.tags.find(([k]) => k === 'title')?.[1] || 'Untitled article';
              } else if (event.kind === 1) {
                detectedType = 'notes';
                preview =
                  event.content.length > 30
                    ? event.content.substring(0, 30) + '...'
                    : event.content;
              } else if (event.kind === 20) {
                detectedType = 'images';
                // Look for image URLs
                let imgUrl = '';

                // Check imeta tags first
                for (const tag of event.tags) {
                  if (tag[0] === 'imeta' && tag[1]) {
                    const parts = tag[1].split(' ');
                    if (parts.length > 1) {
                      imgUrl = parts[1];
                      break;
                    }
                  }
                }

                imageUrl = imgUrl;
                preview = imgUrl ? 'Image event' : 'Image event (preview unavailable)';
              } else {
                detectedType = undefined;
                preview = `Event kind ${event.kind}`;
              }

              // Check if this is the expected type
              const expectedKind = type ? blockTypeToKind(type) : undefined;
              typeValid = event.kind === expectedKind;

              // If wrong type, just log it - we'll handle the UI in addPinnedId
              if (!typeValid) {
                console.warn(
                  `Event type mismatch: Found event of kind ${event.kind} (${detectedType}) but expected kind ${expectedKind} (${type})`
                );
              }

              // Return all the data needed for display
              resolve({
                event,
                preview,
                imageUrl,
                detectedType,
                typeValid,
                originalId
              });
            } catch (error) {
              console.error('Error processing event:', error);
              resolve({
                error: 'Error processing event: ' + (error as any).message
              });
            }

            sub.close();
          },

          oneose() {
            if (!foundEvent) {
              // Event not found
              resolve({
                error: `Event not found or not owned by you: ${shortenEventId(originalId)}`
              });
            }

            sub.close();
          }
        });
      });
    } catch (error) {
      console.error('Error in fetchPinnedEventPreview:', error);
      return {
        error: 'Error: ' + ((error as any).message || 'Unknown error')
      };
    }
  }

  function extractEventData(input: string): {
    type: 'note' | 'nevent' | 'naddr' | 'hex' | undefined;
    eventId?: string;
    pubkey?: string;
    dTag?: string;
    kind?: number;
    relays?: string[];
  } {
    if (
      input.startsWith('note1') ||
      input.startsWith('nevent1') ||
      input.startsWith('naddr1') ||
      input.startsWith('npub1')
    ) {
      try {
        const decoded = decode(input);

        if (decoded.type === 'note') {
          return {
            type: 'note',
            eventId: decoded.data as string
          };
        } else if (decoded.type === 'nevent') {
          const relays =
            decoded.data.relays && Array.isArray(decoded.data.relays)
              ? decoded.data.relays.filter((r) => typeof r === 'string')
              : [];

          return {
            type: 'nevent',
            eventId: decoded.data.id,
            relays
          };
        } else if (decoded.type === 'naddr') {
          const naData = decoded.data;

          const relays =
            naData.relays && Array.isArray(naData.relays)
              ? naData.relays.filter((r) => typeof r === 'string')
              : [];

          return {
            type: 'naddr',
            pubkey: naData.pubkey,
            dTag: naData.identifier,
            kind: naData.kind,
            relays
          };
        }
      } catch (e) {
        console.error('Error decoding Nostr ID:', e);
      }
    }

    // Check for raw hex IDs (64 characters of hex)
    if (/^[0-9a-f]{64}$/i.test(input)) {
      return {
        type: 'hex',
        eventId: input
      };
    }

    // If nothing matched, return unknown type
    return { type: undefined };
  }

  function shortenEventId(id: string): string {
    if (!id) return '';

    // If it's a bech32 ID (note1, nevent1), preserve the prefix
    if (id.startsWith('note1') || id.startsWith('nevent1') || id.startsWith('naddr1')) {
      const prefix = id.substring(0, id.indexOf('1') + 1);
      const rest = id.substring(prefix.length);
      return `${prefix}${rest.substring(0, 8)}...${rest.substring(rest.length - 8)}`;
    }

    // For hex IDs
    return `${id.substring(0, 8)}...${id.substring(id.length - 8)}`;
  }

  // ------------------------------------------------------------
  // Blocks handling
  // ------------------------------------------------------------

  function addStadardBlocksConfig(event: { preventDefault: () => void }) {
    event.preventDefault();
    blocks = [
      { type: 'articles', count: 3, style: 'grid' },
      { type: 'notes', count: 10, style: 'slide', minChars: 400 },
      { type: 'articles', count: 2, style: 'grid' },
      { type: 'images', count: 10, style: 'grid' },
      { type: 'articles', count: 10, style: 'list' },
      { type: 'articles', count: 2, style: 'grid' },
      { type: 'articles', count: 10, style: 'list' }
    ];
    updateDomainPreview();
  }

  function addBlock() {
    if (selectionMode === 'pinned') {
      // If it's a pinned block, we need at least one event ID
      if (newpinnedEvents.length === 0) {
        return;
      }

      // Check for type mismatches before creating the block
      const mismatchedIds = newpinnedEvents.filter((id) => pinnedPreviews[id]?.typeValid === false);

      if (mismatchedIds.length > 0) {
        pinnedEventError = `Cannot create block with mismatched event types. Please remove the mismatched events or change the block type.`;
        return;
      }

      // Process the IDs to ensure they all use real event IDs
      const processedIds = newpinnedEvents.map((id) => {
        // Get the preview which should always contain the proper data
        const preview = pinnedPreviews[id];

        // Always use the ID from the preview - for both direct IDs and naddr references
        // The ID will be the actual event ID in both cases
        if (preview && preview.id) {
          return preview.id;
        }

        // This should never happen, but as a fallback extract directly
        console.warn(`Missing preview for ${id}, extracting directly`);
        const eventData = extractEventData(id);
        if (
          eventData.type &&
          ['note', 'nevent', 'hex'].includes(eventData.type) &&
          eventData.eventId
        ) {
          return eventData.eventId;
        }

        // Last resort: keep the original ID (though this really shouldn't happen)
        console.warn(`Could not get proper event ID for ${id}, using as-is`);
        return id;
      });

      // Determine block type based on the previews if available
      // Default to a mixed type if we have different kinds
      let detectedType: BlockType = 'articles'; // Default
      let hasImages = false;
      let hasNotes = false;
      let hasArticles = false;

      // Check each preview to determine the kind
      for (const id of newpinnedEvents) {
        const preview = pinnedPreviews[id];
        if (preview) {
          if (preview.imageUrl) {
            hasImages = true;
          } else if (preview.type === 'notes') {
            hasNotes = true;
          } else if (preview.type === 'articles') {
            hasArticles = true;
          }
        }
      }

      // Set the block type based on detected kinds
      if (hasImages && !hasNotes && !hasArticles) {
        detectedType = 'images';
      } else if (hasNotes && !hasArticles && !hasImages) {
        detectedType = 'notes';
      } else if (hasArticles && !hasNotes && !hasImages) {
        detectedType = 'articles';
      } else {
        // Mixed content or unknown - use a default
        console.log('Mixed content types detected in pinned events');
        detectedType = 'articles';
      }

      // // Set undefined to apply the default style
      let blockStyle: BlockStyle;
      blockStyle = undefined;

      // Clear any error message
      pinnedEventError = '';

      const block: Block = {
        type: detectedType,
        count: 0, // Not used for pinned blocks
        style: blockStyle,
        isPinned: true,
        pinnedEvents: processedIds
      };

      blocks = [...blocks, block];

      // Reset pinned IDs for next block and previews
      newpinnedEvents = [];
      pinnedPreviews = {};
      selectionMode = 'automatic';
    } else {
      // Regular block
      if (newBlockCount <= 0) return;

      const block: Block = {
        type: newBlockType,
        count: newBlockCount,
        style: newBlockStyle
      };

      if (newBlockMinChars && newBlockMinChars > 0) {
        block.minChars = newBlockMinChars;
      }

      blocks = [...blocks, block];
    }

    updateDomainPreview();
  }

  function removeBlock(index: number) {
    blocks = blocks.filter((_, i) => i !== index);
    updateDomainPreview();
  }

  // ------------------------------------------------------------
  // Drag and drop handlers for blocks reordering
  // ------------------------------------------------------------

  function handleDragStart(index: number) {
    draggedBlockIndex = index;
  }

  function handleDragOver(index: number, event: DragEvent) {
    event.preventDefault();
    dropTargetIndex = index;
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    if (
      draggedBlockIndex !== null &&
      dropTargetIndex !== null &&
      draggedBlockIndex !== dropTargetIndex
    ) {
      const blocksArray = [...blocks];
      const [movedBlock] = blocksArray.splice(draggedBlockIndex, 1);
      blocksArray.splice(dropTargetIndex, 0, movedBlock);
      blocks = blocksArray;
      updateDomainPreview();
    }
    handleDragEnd();
  }

  function handleDragEnd() {
    draggedBlockIndex = null;
    dropTargetIndex = null;
  }

  // ------------------------------------------------------------
  // Domain helper functions
  // ------------------------------------------------------------

  function processSubdomain(input: string): string | undefined {
    // Remove protocol if present
    let domain = input.trim();
    domain = domain.replace(/^https?:\/\//, '');

    // Remove trailing slashes and anything after
    domain = domain.split('/')[0];

    // Remove trailing dots
    domain = domain.replace(/\.+$/, '');

    // If it's just a single word (like "www"), return it as is
    const parts = domain.split('.');

    const validParts = parts.filter((part) => part.length > 0);

    // Otherwise, return the full domain as is since the DNS record will need it
    return validParts.length >= 3 ? domain : undefined;
  }

  let domainValidationTimer: ReturnType<typeof setTimeout> | null = null;
  let showDomainValidation = false;

  function handleDomainInput() {
    if (domainValidationTimer) {
      clearTimeout(domainValidationTimer);
    }

    showDomainValidation = false;

    domainValidationTimer = setTimeout(() => {
      showDomainValidation = true;
    }, 800);
  }

  function updateDomainPreview() {
    if (!npub) return;

    baseDomain = getBaseDomain();

    let subdomains = [npub];

    [...blocks].forEach((block) => {
      let blockString = '';

      if (block.isPinned && block.pinnedEvents && block.pinnedEvents.length > 0) {
        switch (block.type) {
          case 'articles':
            blockString = 'ba-';
            break;
          case 'notes':
            blockString = 'bn-';
            break;
          case 'images':
            blockString = 'bi-';
            break;
        }

        // Add each pinned ID (using last 5 chars of each ID)
        block.pinnedEvents.forEach((id) => {
          const shortId = id.length > 5 ? id.substring(id.length - 5) : id;
          blockString += `i${shortId}-`;
        });
        blockString = blockString.slice(0, -1); // Remove the final dash

        if (block.style !== undefined) {
          blockString += `-${block.style}`;
        }
      } else {
        switch (block.type) {
          case 'articles':
            blockString = `ba-${block.count}`;
            break;
          case 'notes':
            blockString = `bn-${block.count}`;
            break;
          case 'images':
            blockString = `bi-${block.count}`;
            break;
        }

        blockString += `-${block.style}`;

        if (block.minChars) {
          blockString += `-m${block.minChars}`;
        }
      }

      subdomains.push(blockString);
    });

    if (enableComments) {
      subdomains.push('c');
    }

    if (topics.length > 0) {
      subdomains.push(`t-${topics.join('-')}`);
    }

    domainPreview = subdomains.join('.');
  }

  // ------------------------------------------------------------
  // Function to download the blog as a single HTML file
  // ------------------------------------------------------------

  function startBlogDownload() {
    try {
      const blogUrl = `http://${domainPreview}.${baseDomain}?download=true`;
      window.open(blogUrl, '_blank');
    } catch (error) {
      console.error('Error opening blog URL:', error);
      alert(`Failed to open blog: ${(error as any).message}`);
    }
  }

  // ------------------------------------------------------------
  // Initialize with default blocks
  // ------------------------------------------------------------

  let npubInput: HTMLInputElement;

  onMount(() => {
    baseDomain = getBaseDomain();

    blocks = [];
    updateDomainPreview();

    // Check for npub query parameter
    const url = new URL(window.location.href);
    const npubParam = url.searchParams.get('npub');

    if (npubParam && isValidNpub(npubParam)) {
      // Set the npub input and trigger search
      npub = npubParam;
      searchUser();
    }

    if (npubInput) {
      npubInput.focus();
    }
  });
</script>

<div class="homepage {!userFound && !isLoading ? 'initial-state' : ''}">
  <div class="theme-switch">
    <ThemeSwitch />
  </div>

  <div class="homepage-body">
    <header>
      <h1>
        <svg
          fill="currentColor"
          width="100%"
          height="100%"
          viewBox="0 0 396 52"
          version="1.1"
          xmlns="http://www.w3.org/2000/svg"
          xmlns:xlink="http://www.w3.org/1999/xlink"
          xml:space="preserve"
          style="fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2;"
        >
          <g transform="matrix(3.0134,0,0,3.0134,-2.65937,-17.0245)">
            <path
              d="M8.395,5.838C8.576,5.989 8.667,6.193 8.667,6.449L8.667,8.146C8.667,8.342 8.61,8.512 8.497,8.655C8.384,8.799 8.229,8.893 8.033,8.938C7.068,9.134 6.245,9.595 5.567,10.319C4.646,11.284 4.186,12.54 4.186,14.086C4.186,15.633 4.646,16.896 5.567,17.877C6.245,18.586 7.068,19.038 8.033,19.234C8.229,19.28 8.384,19.374 8.497,19.517C8.61,19.66 8.667,19.83 8.667,20.026L8.667,21.723C8.667,21.965 8.576,22.168 8.395,22.334C8.229,22.455 8.056,22.515 7.875,22.515L7.739,22.515C5.989,22.229 4.488,21.437 3.236,20.139C1.667,18.525 0.883,16.515 0.883,14.109C0.883,11.703 1.667,9.677 3.236,8.033C4.458,6.766 5.959,5.981 7.739,5.68C7.98,5.635 8.199,5.687 8.395,5.838ZM15.501,8.033C17.069,9.677 17.854,11.703 17.854,14.109C17.854,16.515 17.069,18.525 15.501,20.139C14.248,21.437 12.747,22.229 10.997,22.515L10.862,22.515C10.681,22.515 10.507,22.455 10.341,22.334C10.16,22.168 10.07,21.965 10.07,21.723L10.07,20.026C10.07,19.83 10.126,19.66 10.239,19.517C10.353,19.374 10.507,19.28 10.703,19.234C11.669,19.038 12.491,18.586 13.17,17.877C14.09,16.896 14.55,15.633 14.55,14.086C14.55,12.54 14.09,11.284 13.17,10.319C12.491,9.595 11.669,9.134 10.703,8.938C10.507,8.893 10.353,8.799 10.239,8.655C10.126,8.512 10.07,8.342 10.07,8.146L10.07,6.449C10.07,6.193 10.164,5.989 10.353,5.838C10.541,5.687 10.756,5.635 10.997,5.68C12.778,5.981 14.279,6.766 15.501,8.033ZM33.296,15.953L36.713,21.18C36.879,21.452 36.886,21.723 36.735,21.995C36.675,22.116 36.581,22.214 36.452,22.289C36.324,22.365 36.192,22.402 36.056,22.402L33.997,22.402C33.861,22.402 33.733,22.368 33.612,22.3C33.492,22.233 33.401,22.146 33.341,22.04L29.901,16.587L25.874,16.587L25.874,21.61C25.874,21.821 25.794,22.006 25.636,22.165C25.478,22.323 25.293,22.402 25.082,22.402L23.362,22.402C23.151,22.402 22.966,22.323 22.807,22.165C22.649,22.006 22.57,21.821 22.57,21.61L22.57,14.165C22.57,13.954 22.649,13.769 22.807,13.611C22.966,13.453 23.151,13.373 23.362,13.373L30.331,13.373C31.659,13.373 32.541,12.996 32.979,12.242C33.13,12.001 33.205,11.654 33.205,11.201C33.205,10.492 32.971,9.934 32.504,9.527C32.021,9.089 31.327,8.87 30.422,8.87L23.362,8.87C23.151,8.87 22.966,8.791 22.807,8.633C22.649,8.474 22.57,8.29 22.57,8.078L22.57,6.449C22.57,6.238 22.649,6.053 22.807,5.895C22.966,5.736 23.151,5.657 23.362,5.657L30.626,5.657C32.391,5.657 33.801,6.155 34.857,7.151C35.958,8.146 36.509,9.496 36.509,11.201C36.509,12.302 36.268,13.241 35.785,14.018C35.302,14.795 34.601,15.387 33.68,15.795L33.296,15.953ZM56.341,21.339C56.446,21.58 56.42,21.825 56.261,22.074C56.103,22.323 55.888,22.448 55.617,22.448L40.546,22.448C40.41,22.448 40.282,22.414 40.161,22.346C40.041,22.278 39.95,22.191 39.89,22.085C39.724,21.844 39.701,21.595 39.822,21.339L40.523,19.687C40.584,19.536 40.682,19.415 40.817,19.325C40.953,19.234 41.097,19.189 41.247,19.189L51.792,19.189L48.081,10.319L45.049,17.56C44.989,17.711 44.894,17.828 44.766,17.911C44.638,17.993 44.491,18.035 44.325,18.035L42.424,18.035C42.137,18.035 41.911,17.914 41.745,17.673C41.685,17.567 41.647,17.447 41.632,17.311C41.617,17.175 41.632,17.047 41.677,16.926L46.271,6.155C46.331,6.004 46.426,5.883 46.554,5.793C46.682,5.702 46.829,5.657 46.995,5.657L49.167,5.657C49.333,5.657 49.48,5.702 49.609,5.793C49.737,5.883 49.831,6.004 49.891,6.155L56.341,21.339ZM68.705,8.893C68.509,8.863 68.347,8.772 68.218,8.621C68.09,8.471 68.026,8.297 68.026,8.101L68.026,6.449C68.026,6.193 68.117,5.989 68.298,5.838C68.479,5.687 68.69,5.627 68.931,5.657C70.229,5.868 71.383,6.328 72.393,7.037C73.706,7.988 74.634,9.248 75.177,10.816C75.267,11.073 75.237,11.314 75.086,11.541C74.935,11.767 74.717,11.88 74.43,11.88L72.62,11.88C72.454,11.88 72.303,11.839 72.167,11.756C72.031,11.673 71.933,11.556 71.873,11.405C71.541,10.62 71.036,9.994 70.357,9.527C69.829,9.195 69.278,8.984 68.705,8.893ZM74.43,16.406C74.717,16.406 74.935,16.519 75.086,16.745C75.237,16.971 75.267,17.213 75.177,17.469C74.634,19.038 73.706,20.298 72.393,21.248C71.383,21.957 70.229,22.417 68.931,22.629L68.818,22.629C68.607,22.629 68.433,22.561 68.298,22.425C68.117,22.289 68.026,22.093 68.026,21.837L68.026,20.185C68.026,19.989 68.086,19.815 68.207,19.664C68.328,19.513 68.486,19.423 68.682,19.393C69.316,19.302 69.874,19.091 70.357,18.759C71.036,18.291 71.541,17.665 71.873,16.881C71.933,16.73 72.031,16.613 72.167,16.53C72.303,16.447 72.454,16.406 72.62,16.406L74.43,16.406ZM66.329,5.929C66.525,6.08 66.623,6.283 66.623,6.54L66.623,8.305C66.623,8.471 66.566,8.625 66.453,8.769C66.34,8.912 66.201,9.014 66.035,9.074C65.823,9.119 65.658,9.172 65.537,9.232C64.933,9.504 64.421,9.874 63.998,10.341C63.138,11.307 62.708,12.57 62.708,14.132C62.708,15.693 63.138,16.964 63.998,17.944C64.526,18.548 65.205,18.97 66.035,19.212C66.201,19.257 66.34,19.351 66.453,19.495C66.566,19.638 66.623,19.792 66.623,19.958L66.623,21.746C66.623,22.003 66.525,22.206 66.329,22.357C66.193,22.478 66.02,22.538 65.808,22.538L65.65,22.538C64.036,22.191 62.671,21.407 61.554,20.185C60.121,18.571 59.405,16.557 59.405,14.143C59.405,11.729 60.121,9.715 61.554,8.101C62.671,6.864 64.036,6.087 65.65,5.77C65.891,5.71 66.118,5.763 66.329,5.929ZM86.342,5.838C86.523,5.989 86.613,6.193 86.613,6.449L86.613,8.146C86.613,8.342 86.557,8.512 86.443,8.655C86.33,8.799 86.176,8.893 85.98,8.938C85.014,9.134 84.192,9.595 83.513,10.319C82.593,11.284 82.133,12.54 82.133,14.086C82.133,15.633 82.593,16.896 83.513,17.877C84.192,18.586 85.014,19.038 85.98,19.234C86.176,19.28 86.33,19.374 86.443,19.517C86.557,19.66 86.613,19.83 86.613,20.026L86.613,21.723C86.613,21.965 86.523,22.168 86.342,22.334C86.176,22.455 86.002,22.515 85.821,22.515L85.685,22.515C83.935,22.229 82.434,21.437 81.182,20.139C79.613,18.525 78.829,16.515 78.829,14.109C78.829,11.703 79.613,9.677 81.182,8.033C82.404,6.766 83.905,5.981 85.685,5.68C85.927,5.635 86.145,5.687 86.342,5.838ZM93.447,8.033C95.016,9.677 95.8,11.703 95.8,14.109C95.8,16.515 95.016,18.525 93.447,20.139C92.195,21.437 90.694,22.229 88.944,22.515L88.808,22.515C88.627,22.515 88.454,22.455 88.288,22.334C88.107,22.168 88.016,21.965 88.016,21.723L88.016,20.026C88.016,19.83 88.073,19.66 88.186,19.517C88.299,19.374 88.454,19.28 88.65,19.234C89.615,19.038 90.437,18.586 91.116,17.877C92.036,16.896 92.497,15.633 92.497,14.086C92.497,12.54 92.036,11.284 91.116,10.319C90.437,9.595 89.615,9.134 88.65,8.938C88.454,8.893 88.299,8.799 88.186,8.655C88.073,8.512 88.016,8.342 88.016,8.146L88.016,6.449C88.016,6.193 88.11,5.989 88.299,5.838C88.488,5.687 88.702,5.635 88.944,5.68C90.724,5.981 92.225,6.766 93.447,8.033ZM103.028,5.657C103.239,5.657 103.424,5.736 103.582,5.895C103.741,6.053 103.82,6.238 103.82,6.449L103.82,21.61C103.82,21.821 103.741,22.006 103.582,22.165C103.424,22.323 103.239,22.402 103.028,22.402L101.308,22.402C101.097,22.402 100.912,22.323 100.754,22.165C100.595,22.006 100.516,21.821 100.516,21.61L100.516,6.449C100.516,6.238 100.595,6.053 100.754,5.895C100.912,5.736 101.097,5.657 101.308,5.657L103.028,5.657ZM111.287,19.166C111.514,19.166 111.702,19.246 111.853,19.404C112.004,19.562 112.079,19.747 112.079,19.958L112.079,21.61C112.079,21.821 112.004,22.006 111.853,22.165C111.702,22.323 111.514,22.402 111.287,22.402L106.015,22.402C105.789,22.402 105.6,22.323 105.449,22.165C105.298,22.006 105.223,21.821 105.223,21.61L105.223,19.958C105.223,19.747 105.298,19.562 105.449,19.404C105.6,19.246 105.789,19.166 106.015,19.166L111.287,19.166ZM122.837,5.838C123.018,5.989 123.108,6.193 123.108,6.449L123.108,8.146C123.108,8.342 123.052,8.512 122.939,8.655C122.826,8.799 122.671,8.893 122.475,8.938C121.509,9.134 120.687,9.595 120.008,10.319C119.088,11.284 118.628,12.54 118.628,14.086C118.628,15.633 119.088,16.896 120.008,17.877C120.687,18.586 121.509,19.038 122.475,19.234C122.671,19.28 122.826,19.374 122.939,19.517C123.052,19.66 123.108,19.83 123.108,20.026L123.108,21.723C123.108,21.965 123.018,22.168 122.837,22.334C122.671,22.455 122.498,22.515 122.316,22.515L122.181,22.515C120.431,22.229 118.93,21.437 117.678,20.139C116.109,18.525 115.324,16.515 115.324,14.109C115.324,11.703 116.109,9.677 117.678,8.033C118.9,6.766 120.401,5.981 122.181,5.68C122.422,5.635 122.641,5.687 122.837,5.838ZM129.942,8.033C131.511,9.677 132.296,11.703 132.296,14.109C132.296,16.515 131.511,18.525 129.942,20.139C128.69,21.437 127.189,22.229 125.439,22.515L125.303,22.515C125.122,22.515 124.949,22.455 124.783,22.334C124.602,22.168 124.511,21.965 124.511,21.723L124.511,20.026C124.511,19.83 124.568,19.66 124.681,19.517C124.794,19.374 124.949,19.28 125.145,19.234C126.111,19.038 126.933,18.586 127.612,17.877C128.532,16.896 128.992,15.633 128.992,14.086C128.992,12.54 128.532,11.284 127.612,10.319C126.933,9.595 126.111,9.134 125.145,8.938C124.949,8.893 124.794,8.799 124.681,8.655C124.568,8.512 124.511,8.342 124.511,8.146L124.511,6.449C124.511,6.193 124.606,5.989 124.794,5.838C124.983,5.687 125.198,5.635 125.439,5.68C127.219,5.981 128.72,6.766 129.942,8.033Z"
            />
          </g>
        </svg>
      </h1>
      <p>Do you have a Nostr npub? Well, now you also have a blog!</p>
    </header>

    <div class="wizard">
      <section class="user-section">
        {#if !userFound}
          <h2>Enter your Nostr npub</h2>
          <div class="input-group">
            <input
              type="text"
              bind:value={npub}
              bind:this={npubInput}
              placeholder="npub1... or NIP-05 address"
              class:error
              on:keydown={(e) => e.key === 'Enter' && searchUser()}
            />
            <button on:click={searchUser} disabled={isLoading}>
              {isLoading ? 'Searching...' : 'Start'}
            </button>
          </div>

          {#if error}
            <p class="error-message">{error}</p>
          {/if}
        {/if}

        <div class="user-info-container">
          {#if isLoading}
            <div class="user-info">
              <div class="user-picture loading-picture">
                <Loading />
              </div>
              <div class="user-name">
                <div class="loading-text"></div>
                <div class="loading-text small"></div>
              </div>
            </div>
          {:else if userFound}
            <h2>Hey, ready to start?</h2>
            <div class="user-info">
              <div class="user-picture">
                {#if userPicture}
                  <img src={userPicture} alt={userName} />
                {:else}
                  <div class="default-avatar"></div>
                {/if}
              </div>
              <div class="user-name">
                <h3>{userName || 'Nostr User'}</h3>
                <span class="user-id">{npub}</span>
                <span class="user-id">{userWriteRelays.join(', ')}</span>
              </div>
              <button class="remove-button" on:click={resetUserSearch}>×</button>
            </div>
          {/if}
        </div>
      </section>

      <section class="intro-help">
        <p>
          Oracolo lets you create a personal blog using your Nostr content: articles, notes and
          images. You can freely organize them in blocks with different styles, and pin your
          favorites, too! Finally, the blog is just a single HTML file you can host everywhere, but
          you can also take advantage of Oracolo service and just point your domain, it's free!
        </p>
        <p>Are you new to Nostr? <a href="https://njump.me" target="_blank">Read more</a>.</p>
      </section>

      {#if userFound}
        <section class="options-section" transition:fade={{ duration: 100 }}>
          <h2>Configure basic options</h2>

          <div class="option">
            <h3>Topics</h3>
            <p>Add topics to filter content by tags</p>

            <div class="input-group">
              <input
                type="text"
                bind:value={newTopic}
                placeholder="Enter topics (comma separated)"
                on:keydown={(e) => e.key === 'Enter' && addTopic()}
              />
              <button on:click={addTopic}>Add</button>
            </div>

            {#if topics.length > 0}
              <div class="topics-list" role="list">
                <div class="wrapper">
                  {#each topics as topic, index}
                    <div
                      class="topic-tag"
                      draggable="true"
                      role="listitem"
                      on:dragstart={(e) => handleTopicDragStart(e, index)}
                      on:dragover={(e) => handleTopicDragOver(e, index)}
                      on:drop={handleTopicDrop}
                      on:dragend={handleTopicDragEnd}
                      class:dragging={draggedTopicIndex === index}
                      class:drop-target={dragOverTopicIndex === index &&
                        draggedTopicIndex !== index}
                    >
                      <div class="drag-handle">
                        <svg viewBox="0 0 20 20" width="12" height="12">
                          <path
                            d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z"
                          ></path>
                        </svg>
                      </div>
                      <span class="topic-text">{topic}</span>
                      <button class="remove-button" on:click={() => removeTopic(topic)}>×</button>
                    </div>
                  {/each}
                </div>
                <div class="hint">(drag to reorder)</div>
              </div>
            {/if}
          </div>

          <div class="option">
            <h3>Comments</h3>
            <p>Enable comments on your blog posts</p>

            <label class="switch">
              <input
                type="checkbox"
                bind:checked={enableComments}
                on:change={updateDomainPreview}
              />
              <span class="slider"></span>
            </label>
          </div>
        </section>

        <section class="blocks-section" transition:fade={{ duration: 100 }}>
          <h2>Add some content blocks</h2>
          <div class="option">
            {#if blocks.length > 0}
              <div class="blocks-list" role="list">
                <h3>Your blocks <span class="hint">(drag to reorder)</span></h3>

                {#each blocks as block, index}
                  <div
                    class="block-item"
                    draggable="true"
                    role="listitem"
                    on:dragstart={() => handleDragStart(index)}
                    on:dragover={(e) => handleDragOver(index, e)}
                    on:drop={handleDrop}
                    on:dragend={handleDragEnd}
                    class:dragging={draggedBlockIndex === index}
                    class:drop-target={dropTargetIndex === index && draggedBlockIndex !== index}
                  >
                    <div class="drag-handle">
                      <svg viewBox="0 0 20 20" width="20" height="20">
                        <path
                          d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z"
                        ></path>
                      </svg>
                    </div>
                    <div class="block-type">{block.type}</div>
                    <div class="block-details">
                      {#if block.isPinned}
                        <span class="pinned-badge">Pinned</span>
                        {#if block.pinnedEvents && block.pinnedEvents.length > 0}
                          • {block.pinnedEvents.length} event{block.pinnedEvents.length > 1
                            ? 's'
                            : ''}
                          {#if block.pinnedEvents.length === 1}
                            <span class="event-id-preview" title={block.pinnedEvents[0]}
                              >({shortenEventId(block.pinnedEvents[0])})</span
                            >
                          {/if}
                        {/if}
                      {:else}
                        {block.count} items • {block.style} style
                        {#if block.minChars}
                          • min {block.minChars} chars
                        {/if}
                      {/if}
                    </div>
                    <button class="remove-button" on:click={() => removeBlock(index)}>×</button>
                  </div>
                {/each}
              </div>
            {:else}
              <p>
                <!-- svelte-ignore a11y-click-events-have-key-events -->
                Design your homepage structure with content blocks, you can also pin your favorite content!
                Would you like to start with the
                <!-- svelte-ignore a11y-invalid-attribute -->
                <a href="#" on:click={addStadardBlocksConfig}>suggested configuration?</a>
              </p>
            {/if}
          </div>

          <div class="add-block">
            <h3>Add a new block</h3>

            <div class="block-options">
              <!-- First row with common options: Selection and Type -->
              <div class="common-options-row">
                <div class="option-group type-option">
                  <label for="block-type">Type</label>
                  <select id="block-type" bind:value={newBlockType}>
                    <option value="articles">Articles</option>
                    <option value="notes">Notes</option>
                    <option value="images">Images</option>
                  </select>
                </div>

                <div class="option-group selection-option">
                  <label for="selection-mode">Selection</label>
                  <select id="selection-mode" bind:value={selectionMode}>
                    <option value="automatic">Automatic selection</option>
                    <option value="pinned">Pinned events</option>
                  </select>
                </div>
              </div>

              {#if selectionMode === 'pinned'}
                <!-- For pinned events, show the event IDs input field -->
                <div class="option-group pinned-ids-container">
                  <label for="pinned-id">Event IDs (comma separated)</label>
                  <div class="input-group">
                    <input
                      id="pinned-id"
                      type="text"
                      bind:value={newPinnedId}
                      placeholder="Enter event IDs, nevent1, naddr1..."
                      on:keydown={(e) => e.key === 'Enter' && addPinnedId()}
                    />
                    <button on:click={addPinnedId}>Add</button>
                  </div>

                  <!-- Error message area for type mismatch or invalid IDs -->
                  {#if pinnedEventError}
                    <p class="error-message">{pinnedEventError}</p>
                  {/if}

                  {#if newpinnedEvents.length > 0}
                    <div class="pinned-events-list">
                      {#each newpinnedEvents as id (id)}
                        <div
                          class="pinned-event-item {pinnedPreviews[id]?.typeValid === false
                            ? 'type-mismatch'
                            : ''}"
                        >
                          {#if pinnedPreviews[id]?.imageUrl}
                            <div class="pinned-preview-container image-preview">
                              <img src={pinnedPreviews[id].imageUrl} alt="Preview" />
                              <button class="remove-button" on:click={() => removePinnedId(id)}
                                >×</button
                              >
                            </div>
                          {:else}
                            <div
                              class="pinned-preview-container {pinnedPreviews[id]?.type ||
                                'articles'}"
                            >
                              <div
                                class="pinned-preview {pinnedPreviews[id]?.isLoading
                                  ? 'loading'
                                  : ''}"
                              >
                                {pinnedPreviews[id]?.preview || 'Loading...'}
                                {#if pinnedPreviews[id]?.typeValid === false}
                                  <div class="type-mismatch-indicator">Type mismatch!</div>
                                {/if}
                              </div>
                              <button class="remove-button" on:click={() => removePinnedId(id)}
                                >×</button
                              >
                            </div>
                          {/if}
                        </div>
                      {/each}
                    </div>
                  {:else}
                    <p class="note">Add at least one event ID to create a pinned block</p>
                  {/if}
                </div>
              {:else}
                <!-- For automatic selection, show remaining options in one row -->
                <div class="auto-select-row">
                  <div class="option-group style-option">
                    <label for="block-style">Style</label>
                    <select id="block-style" bind:value={newBlockStyle}>
                      <option value="grid">Grid</option>
                      <option value="list">List</option>
                      {#if newBlockType === 'notes'}
                        <option value="slide">Carousel</option>
                      {/if}
                    </select>
                  </div>

                  <div class="option-group count-option">
                    <label for="block-count">Count</label>
                    <input
                      id="block-count"
                      type="number"
                      bind:value={newBlockCount}
                      min="1"
                      max="50"
                    />
                  </div>

                  <div class="option-group min-length-option">
                    <label for="block-min-chars">Min. length</label>
                    <input
                      id="block-min-chars"
                      type="number"
                      bind:value={newBlockMinChars}
                      min="0"
                      placeholder="No minimum"
                    />
                  </div>
                </div>
              {/if}
            </div>

            <div>
              <button class="add-block-button" on:click={addBlock} disabled={isAddPinnedDisabled}>
                Add Block
              </button>
            </div>
          </div>
        </section>

        {#if blocks.length > 0}
          <section class="preview-section" transition:fade={{ duration: 100 }}>
            <h2>Your blog is ready!</h2>
            <p>
              Your blog is ready, we have prepared a preview so you can check the configuration
              before deploying it:
              <a
                href={`http://${domainPreview}.${baseDomain}`}
                target="_blank"
                class="secondary-button"
              >
                view your Nostr blog
              </a>
            </p>
            <p>
              You can freely updated the config in the previous steps, the preview will updated
              autoamtically.
            </p>
            <p>
              <i
                >PS: Please don't share this URL, it's quite ugly and dosn't support HTTPS, it is
                intended only to the check the configuration and for the possible DNS option (see
                below).</i
              >
            </p>

            <div class="extra-options">
              <h2>Make it visible to the world</h2>
              <p>To deploy your Nostr blog blog you have a couple of options.</p>
              <div class="download-option">
                <p>
                  <!-- svelte-ignore a11y-invalid-attribute -->
                  The first one is to
                  <a href="#" on:click={() => startBlogDownload()}>download a single HTML file</a> that
                  runs the full blog, and upload it in your preferred web hosting. You can also give
                  the file as a kind of business card, the person who receives it can simply open it
                  on his PC.
                </p>
              </div>

              <div class="dns-option">
                <p>
                  Instead if you have only a domain with DNS management you can point it to the
                  Oracolo service effortlessly, it's free!
                </p>
                <div class="domain-input">
                  <input
                    type="text"
                    bind:value={userDomain}
                    on:input={handleDomainInput}
                    placeholder="Enter your domain (e.g. www.myblog.com)"
                  />
                </div>

                {#if userDomain && showDomainValidation}
                  {#if processSubdomain(userDomain)}
                    <div class="dns-instructions" transition:fade={{ duration: 100 }}>
                      <p>Use this configuration in your DNS:</p>
                      <div class="dns-code">
                        <pre>{processSubdomain(
                            userDomain
                          )} IN CNAME {domainPreview}.{baseDomain}</pre>
                        <button
                          class="copy-button"
                          on:click={(event) => {
                            const text = `${processSubdomain(userDomain)} IN CNAME ${domainPreview}.${baseDomain}`;
                            navigator.clipboard.writeText(text);

                            // Change to checkmark icon
                            const button = event.currentTarget;
                            const originalHTML = button.innerHTML;
                            button.innerHTML =
                              '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
                            button.title = 'Copied!';

                            // Revert to original state after 2 seconds
                            setTimeout(() => {
                              button.innerHTML = originalHTML;
                              button.title = 'Copy to clipboard';
                            }, 2000);
                          }}
                          title="Copy to clipboard"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          >
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
                            ></path>
                          </svg>
                        </button>
                      </div>
                    </div>
                  {:else}
                    <div class="dns-error" transition:fade={{ duration: 100 }}>
                      <p>
                        Please enter a valid domain with a subdomain (e.g., "www.example.com",
                        "blog.yourdomain.net").
                      </p>
                      <p>
                        CNAME records can only be set for subdomains, not for root domains like
                        "example.com".
                      </p>
                      <p>
                        Make sure your domain includes at least one subdomain and a TLD (e.g., .com,
                        .org, .net).
                      </p>
                    </div>
                  {/if}
                {/if}
              </div>
            </div>
          </section>
        {:else}
          <section class="preview-section" transition:fade={{ duration: 100 }}>
            <div class="option wait">
              <p>Add some blocks to complete the configuration</p>
            </div>
          </section>
        {/if}
      {/if}
    </div>

    <footer>
      <p>
        Oracolo • <a href="https://njump.me" target="_blank">A Nostr-powered</a> blogging platform<br
        />
        The source code for this service is
        <a href="https://github.com/dtonon/oracolo" target="_blank">free and open</a>
      </p>
    </footer>
  </div>
</div>
