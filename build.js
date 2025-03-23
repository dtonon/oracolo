#!/usr/bin/env node

import esbuild from 'esbuild';
import sveltePlugin from 'esbuild-svelte';
import { sveltePreprocess } from 'svelte-preprocess';
import { sassPlugin } from 'esbuild-sass-plugin';
import fs from 'fs';
import { copyFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';

const prod = process.argv.indexOf('prod') !== -1;
const watch = process.argv.indexOf('watch') !== -1;

// Create CSS extractor plugin with a unique identifier for each build
const createCssExtractorPlugin = () => ({
  name: 'css-extractor',
  setup(build) {
    // Store CSS content for this specific build
    let cssContent = '';

    // Capture CSS content during the build
    build.onLoad({ filter: /\.css$/ }, async (args) => {
      const css = await fs.promises.readFile(args.path, 'utf8');
      cssContent += css + '\n';
      return { contents: '' };
    });

    // Write the CSS file after the build completes
    build.onEnd(async (result) => {
      if (cssContent) {
        const outDir = path.dirname(build.initialOptions.outfile);
        const baseName = path.basename(build.initialOptions.outfile, '.js');
        const cssPath = path.join(outDir, `${baseName}.css`);
        await fs.promises.writeFile(cssPath, cssContent);
        // Reset the CSS content
        cssContent = '';
      }
    });
  }
});

function copyFavicon() {
  const sourceDir = 'static/images';
  const destDir = 'dist/images';

  // Create destination directory if it doesn't exist
  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true });
  }

  // Copy the favicon
  // Adjust the filename as needed to match your actual favicon filename
  copyFileSync(`${sourceDir}/favicon.png`, `${destDir}/favicon.png`);
  console.log('Favicon copied to dist/images');
}

const baseOptions = {
  mainFields: ['svelte', 'browser', 'module', 'main'],
  conditions: ['svelte', 'browser'],
  bundle: true,
  format: 'iife',
  loader: {
    '.jpg': 'copy',
    '.png': 'copy',
    '.svg': 'copy',
    '.gif': 'copy'
  },
  assetNames: 'images/[name]',
  plugins: [
    sveltePlugin({
      preprocess: sveltePreprocess(),
      emitCss: true
    }),
    sassPlugin()
    // CSS extractor will be added separately to each build
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
  plugins: [...baseOptions.plugins, createCssExtractorPlugin()]
};

// Homepage build
const homepageOptions = {
  ...baseOptions,
  entryPoints: ['src/homepage.ts'],
  outfile: 'dist/homepage.js',
  plugins: [...baseOptions.plugins, createCssExtractorPlugin()]
};

if (watch) {
  let mainCtx = await esbuild.context(mainOptions);
  let homeCtx = await esbuild.context(homepageOptions);
  copyFavicon();
  await Promise.all([mainCtx.watch(), homeCtx.watch()]);
  await mainCtx.serve({
    host: 'localhost',
    port: 45071
  });
} else {
  await Promise.all([esbuild.build(mainOptions), esbuild.build(homepageOptions)]);
  copyFavicon();
  console.log('built.');
}
