package main

import (
	"embed"
	_ "embed"
	"net/http"
	"path/filepath"
	"strings"
	"time"
)

//go:embed src/homepage.html
var homepageHTML []byte

//go:embed dist/homepage.js
var homepageJS []byte

//go:embed dist/homepage.css
var homepageCSS []byte

//go:embed static/images
var staticImages embed.FS

func handleHome(w http.ResponseWriter, r *http.Request) {
	// Handle static image files
	if strings.HasPrefix(r.URL.Path, "/dist/images/") {

		// Replace /dist/images paths with the embed file system
		imagePath := strings.ReplaceAll(strings.TrimPrefix(r.URL.Path, "/"), "dist", "static")
		f, _ := staticImages.ReadFile(imagePath)

		// Set content type based on file extension
		ext := filepath.Ext(r.URL.Path)
		switch strings.ToLower(ext) {
		case ".jpg", ".jpeg":
			w.Header().Set("Content-Type", "image/jpeg")
		case ".png":
			w.Header().Set("Content-Type", "image/png")
		case ".gif":
			w.Header().Set("Content-Type", "image/gif")
		case ".svg":
			w.Header().Set("Content-Type", "image/svg+xml")
		case ".webp":
			w.Header().Set("Content-Type", "image/webp")
		default:
			w.Header().Set("Content-Type", "application/octet-stream")
		}

		w.Write(f)
		return
	}

	// If requesting static files from /dist/, serve them
	if strings.HasPrefix(r.URL.Path, "/dist/") {
		if s.Development {
			// in development, serve directly from disk
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

	// only serve homepage HTML for the root path
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}

	// serve homepage HTML
	w.Header().Set("Content-Type", "text/html")
	if s.Development {
		// in development, serve directly from disk
		http.ServeFile(w, r, "src/homepage.html")
		return
	}
	// in production, serve from embedded file
	w.Write(homepageHTML)
}

// this handles requests to https://npub1whatever.something-else.whatever-2.BASE_DOMAIN/
func handleSubdomain(subdomain string, w http.ResponseWriter, r *http.Request) {
	params, err := paramsFromSubdomain(subdomain)
	if err != nil {
		http.Error(w, err.Error(), 400)
		return
	}

	if r.URL.Query().Get("bundled") == "1" {
		renderModifiedBundled(w, params)
	} else {
		renderModified(w, params)
	}
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

	// record domain usage
	if domainTracker != nil {
		domainTracker.RecordDomain(r.Host, subdomain)
	}

	// cache headers for 2 hours
	w.Header().Set("Cache-Control", "public, max-age=7200")
	w.Header().Set("Expires", time.Now().Add(2*time.Hour).Format(http.TimeFormat))

	if r.URL.Query().Get("bundled") == "1" {
		renderModifiedBundled(w, params)
	} else {
		renderModified(w, params)
	}
}

// this is called by caddy to know if it should get a certificate for a domain or not
func handleCaddyAsk(w http.ResponseWriter, r *http.Request) {
	domain := r.URL.Query().Get("domain")
	cname := lookupCNAME(domain)
	if cname == "" {
		w.WriteHeader(400)
		return
	}
	if strings.HasSuffix(domain, "."+s.BaseDomain) {
		w.WriteHeader(400)
		return
	}
	if !strings.HasSuffix(cname, "."+s.BaseDomain+".") {
		w.WriteHeader(400)
		return
	}

	log.Info().Str("domain", domain).Str("cname", cname).Msg("allowing external domain")
	return
}

func handleCSS(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("content-type", "text/css")
	w.Write(css)
}

func handleJS(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("content-type", "application/javascript")
	w.Write(js)
}

// favicon.ico is good because people can use it when they download their own HTML
func handleFavicon(w http.ResponseWriter, r *http.Request) {
	f, _ := staticImages.ReadFile("static/images/favicon.ico")
	w.Header().Set("content-type", "image/x-icon")
	w.Write(f)
}
