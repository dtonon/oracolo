package main

import (
	"net"
	"net/http"
)

func handleHome(w http.ResponseWriter, r *http.Request) {
	homePage().Render(r.Context(), w)
}

func handleSubdomain(subdomain string, w http.ResponseWriter, r *http.Request) {
	params, err := paramsFromSubdomain(subdomain)
	if err != nil {
		http.Error(w, err.Error(), 400)
		return
	}
	renderModifiedHTML(w, params)
}

func handleMagicCNAME(w http.ResponseWriter, r *http.Request) {
	cname, err := net.LookupCNAME(r.Host)
	if err != nil {
		http.Error(w, "missing CNAME record for "+r.Host, 400)
		return
	}

	subdomain := cname[0 : len(cname)-len(s.BaseDomain)-1]
	params, err := paramsFromSubdomain(subdomain)
	if err != nil {
		http.Error(w, err.Error(), 400)
		return
	}
	renderModifiedHTML(w, params)
}
