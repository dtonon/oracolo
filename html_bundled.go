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
	bundledStep1 = []byte(`<!doctype html>
<html lang="en">
  <head>
`)
	bundledStep3 = []byte(`
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
          var meta = document.querySelector('meta[name="force-theme"]');
          if (!meta) return null;
          var value = (meta.getAttribute('content') || '').toLowerCase();
          if (value === 'dark' || value === 'light') return value;
          return null;
        }
        function isDarkTheme() {
          if (localStorage.getItem('theme') === 'dark') return true;
          if (localStorage.getItem('theme') === 'light') return false;
          var metaTheme = getMetaTheme();
          if (metaTheme) return metaTheme === 'dark';
          var darkSetting = window.matchMedia('(prefers-color-scheme: dark)').matches;
          localStorage.setItem('systemTheme', darkSetting ? 'dark' : 'light');
          return darkSetting;
        }
        if (isDarkTheme()) {
          document.documentElement.classList.add('dark');
        }
      })();
    </script>
    <script>
`)
	bundledStep5 = []byte(`
    </script>
    <style>
`)
	bundledStep7 = []byte(`
    </style>
  </body>
</html>
`)
)

func renderModifiedBundled(w io.Writer, params Params) {
	w.Write(bundledStep1)
	for _, param := range params {
		fmt.Fprintf(w, "    <meta name=\"%s\" content=\"%s\">\n", param[0], param[1])
	}
	w.Write(bundledStep3)
	w.Write(js)
	w.Write(bundledStep5)
	w.Write(css)
	w.Write(bundledStep7)
}
