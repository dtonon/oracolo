import { writable } from 'svelte/store';
import { getConfig } from './../config';
import { SimplePool } from 'nostr-tools/pool'

export const pool = new SimplePool()