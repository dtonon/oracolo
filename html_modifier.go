package main

import (
	"fmt"
	"io"
	"strings"

	"github.com/nbd-wtf/go-nostr"
	"github.com/nbd-wtf/go-nostr/nip19"
)

type Params map[string]string

var metaSettings = [...]string{
	"top-notes",
	"short-notes-summary-max-chars",
	"short-notes-min-chars",
	"short-notes",
	"topics",
	"comments",
}

func paramsFromSubdomain(subdomain string) (Params, error) {
	params := make(Params, 3)
	for part := range strings.SplitSeq(subdomain, ".") {
		if strings.HasPrefix(part, "npub1") {
			_, _, err := nip19.Decode(part)
			if err != nil {
				return nil, fmt.Errorf("invalid npub '%s'", part)
			}
			params["author"] = part
		} else if strings.HasPrefix(part, "nprofile1") {
			_, d, err := nip19.Decode(part)
			if err != nil {
				return nil, fmt.Errorf("invalid nprofile '%s'", part)
			}
			pointer := d.(nostr.ProfilePointer)
			params["author"], _ = nip19.EncodePublicKey(pointer.PublicKey)
			params["relays"] = strings.Join(pointer.Relays, ",")
		} else {
			for _, key := range metaSettings {
				if strings.HasPrefix(part, key) {
					value := part[len(key)+1:]
					params[key] = value
					break
				}
			}
		}
	}
	return params, nil
}

var (
	step1 = []byte(`<!doctype html>
<html lang="en">
  <head>
`)
	step3 = []byte(`
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title></title>

    <style>
`)
	step5 = []byte(`
    </style>
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
	step7 = []byte(`
    </script>
  </body>
</html>
`)
)

// this builds the HTML from multiple parts, including raw CSS, raw JS and <meta> tags we'll inject
func renderModifiedHTML(w io.Writer, params Params) {
	w.Write(step1)
	for key, value := range params {
		fmt.Fprintf(w, "    <meta name=\"%s\" value=\"%s\">\n", key, value)
	}
	w.Write(step3)
	w.Write(css)
	w.Write(step5)
	w.Write(js)
	w.Write(step7)
}
