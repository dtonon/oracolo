import { type NostrEvent } from '@nostr/tools/core';
import { type Filter } from '@nostr/tools/filter';
import * as nip27 from '@nostr/tools/nip27';
import { pool } from '@nostr/gadgets/global';
import { Mutex } from '@livekit/mutex';

import { getEventData, isRootNote, type EventData } from './utils';
import { writable } from 'svelte/store';

export const loaded = writable(false);
export const totalDisplayedNotes = writable(0);

export class EventSource {
  relays: string[];
  filter: Filter;

  #items: NostrEvent[] = [];
  #until = Math.round(Date.now() / 1000);
  #kind: number;

  #done: { [relay: string]: boolean } = {};
  #mutex = new Mutex();

  constructor(relays: string[], filter: Filter) {
    this.relays = relays;
    this.filter = filter;
    this.#kind = filter.kinds?.[0] || 1;
  }

  async pluck(count: number, minChars: number): Promise<EventData[]> {
    const unlock = await this.#mutex.lock();

    const results: EventData[] = [];

    let events = this.#items;
    this.#items = [];

    while (events.length > 0 || Object.keys(this.#done).length < this.relays.length) {
      if (events.length < count) {
        const relays = this.relays.filter((r) => !this.#done[r]).slice(0, 2);

        if (relays.length) {
          let downloaded = await pool.querySync(relays, {
            ...this.filter,
            until: this.#until,
            limit:
              count * (minChars > (this.#kind === 1 ? 0 : 10) ? 3 : 1) * (this.#kind === 1 ? 6 : 1)
          });

          if (downloaded.length === 0) {
            relays.forEach((r) => {
              this.#done[r] = true;
            });
          } else {
            if (this.#kind === 1) {
              downloaded = downloaded.filter(isRootNote);
            }

            events.push(...downloaded);
            events.sort((a, b) => a.created_at - b.created_at);

            this.#until = events[0]?.created_at - 1;
          }
        }
      }

      // iterate backwards so we can easily remove items
      for (let i = events.length - 1; i >= 0; i--) {
        let item = events[i];

        // Check min length
        if (minChars > 0) {
          if (item.kind === 30023 /* won't try to render markdown here, just count raw */) {
            if (item.content.length < minChars) {
              this.#items.push(item);
              events.splice(i, 1);
              continue;
            }
          } else if (!isLengthEqualOrGreaterThanThreshold(item, minChars)) {
            this.#items.push(item);
            events.splice(i, 1);
            continue;
          }
        }

        // This one passed all the filters:
        events.splice(i, 1);
        results.push(getEventData(item));

        // Exit early if we got everything we needed
        if (results.length === count) {
          unlock();
          this.#items.push(...events);
          this.#items.sort((a, b) => a.created_at - b.created_at);
          totalDisplayedNotes.update((v) => v + results.length);
          loaded.set(true);
          return results;
        }
      }
    }

    this.#items.sort((a, b) => a.created_at - b.created_at);
    totalDisplayedNotes.update((v) => v + results.length);
    loaded.set(true);
    return results;
  }

  async fetchIds(ids: string[]): Promise<EventData[]> {
    const events = await pool.querySync(this.relays.slice(0, 5), { ids });
    loaded.set(true);
    return events.map(getEventData);
  }
}

// this function reads the event content progressively and exits early when the threshold has been met
// this may save us some nanoseconds.
function isLengthEqualOrGreaterThanThreshold(event: NostrEvent, threshold: number): boolean {
  let curr = 0;
  for (let block of nip27.parse(event.content)) {
    switch (block.type) {
      case 'text':
        curr += block.text.length;
      case 'url':
      case 'image':
      case 'video':
      case 'audio':
      case 'reference':
        // each one of these items are supposed to be parsed and rendered in a custom way
        // for the matter of counting the note size and filtering we will assign a static
        // "length-value" to each
        curr += 14;
    }

    if (curr >= threshold) {
      return true;
    }
  }

  return false;
}
