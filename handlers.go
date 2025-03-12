package main

import (
	_ "embed"
	"net/http"
	"strings"
	"time"
)

//go:embed dist/homepage.html
var homepageHTML []byte

//go:embed dist/homepage.js
var homepageJS []byte

//go:embed dist/homepage.css
var homepageCSS []byte

func handleHome(w http.ResponseWriter, r *http.Request) {
	// If requesting static files from /dist/, serve them
	if strings.HasPrefix(r.URL.Path, "/dist/") {
		if !isProduction() {
			// In development, serve directly from disk
			http.ServeFile(w, r, r.URL.Path[1:]) // Remove leading slash
			return
		}

		// In production, serve from embedded files
		switch r.URL.Path {
		case "/dist/homepage.js":
			w.Header().Set("Content-Type", "application/javascript")
			w.Write(homepageJS)
		case "/dist/homepage.css":
			w.Header().Set("Content-Type", "text/css")
			w.Write(homepageCSS)
		default:
			http.NotFound(w, r)
		}
		return
	}

	// Only serve homepage HTML for the root path
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}

	// Serve homepage HTML
	w.Header().Set("Content-Type", "text/html")
	if !isProduction() {
		// In development, serve directly from disk
		http.ServeFile(w, r, "dist/homepage.html")
		return
	}
	// In production, serve from embedded file
	log.Printf("homepageHTML: %s", homepageHTML)
	w.Write(homepageHTML)
}

// this handles requests to https://npub1whatever.something-else.whatever-2.BASE_DOMAIN/
func handleSubdomain(subdomain string, w http.ResponseWriter, r *http.Request) {
	params, err := paramsFromSubdomain(subdomain)
	if err != nil {
		http.Error(w, err.Error(), 400)
		return
	}
	renderModifiedHTML(w, params)
}

// this handles requests from arbitrary external domains
func handleMagicCNAME(w http.ResponseWriter, r *http.Request) {
	cname := lookupCNAME(r.Host)
	if cname == "" {
		http.Error(w, "missing CNAME record for "+r.Host, 400)
		return
	}

	subdomain, found := strings.CutSuffix(cname, "."+s.BaseDomain+".")
	if !found {
		http.Error(w, "invalid CNAME '"+cname+"' doesn't end with '"+s.BaseDomain+".'", 404)
		return
	}

	params, err := paramsFromSubdomain(subdomain)
	if err != nil {
		http.Error(w, err.Error(), 400)
		return
	}

	// cache headers for 2 hours
	w.Header().Set("Cache-Control", "public, max-age=7200")
	w.Header().Set("Expires", time.Now().Add(2*time.Hour).Format(http.TimeFormat))

	renderModifiedHTML(w, params)
}

// this is called by caddy to know if it should get a certificate for a domain or not
func handleCaddyAsk(w http.ResponseWriter, r *http.Request) {
	domain := r.URL.Query().Get("domain")
	cname := lookupCNAME(domain)
	if cname == "" {
		w.WriteHeader(400)
		return
	}
	if !strings.HasSuffix(cname, "."+s.BaseDomain+".") {
		w.WriteHeader(400)
		return
	}

	log.Info().Str("domain", domain).Msg("allowing external domain")
	return
}
