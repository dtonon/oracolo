package main

import (
	"fmt"
	"strings"

	_ "embed"

	"github.com/nbd-wtf/go-nostr"
	"github.com/nbd-wtf/go-nostr/nip19"
)

type Params [][]string

var metaSettings = map[string]string{
	"ba": "block:articles",
	"bn": "block:notes",
	"bi": "block:images",
	"t":  "topics",
	"c":  "comments",
}

func paramsFromSubdomain(subdomain string) (Params, error) {
	var params Params
	for part := range strings.SplitSeq(subdomain, ".") {
		if strings.HasPrefix(part, "npub1") {
			_, _, err := nip19.Decode(part)
			if err != nil {
				return nil, fmt.Errorf("invalid npub '%s'", part)
			}
			params = append(params, []string{"author", part})
		} else if strings.HasPrefix(part, "nprofile1") {
			_, d, err := nip19.Decode(part)
			if err != nil {
				return nil, fmt.Errorf("invalid nprofile '%s'", part)
			}
			pointer := d.(nostr.ProfilePointer)
			var thisAuthor string
			thisAuthor, _ = nip19.EncodePublicKey(pointer.PublicKey)
			params = append(params, []string{"author", thisAuthor})
			params = append(params, []string{"relays", strings.Join(pointer.Relays, ",")})
		} else {
			for key, name := range metaSettings {
				if strings.HasPrefix(part, key) {
					value := "yes"
					if key != "c" {
						value = part[len(key)+1:]
					}
					if key == "t" {
						value = strings.Replace(value, "-", ",", -1)
					}
					params = append(params, []string{name, value})
					break
				}
			}
		}
	}
	return params, nil
}
