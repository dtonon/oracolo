//go:build !dev

package main

import (
	_ "embed"
	"fmt"
	"io"
)

//go:embed dist/out.js
var js []byte

//go:embed dist/out.css
var css []byte

var (
	step1 = []byte(`<!doctype html>
<html lang="en">
  <head>
`)
	step3 = []byte(`
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title></title>
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
    <script>
`)
	step5 = []byte(`
    </script>
    <style>
`)
	step7 = []byte(`
    </style>
  </body>
</html>
`)
)

func renderModifiedHTML(w io.Writer, params Params) {
	w.Write(step1)
	for _, param := range params {
		fmt.Fprintf(w, "    <meta name=\"%s\" content=\"%s\">\n", param[0], param[1])
	}
	w.Write(step3)
	w.Write(js)
	w.Write(step5)
	w.Write(css)
	w.Write(step7)
}
