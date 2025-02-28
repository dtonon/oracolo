#!/usr/bin/env node

import esbuild from 'esbuild';
import sveltePlugin from 'esbuild-svelte';
import { sveltePreprocess } from 'svelte-preprocess';
import { sassPlugin } from 'esbuild-sass-plugin';

const prod = process.argv.indexOf('prod') !== -1;

esbuild
	.build({
		entryPoints: ['src/main.ts'],
		mainFields: ['svelte', 'browser', 'module', 'main'],
		conditions: ['svelte', 'browser'],
		bundle: true,
		outfile: 'dist/out.js',
		format: 'iife',
		plugins: [
			sveltePlugin({
				preprocess: sveltePreprocess()
			}),
			sassPlugin()
		],
		logLevel: 'info',
		minify: prod,
		sourcemap: prod ? false : 'inline'
	})
	.catch(() => process.exit(1));
