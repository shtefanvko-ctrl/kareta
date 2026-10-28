package main

import (
	"bytes"
	"crypto/rand"
	"crypto/subtle"
	"crypto/tls"
	"crypto/x509"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"math"
	"net/http"
	"os"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"
)

const agentAddress = "127.0.0.1:4175"
const probeMemory uint64 = 16 * 1024 * 1024
const heartbeatTTL = 35 * time.Second
const taskTTL = 60 * time.Second

// Encode state while locked, then perform potentially slow socket writes after
// unlocking. A slow client must never hold the shared fleet state hostage.
type bufferedResponse struct {
	bytes.Buffer
	header http.Header
	status int
}

func (b *bufferedResponse) Header() http.Header { return b.header }
func (b *bufferedResponse) WriteHeader(code int) {
	if b.status == 0 {
		b.status = code
	}
}
func (b *bufferedResponse) Write(p []byte) (int, error) {
	if b.status == 0 {
		b.status = 200
	}
	return b.Buffer.Write(p)
}
func (b *bufferedResponse) flush(w http.ResponseWriter) {
	for k, v := range b.header {
		w.Header()[k] = v
	}
	if b.status == 0 {
		b.status = 200
	}
	w.WriteHeader(b.status)
	_, _ = w.Write(b.Bytes())
}
func bufferReply(w http.ResponseWriter) (*bufferedResponse, func()) {
	b := &bufferedResponse{header: w.Header().Clone()}
	return b, func() { b.flush(w) }
}

type nodePolicy struct {
	ID            string  `json:"id"`
	Name          string  `json:"name"`
	ReserveCPU    float64 `json:"reserveCpu"`
	ReserveMemory uint64  `json:"reserveMemoryBytes"`
}
type nodeState struct {
	nodePolicy
	Info            *systemInfo `json:"metrics"`
	Seen            *time.Time  `json:"lastSeen"`
	Status          string      `json:"status"`
	AvailableCPU    float64     `json:"availableCpu"`
	AvailableMemory uint64      `json:"availableMemoryBytes"`
	ActiveTasks     int         `json:"activeTasks"`
	Ready           bool        `json:"ready"`
	Role            string      `json:"role"`
}
type task struct {
	ID      string      `json:"id"`
	Kind    string      `json:"kind"`
	NodeID  string      `json:"nodeId"`
	Status  string      `json:"status"`
	Created time.Time   `json:"created"`
	Started *time.Time  `json:"started"`
	Result  *systemInfo `json:"result"`
}
type fleet struct {
	mu         sync.Mutex
	nodes      map[string]*nodeState
	tasks      []*task
	adminToken string
	now        func() time.Time
}

func newFleet(policies []nodePolicy, token string) *fleet {
	f := &fleet{nodes: make(map[string]*nodeState), adminToken: token, now: time.Now, tasks: make([]*task, 0)}
	for _, p := range policies {
		f.nodes[p.ID] = &nodeState{nodePolicy: p, Status: "offline"}
	}
	return f
}

// Budgets are conservative admission estimates, not OS reservations or CPU limits.
// Uncertain tasks retain their reservation and prohibit another claim on that node.
func (f *fleet) update() {
	now := f.now()
	for _, t := range f.tasks {
		if t.Status == "queued" && now.Sub(t.Created) > 10*time.Minute {
			t.Status = "expired"
		}
		if t.Status == "running" && t.Started != nil && now.Sub(*t.Started) > taskTTL {
			t.Status = "unknown"
		}
	}
	for _, n := range f.nodes {
		n.Status, n.Ready, n.AvailableCPU, n.AvailableMemory, n.ActiveTasks = "offline", false, 0, 0, 0
		for _, t := range f.tasks {
			if t.NodeID == n.ID && (t.Status == "running" || t.Status == "unknown") {
				n.ActiveTasks++
			}
		}
		if n.Seen == nil || now.Sub(*n.Seen) > heartbeatTTL || n.Info == nil {
			continue
		}
		n.Status = "online"
		i := n.Info
		if i.MemoryAvailableBytes == nil || i.MemoryTotalBytes == nil || i.Load1 == nil {
			continue
		}
		usedCPU := math.Max(*i.Load1, float64(n.ActiveTasks))
		n.AvailableCPU = math.Max(0, float64(i.CPUCores)-n.ReserveCPU-usedCPU)
		reservedMemory := n.ReserveMemory + uint64(n.ActiveTasks)*probeMemory
		available := min(*i.MemoryTotalBytes, *i.MemoryAvailableBytes)
		if available > reservedMemory {
			n.AvailableMemory = available - reservedMemory
		}
		n.Ready = n.ActiveTasks == 0 && n.AvailableCPU >= 1 && n.AvailableMemory >= probeMemory
	}
}

func (f *fleet) overview(w http.ResponseWriter, r *http.Request) {
	reply, flush := bufferReply(w)
	defer flush()
	w = reply
	f.mu.Lock()
	defer f.mu.Unlock()
	f.update()
	nodes := make([]*nodeState, 0, len(f.nodes))
	online, ready := 1, 0
	local := readSystem()
	now := f.now()
	nodes = append(nodes, &nodeState{nodePolicy: nodePolicy{ID: "coordinator", Name: "Координатор CARAT"}, Info: &local, Seen: &now, Status: "online", Role: "coordinator"})
	for _, n := range f.nodes {
		nodes = append(nodes, n)
		if n.Status == "online" {
			online++
		}
		if n.Ready {
			ready++
		}
	}
	sort.Slice(nodes, func(i, j int) bool { return nodes[i].ID < nodes[j].ID })
	jsonResponse(w, map[string]any{"nodes": nodes, "tasks": f.tasks, "total": len(nodes), "online": online, "ready": ready, "dispatchEnabled": f.adminToken != "", "timestamp": f.now()})
}

func decodeBounded(w http.ResponseWriter, r *http.Request, value any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 8192)
	d := json.NewDecoder(r.Body)
	d.DisallowUnknownFields()
	if d.Decode(value) != nil || d.Decode(new(any)) != io.EOF {
		http.Error(w, "invalid payload", 400)
		return false
	}
	return true
}

func (f *fleet) submit(w http.ResponseWriter, r *http.Request) {
	if f.adminToken == "" || subtle.ConstantTimeCompare([]byte(r.Header.Get("Authorization")), []byte("Bearer "+f.adminToken)) != 1 {
		http.Error(w, "unauthorized", 401)
		return
	}
	var input struct {
		Kind   string `json:"kind"`
		NodeID string `json:"nodeId"`
	}
	if !decodeBounded(w, r, &input) {
		return
	}
	if input.Kind != "system-probe" {
		http.Error(w, "unsupported task kind", 422)
		return
	}
	reply, flush := bufferReply(w)
	defer flush()
	w = reply
	f.mu.Lock()
	defer f.mu.Unlock()
	f.update()
	if input.NodeID != "" && f.nodes[input.NodeID] == nil {
		http.Error(w, "unknown node", 422)
		return
	}
	// Hard bounds: no unbounded task history or queue growth. Never evict uncertain work.
	if len(f.tasks) >= 100 {
		kept := f.tasks[:0]
		for _, t := range f.tasks {
			if t.Status == "queued" || t.Status == "running" || t.Status == "unknown" {
				kept = append(kept, t)
			}
		}
		f.tasks = kept
		if len(f.tasks) >= 100 {
			http.Error(w, "queue full", 429)
			return
		}
	}
	id := make([]byte, 16)
	if _, err := rand.Read(id); err != nil {
		http.Error(w, "unavailable", 503)
		return
	}
	t := &task{ID: hex.EncodeToString(id), Kind: input.Kind, NodeID: input.NodeID, Status: "queued", Created: f.now()}
	f.tasks = append(f.tasks, t)
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusAccepted)
	jsonResponse(w, t)
}

func validInfo(i systemInfo) bool {
	if len(i.Hostname) == 0 || len(i.Hostname) > 128 || i.CPUCores < 1 || i.CPUCores > 4096 {
		return false
	}
	for _, v := range []*uint64{i.MemoryTotalBytes, i.MemoryAvailableBytes, i.DiskTotalBytes, i.DiskFreeBytes} {
		if v != nil && *v > 1<<60 {
			return false
		}
	}
	if i.MemoryTotalBytes != nil && i.MemoryAvailableBytes != nil && *i.MemoryAvailableBytes > *i.MemoryTotalBytes {
		return false
	}
	if i.DiskTotalBytes != nil && i.DiskFreeBytes != nil && *i.DiskFreeBytes > *i.DiskTotalBytes {
		return false
	}
	return i.Load1 == nil || (!math.IsNaN(*i.Load1) && !math.IsInf(*i.Load1, 0) && *i.Load1 >= 0 && *i.Load1 <= 1e6)
}

// Only the broker accepts agent requests. Certificate CN is bound to a configured
// node; a request body can never select another node's identity or task scope.
func (f *fleet) agentHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		if len(r.Header.Values("Origin")) > 0 || r.Header.Get("Sec-Fetch-Site") != "" {
			http.Error(w, "browser requests forbidden", 403)
			return
		}
		if r.TLS == nil || len(r.TLS.VerifiedChains) == 0 || len(r.TLS.PeerCertificates) == 0 {
			http.Error(w, "unauthorized", 401)
			return
		}
		id := r.TLS.PeerCertificates[0].Subject.CommonName
		// Membership is immutable for the lifetime of this configured broker.
		if f.nodes[id] == nil {
			http.Error(w, "forbidden node", 403)
			return
		}
		if r.Method != "POST" {
			http.Error(w, "method not allowed", 405)
			return
		}
		body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 8192))
		if err != nil {
			http.Error(w, "invalid payload", 400)
			return
		}
		r.Body = io.NopCloser(bytes.NewReader(body))
		reply, flush := bufferReply(w)
		defer flush()
		w = reply
		f.mu.Lock()
		defer f.mu.Unlock()
		n := f.nodes[id]
		if n == nil {
			http.Error(w, "forbidden node", 403)
			return
		}
		if r.Method != "POST" {
			http.Error(w, "method not allowed", 405)
			return
		}
		f.update()
		switch r.URL.Path {
		case "/agent/heartbeat":
			var info systemInfo
			if !decodeBounded(w, r, &info) {
				return
			}
			if !validInfo(info) {
				http.Error(w, "invalid metrics", 422)
				return
			}
			now := f.now()
			info.Timestamp = now.UTC().Format(time.RFC3339)
			n.Info = &info
			n.Seen = &now
			jsonResponse(w, map[string]string{"status": "ok"})
		case "/agent/claim":
			if !n.Ready {
				w.WriteHeader(204)
				return
			}
			for _, t := range f.tasks {
				if t.Status == "queued" && (t.NodeID == "" || t.NodeID == id) {
					now := f.now()
					t.NodeID = id
					t.Status = "running"
					t.Started = &now
					jsonResponse(w, t)
					return
				}
			}
			w.WriteHeader(204)
		case "/agent/complete":
			var input struct {
				ID     string     `json:"id"`
				Result systemInfo `json:"result"`
			}
			if !decodeBounded(w, r, &input) {
				return
			}
			if !validInfo(input.Result) {
				http.Error(w, "invalid result", 422)
				return
			}
			for _, t := range f.tasks {
				if t.ID == input.ID && t.NodeID == id {
					if t.Status == "completed" {
						jsonResponse(w, map[string]string{"status": "ok"})
						return
					}
					if t.Status != "running" && t.Status != "unknown" {
						break
					}
					t.Status = "completed"
					t.Result = &input.Result
					jsonResponse(w, map[string]string{"status": "ok"})
					return
				}
			}
			http.Error(w, "unknown task", 404)
		default:
			http.NotFound(w, r)
		}
	})
}

type fleetConfig struct {
	Nodes []nodePolicy `json:"nodes"`
	CA    string       `json:"ca"`
	Cert  string       `json:"cert"`
	Key   string       `json:"key"`
}

func configuredFleet() (*fleet, error) {
	path := os.Getenv("CARAT_FLEET_CONFIG")
	if path == "" {
		return newFleet(nil, ""), nil
	}
	b, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	if len(b) > 65536 {
		return nil, errors.New("fleet config too large")
	}
	var c fleetConfig
	d := json.NewDecoder(strings.NewReader(string(b)))
	d.DisallowUnknownFields()
	if d.Decode(&c) != nil || d.Decode(new(any)) != io.EOF || len(c.Nodes) > 64 {
		return nil, errors.New("invalid fleet config")
	}
	ids := map[string]bool{}
	pattern := regexp.MustCompile(`^[a-zA-Z0-9_-]{1,64}$`)
	for _, p := range c.Nodes {
		if !pattern.MatchString(p.ID) || p.ID == "coordinator" || ids[p.ID] || len(p.Name) > 128 || p.ReserveCPU < 0 || p.ReserveCPU > 4096 || p.ReserveMemory > 1<<60 {
			return nil, errors.New("invalid node policy")
		}
		ids[p.ID] = true
	}
	token := os.Getenv("CARAT_ADMIN_TOKEN")
	if tokenPath := os.Getenv("CARAT_ADMIN_TOKEN_FILE"); tokenPath != "" {
		b, e := os.ReadFile(tokenPath)
		if e != nil {
			return nil, e
		}
		token = strings.TrimSpace(string(b))
	}
	if len(token) < 32 {
		return nil, errors.New("CARAT_ADMIN_TOKEN requires at least 32 characters")
	}
	ca, err := os.ReadFile(c.CA)
	if err != nil {
		return nil, err
	}
	pool := x509.NewCertPool()
	if !pool.AppendCertsFromPEM(ca) {
		return nil, errors.New("invalid agent CA")
	}
	// Load credentials before starting either listener: partial setup must fail closed.
	cert, err := tls.LoadX509KeyPair(c.Cert, c.Key)
	if err != nil {
		return nil, err
	}
	f := newFleet(c.Nodes, token)
	s := &http.Server{Addr: agentAddress, Handler: f.agentHandler(), ReadHeaderTimeout: 3 * time.Second, ReadTimeout: 5 * time.Second, WriteTimeout: 5 * time.Second, IdleTimeout: 30 * time.Second, MaxHeaderBytes: 8192, TLSConfig: &tls.Config{MinVersion: tls.VersionTLS13, ClientAuth: tls.RequireAndVerifyClientCert, ClientCAs: pool, Certificates: []tls.Certificate{cert}}}
	listener, err := tls.Listen("tcp", agentAddress, s.TLSConfig)
	if err != nil {
		return nil, err
	}
	go func() {
		if err := s.Serve(listener); err != nil && err != http.ErrServerClosed {
			panic("agent broker stopped")
		}
	}()
	return f, nil
}
