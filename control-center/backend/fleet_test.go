package main

import (
	"bytes"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/json"
	"encoding/pem"
	"io"
	"math/big"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"
)

func fixtureInfo() systemInfo {
	total, free, disk := uint64(8<<30), uint64(6<<30), uint64(20<<30)
	load := 0.2
	return systemInfo{CPUCores: 4, Hostname: "test-worker", MemoryTotalBytes: &total, MemoryAvailableBytes: &free, DiskTotalBytes: &disk, DiskFreeBytes: &disk, Load1: &load}
}
func fixtureFleet() *fleet {
	return newFleet([]nodePolicy{{ID: "worker-a", Name: "Worker A", ReserveCPU: 1, ReserveMemory: 1 << 30}, {ID: "worker-b", Name: "Worker B", ReserveCPU: 1, ReserveMemory: 1 << 30}}, strings.Repeat("x", 32))
}
func agentRequest(f *fleet, id, path string, body any) *httptest.ResponseRecorder {
	b, _ := json.Marshal(body)
	r := httptest.NewRequest("POST", "https://localhost"+path, bytes.NewReader(b))
	cert := &x509.Certificate{Subject: pkix.Name{CommonName: id}}
	r.TLS = &tls.ConnectionState{PeerCertificates: []*x509.Certificate{cert}, VerifiedChains: [][]*x509.Certificate{{cert}}}
	w := httptest.NewRecorder()
	f.agentHandler().ServeHTTP(w, r)
	return w
}
func submitProbe(t *testing.T, f *fleet, node string) task {
	t.Helper()
	r := httptest.NewRequest("POST", "http://"+apiAddress+"/api/tasks", strings.NewReader(`{"kind":"system-probe","nodeId":"`+node+`"}`))
	r.Header.Set("Authorization", "Bearer "+f.adminToken)
	w := httptest.NewRecorder()
	fleetRoutes(f).ServeHTTP(w, r)
	if w.Code != 202 {
		t.Fatalf("submit: %d %s", w.Code, w.Body.String())
	}
	var result task
	json.Unmarshal(w.Body.Bytes(), &result)
	return result
}
func TestFleetLifecycleAndOwnership(t *testing.T) {
	f := fixtureFleet()
	now := time.Date(2026, 10, 28, 12, 0, 0, 0, time.UTC)
	f.now = func() time.Time { return now }
	job := submitProbe(t, f, "")
	if r := agentRequest(f, "worker-a", "/agent/claim", nil); r.Code != 204 {
		t.Fatalf("offline claim %d", r.Code)
	}
	if r := agentRequest(f, "worker-a", "/agent/heartbeat", fixtureInfo()); r.Code != 200 {
		t.Fatal(r.Body.String())
	}
	r := agentRequest(f, "worker-a", "/agent/claim", nil)
	if r.Code != 200 {
		t.Fatal(r.Code)
	}
	var claimed task
	json.Unmarshal(r.Body.Bytes(), &claimed)
	if claimed.ID != job.ID || claimed.NodeID != "worker-a" || claimed.Status != "running" {
		t.Fatal(claimed)
	}
	if r := agentRequest(f, "worker-a", "/agent/claim", nil); r.Code != 204 {
		t.Fatal("double claim")
	}
	if r := agentRequest(f, "worker-b", "/agent/complete", map[string]any{"id": job.ID, "result": fixtureInfo()}); r.Code != 404 {
		t.Fatal("cross-node completion")
	}
	now = now.Add(70 * time.Second)
	f.mu.Lock()
	f.update()
	if f.tasks[0].Status != "unknown" || f.nodes["worker-a"].AvailableMemory != 0 {
		t.Fatal("expired state")
	}
	f.mu.Unlock()
	agentRequest(f, "worker-a", "/agent/heartbeat", fixtureInfo())
	if r := agentRequest(f, "worker-a", "/agent/claim", nil); r.Code != 204 {
		t.Fatal("uncertain work must block another task")
	}
	for i := 0; i < 2; i++ {
		if r := agentRequest(f, "worker-a", "/agent/complete", map[string]any{"id": job.ID, "result": fixtureInfo()}); r.Code != 200 {
			t.Fatal("late/idempotent completion", r.Code)
		}
	}
	f.update()
	if !f.nodes["worker-a"].Ready || f.nodes["worker-a"].ActiveTasks != 0 {
		t.Fatal("budget not released")
	}
}
func TestFleetRejectsAuthMetricsAndUnknownKinds(t *testing.T) {
	f := fixtureFleet()
	for _, auth := range []string{"", "Bearer wrong"} {
		r := httptest.NewRequest("POST", "http://"+apiAddress+"/api/tasks", strings.NewReader(`{"kind":"system-probe"}`))
		r.Header.Set("Authorization", auth)
		w := httptest.NewRecorder()
		fleetRoutes(f).ServeHTTP(w, r)
		if w.Code != 401 {
			t.Fatal(w.Code)
		}
	}
	r := httptest.NewRequest("POST", "https://localhost/agent/heartbeat", strings.NewReader(`{}`))
	w := httptest.NewRecorder()
	f.agentHandler().ServeHTTP(w, r)
	if w.Code != 401 {
		t.Fatal(w.Code)
	}
	if r := agentRequest(f, "foreign", "/agent/heartbeat", fixtureInfo()); r.Code != 403 {
		t.Fatal(r.Code)
	}
	info := fixtureInfo()
	info.CPUCores = -1
	if r := agentRequest(f, "worker-a", "/agent/heartbeat", info); r.Code != 422 {
		t.Fatal(r.Code)
	}
	info = fixtureInfo()
	*info.MemoryAvailableBytes = *info.MemoryTotalBytes + 1
	if r := agentRequest(f, "worker-a", "/agent/heartbeat", info); r.Code != 422 {
		t.Fatal(r.Code)
	}
	r = httptest.NewRequest("POST", "http://"+apiAddress+"/api/tasks", strings.NewReader(`{"kind":"shell"}`))
	r.Header.Set("Authorization", "Bearer "+f.adminToken)
	w = httptest.NewRecorder()
	fleetRoutes(f).ServeHTTP(w, r)
	if w.Code != 422 {
		t.Fatal(w.Code)
	}
	r = httptest.NewRequest("POST", "http://"+apiAddress+"/api/tasks", strings.NewReader(`{"kind":"system-probe"}`))
	r.Header.Set("Authorization", "Bearer "+f.adminToken)
	r.Header.Set("Origin", "https://evil.example")
	w = httptest.NewRecorder()
	fleetRoutes(f).ServeHTTP(w, r)
	if w.Code != 403 {
		t.Fatal("browser boundary bypass")
	}
}
func TestFleetBudgetsAndStaleness(t *testing.T) {
	for _, reason := range []string{"reserve", "missing", "busy", "stale"} {
		t.Run(reason, func(t *testing.T) {
			f := fixtureFleet()
			now := time.Now()
			f.now = func() time.Time { return now }
			info := fixtureInfo()
			switch reason {
			case "reserve":
				f.nodes["worker-a"].ReserveMemory = 8 << 30
			case "missing":
				info.Load1 = nil
			case "busy":
				*info.Load1 = 4
			}
			agentRequest(f, "worker-a", "/agent/heartbeat", info)
			if reason == "stale" {
				now = now.Add(heartbeatTTL + time.Second)
			}
			submitProbe(t, f, "")
			if r := agentRequest(f, "worker-a", "/agent/claim", nil); r.Code != 204 {
				t.Fatalf("scheduled despite %s", reason)
			}
		})
	}
}
func TestFleetConcurrentClaimsAndTarget(t *testing.T) {
	f := fixtureFleet()
	agentRequest(f, "worker-a", "/agent/heartbeat", fixtureInfo())
	agentRequest(f, "worker-b", "/agent/heartbeat", fixtureInfo())
	submitProbe(t, f, "worker-b")
	if r := agentRequest(f, "worker-a", "/agent/claim", nil); r.Code != 204 {
		t.Fatal("target bypass")
	}
	var wg sync.WaitGroup
	codes := make(chan int, 20)
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() { defer wg.Done(); codes <- agentRequest(f, "worker-b", "/agent/claim", nil).Code }()
	}
	wg.Wait()
	close(codes)
	claims := 0
	for code := range codes {
		if code == 200 {
			claims++
		}
	}
	if claims != 1 {
		t.Fatalf("claims=%d", claims)
	}
}
func TestFleetQueueBoundsAndExpiry(t *testing.T) {
	f := fixtureFleet()
	now := time.Now()
	f.now = func() time.Time { return now }
	for i := 0; i < 100; i++ {
		submitProbe(t, f, "")
	}
	r := httptest.NewRequest("POST", "http://"+apiAddress+"/api/tasks", strings.NewReader(`{"kind":"system-probe"}`))
	r.Header.Set("Authorization", "Bearer "+f.adminToken)
	w := httptest.NewRecorder()
	fleetRoutes(f).ServeHTTP(w, r)
	if w.Code != 429 {
		t.Fatal(w.Code)
	}
	now = now.Add(11 * time.Minute)
	submitProbe(t, f, "")
	if len(f.tasks) != 1 {
		t.Fatal("history not pruned")
	}
}

// Real TLS handshake: unknown certificates cannot reach the broker handler.
func TestFleetMutualTLS(t *testing.T) {
	caKey, _ := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	caTemplate := &x509.Certificate{SerialNumber: big.NewInt(1), Subject: pkix.Name{CommonName: "test-ca"}, IsCA: true, BasicConstraintsValid: true, KeyUsage: x509.KeyUsageCertSign, NotBefore: time.Now().Add(-time.Hour), NotAfter: time.Now().Add(time.Hour)}
	caDER, _ := x509.CreateCertificate(rand.Reader, caTemplate, caTemplate, &caKey.PublicKey, caKey)
	ca, _ := x509.ParseCertificate(caDER)
	pool := x509.NewCertPool()
	pool.AddCert(ca)
	issue := func(cn string, client bool) tls.Certificate {
		key, _ := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
		usage := x509.ExtKeyUsageServerAuth
		if client {
			usage = x509.ExtKeyUsageClientAuth
		}
		template := &x509.Certificate{SerialNumber: big.NewInt(time.Now().UnixNano()), Subject: pkix.Name{CommonName: cn}, DNSNames: []string{"localhost"}, NotBefore: time.Now().Add(-time.Hour), NotAfter: time.Now().Add(time.Hour), ExtKeyUsage: []x509.ExtKeyUsage{usage}, KeyUsage: x509.KeyUsageDigitalSignature}
		der, _ := x509.CreateCertificate(rand.Reader, template, ca, &key.PublicKey, caKey)
		keyDER, _ := x509.MarshalECPrivateKey(key)
		cert, err := tls.X509KeyPair(pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der}), pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: keyDER}))
		if err != nil {
			t.Fatal(err)
		}
		return cert
	}
	f := fixtureFleet()
	server := httptest.NewUnstartedServer(f.agentHandler())
	server.TLS = &tls.Config{MinVersion: tls.VersionTLS13, ClientAuth: tls.RequireAndVerifyClientCert, ClientCAs: pool, Certificates: []tls.Certificate{issue("localhost", false)}}
	server.StartTLS()
	defer server.Close()
	for _, cn := range []string{"", "foreign", "worker-a"} {
		tlsConfig := &tls.Config{RootCAs: pool, ServerName: "localhost", MinVersion: tls.VersionTLS13}
		if cn != "" {
			tlsConfig.Certificates = []tls.Certificate{issue(cn, true)}
		}
		transport := &http.Transport{TLSClientConfig: tlsConfig}
		client := &http.Client{Transport: transport, Timeout: time.Second}
		b, _ := json.Marshal(fixtureInfo())
		r, err := client.Post(server.URL+"/agent/heartbeat", "application/json", bytes.NewReader(b))
		transport.CloseIdleConnections()
		if cn == "" {
			if err == nil {
				r.Body.Close()
				t.Fatal("accepted no certificate")
			}
			continue
		}
		if err != nil {
			t.Fatal(err)
		}
		io.Copy(io.Discard, r.Body)
		r.Body.Close()
		want := 200
		if cn == "foreign" {
			want = 403
		}
		if r.StatusCode != want {
			t.Fatal(cn, r.StatusCode)
		}
	}
}

type gatedReader struct {
	entered chan struct{}
	release chan struct{}
	data    []byte
	once    sync.Once
}

func (g *gatedReader) Read(p []byte) (int, error) {
	g.once.Do(func() { close(g.entered) })
	<-g.release
	if len(g.data) == 0 {
		return 0, io.EOF
	}
	n := copy(p, g.data)
	g.data = g.data[n:]
	return n, nil
}
func (g *gatedReader) Close() error { return nil }

type gatedWriter struct {
	*httptest.ResponseRecorder
	entered chan struct{}
	release chan struct{}
	once    sync.Once
}

func (g *gatedWriter) Write(p []byte) (int, error) {
	g.once.Do(func() { close(g.entered) })
	<-g.release
	return g.ResponseRecorder.Write(p)
}
func TestFleetSlowAgentDoesNotHoldStateLock(t *testing.T) {
	for _, phase := range []string{"read", "write"} {
		t.Run(phase, func(t *testing.T) {
			f := fixtureFleet()
			body, _ := json.Marshal(fixtureInfo())
			entered, release, done := make(chan struct{}), make(chan struct{}), make(chan struct{})
			r := httptest.NewRequest("POST", "https://localhost/agent/heartbeat", bytes.NewReader(body))
			cert := &x509.Certificate{Subject: pkix.Name{CommonName: "worker-a"}}
			r.TLS = &tls.ConnectionState{PeerCertificates: []*x509.Certificate{cert}, VerifiedChains: [][]*x509.Certificate{{cert}}}
			var w http.ResponseWriter = httptest.NewRecorder()
			if phase == "read" {
				r.Body = &gatedReader{entered: entered, release: release, data: body}
			} else {
				w = &gatedWriter{ResponseRecorder: httptest.NewRecorder(), entered: entered, release: release}
			}
			go func() { defer close(done); f.agentHandler().ServeHTTP(w, r) }()
			select {
			case <-entered:
			case <-time.After(time.Second):
				close(release)
				t.Fatal("did not reach gated IO")
			}
			unlocked := f.mu.TryLock()
			if unlocked {
				f.mu.Unlock()
			}
			close(release)
			<-done
			if !unlocked {
				t.Fatalf("slow network %s held fleet lock", phase)
			}
		})
	}
}
