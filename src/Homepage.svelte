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
			if (!value.startsWith('npub1')) return false;
			const decoded = decode(value);
			return decoded.type === 'npub';
		} catch (e) {
			return false;
		}
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
	}

	async function searchUser() {
		if (!isValidNpub(npub)) {
			error = 'Please enter a valid npub';
			return;
		}

		isLoading = true;
		error = '';
		userFound = false;

		// Reset pinned elements when searching for a new npub
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
		}, 1500);
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
			subdomains.push('comments');
		}

		if (topics.length > 0) {
			subdomains.push(`topics-${topics.join('-')}`);
		}

		domainPreview = subdomains.join('.');
	}

	// ------------------------------------------------------------
	// Function to download the blog as a single HTML file
	// ------------------------------------------------------------

	function startBlogDownload() {
		try {
			const blogUrl = `https://${domainPreview}.${baseDomain}?download=true`;
			window.open(blogUrl, '_blank');
		} catch (error) {
			console.error('Error opening blog URL:', error);
			alert(`Failed to open blog: ${(error as any).message}`);
		}
	}

	// ------------------------------------------------------------
	// Initialize with default blocks
	// ------------------------------------------------------------

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
	});
</script>

<div class="homepage">
	<div class="theme-switch">
		<ThemeSwitch />
	</div>

	<header>
		<h1>Oracolo</h1>
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
						placeholder="npub1..."
						class:error
						on:keydown={(e) => e.key === 'Enter' && searchUser()}
					/>
					<button on:click={searchUser} disabled={isLoading}>
						{isLoading ? 'Searching...' : 'Start'}
					</button>
				</div>

				{#if error}
					<p class="input-error">{error}</p>
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
					<h2>Hello {userName || 'Nostr User'}!</h2>
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
						<button class="reset-button" on:click={resetUserSearch}>×</button>
					</div>
				{/if}
			</div>
		</section>

		{#if userFound}
			<section class="options-section">
				<h2>Configure your blog</h2>

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
										class:drop-target={dragOverTopicIndex === index && draggedTopicIndex !== index}
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
							<div class="topics-hint">(drag to reorder)</div>
						</div>
					{/if}
				</div>

				<div class="option">
					<h3>Comments</h3>
					<p>Enable comments on your blog posts</p>

					<label class="switch">
						<input type="checkbox" bind:checked={enableComments} on:change={updateDomainPreview} />
						<span class="slider"></span>
					</label>
				</div>
			</section>

			<section class="blocks-section">
				<h2>Add content blocks</h2>
				<div class="option">
					{#if blocks.length > 0}
						<div class="blocks-list" role="list">
							<h3>Your blocks <span class="blocks-hint">(drag to reorder)</span></h3>

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
									<p class="input-error">{pinnedEventError}</p>
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
									<p class="input-note">Add at least one event ID to create a pinned block</p>
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

					<div class="input-group">
						<button class="add-block-button" on:click={addBlock} disabled={isAddPinnedDisabled}>
							Add Block
						</button>
					</div>
				</div>
			</section>

			{#if blocks.length > 0}
				<section class="preview-section">
					<h2>Your blog is ready!</h2>

					<div class="domain-preview">
						<code>{domainPreview}.{baseDomain}</code>
					</div>

					<div class="action-buttons">
						<a
							href={`https://${domainPreview}.${baseDomain}`}
							target="_blank"
							class="secondary-button"
						>
							View the blog preview
						</a>
					</div>

					<div class="extra-options">
						<div class="download-option">
							<p>Download a single HTML file that run the full blog and upload it where you like</p>
							<button on:click={() => startBlogDownload()} class="download-button">Download</button>
						</div>

						<div class="dns-option">
							<p>
								Do you have a domain with DNS management?<br />
								Point it to your blog effortlessly
							</p>
							<div class="input-group domain-input">
								<input
									type="text"
									bind:value={userDomain}
									on:input={handleDomainInput}
									placeholder="Enter your domain (e.g. www.myblog.com)"
								/>
							</div>

							{#if userDomain && showDomainValidation}
								{#if processSubdomain(userDomain)}
									<div class="dns-instructions" transition:fade={{ duration: 500 }}>
										<p>Use this configuration in your DNS:</p>
										<pre>{processSubdomain(userDomain)} IN CNAME {domainPreview}.{baseDomain}</pre>
									</div>
								{:else}
									<div class="dns-error" transition:fade={{ duration: 500 }}>
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
				<section class="preview-section">
					<div class="option">
						<p>Add some blocks to complete the configuration</p>
					</div>
				</section>
			{/if}
		{/if}
	</div>

	<footer>
		<p>Oracolo • A Nostr-powered blogging platform</p>
	</footer>
</div>
