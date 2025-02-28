package main

import (
	"net"

	"github.com/coocood/freecache"
)

var cnameCache = freecache.NewCache(512 * (2 << 9))

func lookupCNAME(domain string) string {
	key := []byte(domain)
	if val, err := cnameCache.Get(key); err == nil {
		return string(val)
	}

	cname, err := net.LookupCNAME(domain)
	if err != nil {
		// cache failures for 5 minutes
		cnameCache.Set(key, []byte{}, 5*60)
		return ""
	}

	// cache successes for 2 hours
	cnameCache.Set(key, []byte(cname), 2*60*60)

	return cname
}
