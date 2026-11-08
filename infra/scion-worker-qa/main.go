// CARAT Scion synthetic worker v1: a real process, not a BusyBox echo.
// Narrow contract: one deterministic fixed-purpose operation, no shell,
// no dynamic module loading, no filesystem/network I/O or K8s credentials.
package main

import (
 "crypto/sha256"
 "encoding/hex"
 "encoding/json"
 "fmt"
 "os"
 "regexp"
)

const schema = "carat-scion-synthetic-v1"
const canaryPayload = "CARAT_SCION_CANARY_V1_PAYLOAD"
var validTask = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)

type Result struct {
 Schema string `json:"schema"`
 TaskID string `json:"task_id"`
 Status string `json:"status"`
 PayloadSHA256 string `json:"payload_sha256"`
}

func execute(args []string) (Result,error) {
 if len(args)!=2 || args[0]!="--synthetic-task" || !validTask.MatchString(args[1]) {
  return Result{},fmt.Errorf("DENY: only --synthetic-task <UUID> is allowed")
 }
 digest:=sha256.Sum256([]byte(schema+"\x00"+args[1]+"\x00"+canaryPayload))
 return Result{Schema:schema,TaskID:args[1],Status:"PASS",PayloadSHA256:hex.EncodeToString(digest[:])},nil
}

func main() {
 r,err:=execute(os.Args[1:]);if err!=nil {fmt.Fprintln(os.Stderr,err);os.Exit(2)}
 enc:=json.NewEncoder(os.Stdout);enc.SetEscapeHTML(true)
 if err:=enc.Encode(r);err!=nil {os.Exit(3)}
}
