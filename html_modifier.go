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

func renderModifiedHTML(w io.Writer, params Params) {
	w.Write(htmlPre)
	for key, value := range params {
		fmt.Fprintf(w, "<meta name=\"%s\" value=\"%s\">\n", key, value)
	}
	w.Write(htmlPost)
}
