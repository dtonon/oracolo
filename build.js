#!/usr/bin/env node

import esbuild from 'esbuild';
import sveltePlugin from 'esbuild-svelte';
import { sveltePreprocess } from 'svelte-preprocess';
import { sassPlugin } from 'esbuild-sass-plugin';

const prod = process.argv.indexOf('prod') !== -1;
const watch = process.argv.indexOf('watch') !== -1;

const options = {
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
};

if (watch) {
	let ctx = await esbuild.context(options);
	await ctx.watch();
	await ctx.serve({
		host: 'localhost',
		port: 45071
	});
} else {
	await esbuild.build(options);
	console.log('built.');
}
