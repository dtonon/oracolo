package main

import (
	"net/http"
	"strings"
)

func handleHome(w http.ResponseWriter, r *http.Request) {
	homePage().Render(r.Context(), w)
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
