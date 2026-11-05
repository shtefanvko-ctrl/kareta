package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestLocalBrowserBoundary(t *testing.T) {
	tests := []struct {
		name, host, origin, site string
		status                   int
	}{
		{"direct", apiAddress, "", "", 200},
		{"vite proxy", apiAddress, "http://127.0.0.1:5173", "same-origin", 200},
		{"api origin", apiAddress, "http://" + apiAddress, "same-origin", 200},
		{"rebinding", "attacker.example:4174", "", "", 403},
		{"host suffix", "127.0.0.1.attacker.example:4174", "", "", 403},
		{"wrong port", "127.0.0.1:5173", "", "", 403},
		{"remote origin", apiAddress, "https://attacker.example", "", 403},
		{"null origin", apiAddress, "null", "", 403},
		{"origin suffix", apiAddress, "http://127.0.0.1:5173.attacker.example", "", 403},
		{"other local service", apiAddress, "http://127.0.0.1:9000", "", 403},
		{"cross site without origin", apiAddress, "", "cross-site", 403},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "http://"+apiAddress+"/api/system", nil)
			req.Host = tt.host
			if tt.origin != "" {
				req.Header.Set("Origin", tt.origin)
			}
			if tt.site != "" {
				req.Header.Set("Sec-Fetch-Site", tt.site)
			}
			rec := httptest.NewRecorder()
			routes().ServeHTTP(rec, req)
			if rec.Code != tt.status {
				t.Fatalf("got %d, want %d", rec.Code, tt.status)
			}
			if rec.Header().Get("Access-Control-Allow-Origin") != "" {
				t.Fatal("API must not enable CORS")
			}
			if rec.Header().Get("Cache-Control") != "no-store" {
				t.Fatal("response must not be cached")
			}
			if rec.Header().Get("X-Content-Type-Options") != "nosniff" {
				t.Fatal("missing nosniff")
			}
			if tt.status != 200 {
				var leaked systemInfo
				if json.Unmarshal(rec.Body.Bytes(), &leaked) == nil {
					t.Fatal("rejected request exposed JSON metrics")
				}
			}
		})
	}
}

func TestDuplicateOriginsRejected(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "http://"+apiAddress+"/api/system", nil)
	req.Header.Add("Origin", "http://127.0.0.1:5173")
	req.Header.Add("Origin", "https://attacker.example")
	rec := httptest.NewRecorder()
	routes().ServeHTTP(rec, req)
	if rec.Code != 403 {
		t.Fatalf("got %d", rec.Code)
	}
}

func TestReadOnlyRoutes(t *testing.T) {
	for _, path := range []string{"/api/health", "/api/system"} {
		for _, method := range []string{http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete, http.MethodOptions, http.MethodConnect, http.MethodTrace} {
			t.Run(method+path, func(t *testing.T) {
				req := httptest.NewRequest(method, "http://"+apiAddress+path, nil)
				req.Host = apiAddress
				rec := httptest.NewRecorder()
				routes().ServeHTTP(rec, req)
				if rec.Code != http.StatusMethodNotAllowed {
					t.Fatalf("got %d", rec.Code)
				}
			})
		}
	}
	req := httptest.NewRequest(http.MethodGet, "http://"+apiAddress+"/api/exec", nil)
	rec := httptest.NewRecorder()
	routes().ServeHTTP(rec, req)
	if rec.Code != 404 {
		t.Fatalf("unknown path: got %d", rec.Code)
	}
}

func TestSystemJSON(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "http://"+apiAddress+"/api/system", nil)
	rec := httptest.NewRecorder()
	routes().ServeHTTP(rec, req)
	if rec.Code != 200 || rec.Header().Get("Content-Type") != "application/json; charset=utf-8" {
		t.Fatal("invalid response")
	}
	var value systemInfo
	if err := json.Unmarshal(rec.Body.Bytes(), &value); err != nil {
		t.Fatal(err)
	}
	if _, err := time.Parse(time.RFC3339, value.Timestamp); err != nil {
		t.Fatal(err)
	}
	// Missing metrics are explicitly null in the API contract.
	b, err := json.Marshal(systemInfo{})
	if err != nil {
		t.Fatal(err)
	}
	var fields map[string]any
	if err := json.Unmarshal(b, &fields); err != nil {
		t.Fatal(err)
	}
	for _, key := range []string{"memoryTotalBytes", "memoryAvailableBytes", "load1", "diskTotalBytes", "diskFreeBytes"} {
		value, ok := fields[key]
		if !ok || value != nil {
			t.Fatalf("%s must be null", key)
		}
	}
}

func TestServerLimits(t *testing.T) {
	s := newServer()
	if s.Addr != "127.0.0.1:4174" {
		t.Fatal("non-loopback bind")
	}
	if s.ReadHeaderTimeout <= 0 || s.ReadTimeout <= 0 || s.WriteTimeout <= 0 || s.IdleTimeout <= 0 || s.MaxHeaderBytes > 8192 || s.MaxHeaderBytes <= 0 {
		t.Fatal("unbounded HTTP server")
	}
}

func TestMissingMeminfo(t *testing.T) {
	for _, input := range []string{"", "invalid", "MemTotal: nope kB\nMemAvailable: nope kB\n"} {
		total, available := parseMeminfo([]byte(input))
		if total != nil || available != nil {
			t.Fatal("invalid metrics must be unavailable")
		}
	}
}
