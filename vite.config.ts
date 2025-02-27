import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { viteSingleFile } from 'vite-plugin-singlefile';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
	return {
		mode,
		build: {
			sourcemap: mode === 'development' ? 'inline' : false
		},
		plugins: [svelte(), viteSingleFile()]
	};
});
