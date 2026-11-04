package main
import (
 "testing"
 "encoding/hex"
)
const task="2f397ccd-7a29-44f6-bfcc-7d9ec18f423a"
func TestSynthetic(t *testing.T){
 r,err:=execute([]string{"--synthetic-task",task});if err!=nil {t.Fatal(err)}
 if r.Status!="PASS"||r.TaskID!=task||len(r.PayloadSHA256)!=64 {t.Fatalf("invalid result: %#v",r)}
 if _,err:=hex.DecodeString(r.PayloadSHA256);err!=nil {t.Fatal(err)}
 r2,err:=execute([]string{"--synthetic-task",task});if err!=nil||r.PayloadSHA256!=r2.PayloadSHA256 {t.Fatal("non deterministic")}
}
func TestRejectOtherWork(t *testing.T){
 cases:=[][]string{{},{"bash"},{"--shell","id"},{"--synthetic-task","../../etc/shadow"},{"--synthetic-task","2f397ccd-7a29-44f6-bfcc-7d9ec18f423a","--run"},{"--synthetic-task","2F397CCD-7A29-44F6-BFCC-7D9EC18F423A"}}
 for _,args:=range cases{ if _,err:=execute(args);err==nil {t.Fatalf("accepted %q",args)} }
}
