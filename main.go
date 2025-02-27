package main

import (
	"bytes"
	"context"
	_ "embed"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"github.com/kelseyhightower/envconfig"
	"github.com/rs/zerolog"
	"golang.org/x/sync/errgroup"
)

type Settings struct {
	BaseDomain string `envconfig:"BASE_DOMAIN" required:"true"`
	Port       string `envconfig:"PORT" default:"45070"`
}

//go:embed dist/index.html
var html []byte

var (
	s   Settings
	log = zerolog.New(os.Stderr).Output(zerolog.ConsoleWriter{Out: os.Stdout}).With().Timestamp().Logger()

	htmlPre  []byte
	htmlPost []byte
)

func main() {
	// load environment variables
	err := envconfig.Process("", &s)
	if err != nil {
		log.Fatal().Err(err).Msg("couldn't process envconfig")
		return
	}

	// prepare the html stuff we will always be modifying
	if htmlParts := bytes.Split(html, []byte("<!-- -=*=- -->")); len(htmlParts) != 3 {
		log.Fatal().Msg("something is wrong with the embedded html file")
		return
	} else {
		htmlPre = htmlParts[0]
		htmlPost = htmlParts[2]
	}

	// setup handlers
	mux := http.NewServeMux()
	mux.HandleFunc("/ask", handleCaddyAsk)
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		subdomain, found := strings.CutSuffix(r.Host, "."+s.BaseDomain)
		if found {
			handleSubdomain(subdomain, w, r)
		} else if r.Host == s.BaseDomain {
			handleHome(w, r)
		} else {
			handleMagicCNAME(w, r)
		}
	})

	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	server := &http.Server{Addr: ":" + s.Port, Handler: mux}
	log.Info().Msg("running on http://localhost:" + s.Port)
	g, ctx := errgroup.WithContext(ctx)
	g.Go(server.ListenAndServe)
	g.Go(func() error {
		<-ctx.Done()
		return server.Shutdown(context.Background())
	})

	if err := g.Wait(); err != nil {
		log.Debug().Err(err).Msg("exit reason")
	}
}
