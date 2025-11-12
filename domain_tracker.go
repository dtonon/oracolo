package main

import (
	"database/sql"
	"sync"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

type DomainTracker struct {
	db *sql.DB
	mu sync.RWMutex
}

type DomainRecord struct {
	Domain          string    `json:"domain"`
	FirstSeen       time.Time `json:"first_seen"`
	LastSeen        time.Time `json:"last_seen"`
	RequestCount    int       `json:"request_count"`
	TargetSubdomain string    `json:"target_subdomain"`
}

func NewDomainTracker(dbPath string) (*DomainTracker, error) {
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, err
	}

	dt := &DomainTracker{db: db}
	if err := dt.initDB(); err != nil {
		return nil, err
	}

	return dt, nil
}

func (dt *DomainTracker) initDB() error {
	query := `
	CREATE TABLE IF NOT EXISTS domains (
		domain TEXT PRIMARY KEY,
		first_seen DATETIME NOT NULL,
		last_seen DATETIME NOT NULL,
		request_count INTEGER NOT NULL DEFAULT 1,
		target_subdomain TEXT NOT NULL
	);
	
	CREATE INDEX IF NOT EXISTS idx_last_seen ON domains(last_seen);
	CREATE INDEX IF NOT EXISTS idx_request_count ON domains(request_count);
	`

	_, err := dt.db.Exec(query)
	return err
}

func (dt *DomainTracker) RecordDomain(domain, targetSubdomain string) error {
	dt.mu.Lock()
	defer dt.mu.Unlock()

	now := time.Now()
	
	query := `
	INSERT INTO domains (domain, first_seen, last_seen, request_count, target_subdomain)
	VALUES (?, ?, ?, 1, ?)
	ON CONFLICT(domain) DO UPDATE SET
		last_seen = ?,
		request_count = request_count + 1,
		target_subdomain = ?
	`

	_, err := dt.db.Exec(query, domain, now, now, targetSubdomain, now, targetSubdomain)
	if err != nil {
		log.Error().Err(err).Str("domain", domain).Msg("failed to record domain")
		return err
	}

	log.Debug().Str("domain", domain).Str("target", targetSubdomain).Msg("recorded domain access")
	return nil
}

func (dt *DomainTracker) GetStats() (map[string]interface{}, error) {
	dt.mu.RLock()
	defer dt.mu.RUnlock()

	stats := make(map[string]interface{})

	var totalDomains, totalRequests int
	err := dt.db.QueryRow("SELECT COUNT(*), COALESCE(SUM(request_count), 0) FROM domains").Scan(&totalDomains, &totalRequests)
	if err != nil {
		return nil, err
	}
	stats["total_domains"] = totalDomains
	stats["total_requests"] = totalRequests

	var activeDomains int
	err = dt.db.QueryRow("SELECT COUNT(*) FROM domains WHERE last_seen > datetime('now', '-24 hours')").Scan(&activeDomains)
	if err != nil {
		return nil, err
	}
	stats["active_domains_24h"] = activeDomains

	return stats, nil
}

func (dt *DomainTracker) GetTopDomains(limit int) ([]DomainRecord, error) {
	dt.mu.RLock()
	defer dt.mu.RUnlock()

	query := `
	SELECT domain, first_seen, last_seen, request_count, target_subdomain 
	FROM domains 
	ORDER BY request_count DESC, last_seen DESC 
	LIMIT ?`

	rows, err := dt.db.Query(query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var domains []DomainRecord
	for rows.Next() {
		var d DomainRecord
		err := rows.Scan(&d.Domain, &d.FirstSeen, &d.LastSeen, &d.RequestCount, &d.TargetSubdomain)
		if err != nil {
			return nil, err
		}
		domains = append(domains, d)
	}

	return domains, nil
}

func (dt *DomainTracker) Close() error {
	return dt.db.Close()
}