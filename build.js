#!/usr/bin/env node

import esbuild from 'esbuild';
import sveltePlugin from 'esbuild-svelte';
import { sveltePreprocess } from 'svelte-preprocess';
import { sassPlugin } from 'esbuild-sass-plugin';

const prod = process.argv.indexOf('prod') !== -1;
const watch = process.argv.indexOf('watch') !== -1;

const baseOptions = {
	mainFields: ['svelte', 'browser', 'module', 'main'],
	conditions: ['svelte', 'browser'],
	bundle: true,
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

// Main app build
const mainOptions = {
	...baseOptions,
	entryPoints: ['src/main.ts'],
	outfile: 'dist/out.js',
};

// Homepage build
const homepageOptions = {
	...baseOptions,
	entryPoints: ['src/homepage.ts'],
	outfile: 'dist/homepage.js',
};

if (watch) {
	let mainCtx = await esbuild.context(mainOptions);
	let homeCtx = await esbuild.context(homepageOptions);
	await Promise.all([
		mainCtx.watch(),
		homeCtx.watch()
	]);
	await mainCtx.serve({
		host: 'localhost',
		port: 45071
	});
} else {
	await Promise.all([
		esbuild.build(mainOptions),
		esbuild.build(homepageOptions)
	]);
	console.log('built.');
}
