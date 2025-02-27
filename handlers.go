package main

import (
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
