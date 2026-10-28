package main

import (
	"bytes"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"os"
	"time"
)

// Use an SSH local forward on the worker to localhost:4175 on the coordinator.
// No arbitrary command runner, server-provided executable or insecure TLS mode.
func runAgent() error {
	cert, err := tls.LoadX509KeyPair(os.Getenv("CARAT_AGENT_CERT"), os.Getenv("CARAT_AGENT_KEY"))
	if err != nil {
		return err
	}
	ca, err := os.ReadFile(os.Getenv("CARAT_AGENT_CA"))
	if err != nil {
		return err
	}
	pool := x509.NewCertPool()
	if !pool.AppendCertsFromPEM(ca) {
		return errors.New("invalid broker CA")
	}
	client := &http.Client{Timeout: 5 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }, Transport: &http.Transport{TLSClientConfig: &tls.Config{MinVersion: tls.VersionTLS13, RootCAs: pool, Certificates: []tls.Certificate{cert}}}}
	call := func(path string, v any) ([]byte, int, error) {
		b, e := json.Marshal(v)
		if e != nil {
			return nil, 0, e
		}
		r, e := client.Post("https://localhost:4175"+path, "application/json", bytes.NewReader(b))
		if e != nil {
			return nil, 0, e
		}
		defer r.Body.Close()
		body, e := io.ReadAll(io.LimitReader(r.Body, 16384))
		return body, r.StatusCode, e
	}
	var pending any
	for {
		_, status, e := call("/agent/heartbeat", readSystem())
		if e != nil || status != 200 {
			log.Print("heartbeat failed; reconnecting")
			time.Sleep(10 * time.Second)
			continue
		}
		if pending != nil {
			_, status, e = call("/agent/complete", pending)
			if e == nil && (status == 200 || status == 404) {
				if status == 404 {
					log.Print("coordinator no longer has diagnostic task; discarding orphan result without replay")
				}
				pending = nil
			} else {
				log.Print("completion unconfirmed; keeping result, no new task")
				time.Sleep(10 * time.Second)
				continue
			}
		}
		b, status, e := call("/agent/claim", struct{}{})
		if e == nil && status == 200 {
			var t task
			if json.Unmarshal(b, &t) != nil || t.Kind != "system-probe" || t.ID == "" {
				return errors.New("unsupported broker task")
			}
			pending = map[string]any{"id": t.ID, "result": readSystem()}
		}
		time.Sleep(10 * time.Second)
	}
}
