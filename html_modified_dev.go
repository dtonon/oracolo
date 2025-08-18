//go:build dev

package main

import (
	"fmt"
	"io"
)

var step1 = []byte(`<!doctype html>
<html lang="en">
  <head>
`)

var devModeRest = []byte(`
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title></title>
    <link id="css" rel="stylesheet" href="http://localhost:45071/out.css" />
  </head>
  <body>
    <div id="app"></div>
    <script>
      window.wnjParams = {
        position: 'bottom',
        accent: 'neutral',
        startHidden: true,
        compactMode: true,
      };
    </script>
    <script>
      (function () {
        function getMetaTheme() {
          var meta = document.querySelector('meta[name="theme"]');
          if (!meta) return null;
          var value = (meta.getAttribute('content') || meta.getAttribute('value') || '').toLowerCase();
          if (value === 'dark' || value === 'light') return value;
          return null;
        }
        function determineTheme() {
          if (localStorage.getItem('theme') === 'dark') return true;
          if (localStorage.getItem('theme') === 'light') return false;
          var metaTheme = getMetaTheme();
          if (metaTheme) return metaTheme === 'dark';
          var darkSetting = window.matchMedia('(prefers-color-scheme: dark)').matches;
          localStorage.setItem('systemTheme', darkSetting ? 'dark' : 'light');
          return darkSetting;
        }
        if (determineTheme()) {
          document.documentElement.classList.add('dark');
        }
      })();
    </script>
    <script id="js" src="http://localhost:45071/out.js"></script>
    <script>
      let es = new EventSource('http://localhost:45071/esbuild')

      es.addEventListener('change', (ev) => {
        let change = JSON.parse(ev.data)
        console.log('reload!', change)

        if (change.added.length || change.removed.length) return

        if (change.updated[0]?.endsWith('.css')) {
          let css = document.getElementById('css')
          let newCSS = document.createElement('link')
          newCSS.id = 'css'
          newCSS.rel = 'stylesheet'
          newCSS.href = 'http://localhost:45071' + change.updated[0] + '?' + Math.random().toString(36).slice(2)
          newCSS.onload = () => css.remove()
          css.parentNode.appendChild(newCSS)
        } else if (change.updated[0]?.endsWith('.js')) {
          let js = document.getElementById('js')
          let parent = js.parentNode
          js.remove()

          let newJS = document.createElement('script')
          newJS.id = 'js'
          newJS.src = 'http://localhost:45071' + change.updated[0] + '?' + Math.random().toString(36).slice(2)
          window.destroySvelteApp()
          parent.appendChild(newJS)
        }
      })
    </script>
`)

func renderModifiedHTML(w io.Writer, params Params) {
	w.Write(step1)
	for _, param := range params {
		fmt.Fprintf(w, "    <meta name=\"%s\" content=\"%s\">\n", param[0], param[1])
	}
	w.Write(devModeRest)
}
