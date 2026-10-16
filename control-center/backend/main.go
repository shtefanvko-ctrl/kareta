package main

import (
 "encoding/json"
 "log"
 "net/http"
 "os"
 "strconv"
 "strings"
 "syscall"
 "time"
)

type systemInfo struct {
 Hostname string `json:"hostname"`
 MemoryTotalBytes *uint64 `json:"memoryTotalBytes"`
 MemoryAvailableBytes *uint64 `json:"memoryAvailableBytes"`
 Load1 *float64 `json:"load1"`
 DiskTotalBytes *uint64 `json:"diskTotalBytes"`
 DiskFreeBytes *uint64 `json:"diskFreeBytes"`
 Timestamp string `json:"timestamp"`
}

func jsonResponse(w http.ResponseWriter, value any) {
 w.Header().Set("Content-Type", "application/json; charset=utf-8")
 w.Header().Set("Cache-Control", "no-store")
 _ = json.NewEncoder(w).Encode(value)
}

func parseMeminfo(data []byte) (*uint64,*uint64) {
 var total, available *uint64
 for _, line := range strings.Split(string(data),"\n") {
  parts := strings.Fields(line)
  if len(parts) < 2 { continue }
  n,err := strconv.ParseUint(parts[1],10,64)
  if err != nil { continue }
  bytes := n*1024
  switch parts[0] {
  case "MemTotal:": total=&bytes
  case "MemAvailable:": available=&bytes
  }
 }
 return total,available
}

func readSystem() systemInfo {
 result:=systemInfo{Timestamp:time.Now().UTC().Format(time.RFC3339)}
 result.Hostname,_=os.Hostname()
 if b,err:=os.ReadFile("/proc/meminfo");err==nil {result.MemoryTotalBytes,result.MemoryAvailableBytes=parseMeminfo(b)}
 if b,err:=os.ReadFile("/proc/loadavg");err==nil {
  if f:=strings.Fields(string(b));len(f)>0 {
   if n,e:=strconv.ParseFloat(f[0],64);e==nil {result.Load1=&n}
  }
 }
 var stat syscall.Statfs_t
 if err:=syscall.Statfs("/",&stat);err==nil {
  total:=stat.Blocks*uint64(stat.Bsize)
  free:=stat.Bavail*uint64(stat.Bsize)
  result.DiskTotalBytes=&total
  result.DiskFreeBytes=&free
 }
 return result
}

func routes() http.Handler {
 mux:=http.NewServeMux()
 mux.HandleFunc("GET /api/health",func(w http.ResponseWriter,r *http.Request){jsonResponse(w,map[string]string{"status":"ok"})})
 mux.HandleFunc("GET /api/system",func(w http.ResponseWriter,r *http.Request){jsonResponse(w,readSystem())})
 return mux
}

func main() {
 addr:="127.0.0.1:4174"
 log.Printf("KARETA Control Center API on http://%s",addr)
 log.Fatal(http.ListenAndServe(addr,routes()))
}
