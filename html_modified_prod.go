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
	for key, value := range params {
		fmt.Fprintf(w, "    <meta name=\"%s\" value=\"%s\">\n", key, value)
	}
	w.Write(step3)
	w.Write(js)
	w.Write(step5)
	w.Write(css)
	w.Write(step7)
}
