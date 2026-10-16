package main

import (
 "net/http"
 "net/http/httptest"
 "strings"
 "testing"
)

func TestHealth(t *testing.T) {
 req:=httptest.NewRequest(http.MethodGet,"/api/health",nil)
 rec:=httptest.NewRecorder()
 routes().ServeHTTP(rec,req)
 if rec.Code!=200 || !strings.Contains(rec.Body.String(),`"status":"ok"`) {t.Fatalf("unexpected response %d %s",rec.Code,rec.Body.String())}
}

func TestRejectPost(t *testing.T) {
 req:=httptest.NewRequest(http.MethodPost,"/api/system",nil)
 rec:=httptest.NewRecorder()
 routes().ServeHTTP(rec,req)
 if rec.Code!=http.StatusMethodNotAllowed {t.Fatalf("expected 405, got %d",rec.Code)}
}

func TestParseMeminfo(t *testing.T) {
 total,available:=parseMeminfo([]byte("MemTotal: 1024 kB\nMemAvailable: 512 kB\n"))
 if total==nil||available==nil||*total!=1048576||*available!=524288 {t.Fatal("incorrect memory parsing")}
}
