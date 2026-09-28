from pathlib import Path
import re
p=Path('/mnt/c/Users/KARETA.KZ/Desktop/kareta.kz/api/db.php')
s=p.read_text(encoding='utf-8')
needle="require_once __DIR__ . '/domains/runtime_config.php';\n"
insert=needle+"require_once __DIR__ . '/domains/capability_dispatch.php';\n"
if s.count(needle)!=1: raise SystemExit('runtime_config include anchor mismatch')
if "domains/capability_dispatch.php" not in s:
    s=s.replace(needle,insert,1)

needle="    $action = $_GET['action'] ?? 'ping';\n"
repl=needle+"    kareta_require_migrated_business_capability($pdo,(string)$action,'GET');\n"
if s.count(needle)!=1: raise SystemExit('GET action anchor mismatch')
if "kareta_require_migrated_business_capability($pdo,(string)$action,'GET')" not in s:
    s=s.replace(needle,repl,1)

needle="$action = (string)($body['action'] ?? '');\n"
repl=needle+"kareta_require_migrated_business_capability($pdo,$action,'POST');\n"
if s.count(needle)!=1: raise SystemExit('POST action anchor mismatch')
if "kareta_require_migrated_business_capability($pdo,$action,'POST')" not in s:
    s=s.replace(needle,repl,1)

targets={
'news.mine','news.save','news.delete','vehicles.issue.save','orders.masterClaim','orders.masterDecline',
'orders.update','orders.cancelByClient','orders.clientEdit','orders.returnToAdmin','orders.confirmHandover',
'orders.setStatus','orders.addStage','orders.complete','orders.confirmDone','orders.proposeExtraQuote',
'orders.acceptExtraQuote','orders.declineExtraQuote','sto.reassignMaster','sto.unassignMaster',
'stoBays.assign','stoBays.release','partsRequest.saveOffer','chats.create','chats.supportOpen',
'masterWall.getMine','masterWall.save','masterWall.delete','masterPosts.getMine','masterPosts.save',
'masterPosts.delete','masterMetrics.getMine','master.saveProfile','master.saveGeo','stoExchange.getLeads',
'stoExchange.acceptLead','stoExchange.assignOrderMaster','stoExchange.hideLead'
}
lines=s.splitlines(True)
removed=0
for i,line in enumerate(lines):
    if not any(("'" + a + "'") in line for a in targets):
        continue
    new,n=re.subn(r"kareta_require_api_capability\(\$pdo,'[^']+',\[[^\]]*\]\);\s*", "", line)
    if n:
        lines[i]=new
        removed+=n
s=''.join(lines)
if removed!=40:
    raise SystemExit(f'expected 40 per-action capability calls removed, got {removed}')
p.write_text(s,encoding='utf-8')
print('REMOVED_CALLS',removed)
