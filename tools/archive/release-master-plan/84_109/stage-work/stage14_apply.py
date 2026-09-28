from pathlib import Path
p=Path('/mnt/c/Users/KARETA.KZ/Desktop/kareta.kz/api/db.php')
s=p.read_text(encoding='utf-8')
repls=[
("case 'vehicles.issue.save': kareta_require_any_role(['client','master','sto','admin','owner']);",
 "case 'vehicles.issue.save': kareta_require_api_capability($pdo,'vehicles.update',['client','master','sto','admin','owner']);",1),
("case 'orders.masterClaim':   kareta_require_role('master');",
 "case 'orders.masterClaim':   kareta_require_api_capability($pdo,'requests.respond',['master']);",1),
("case 'orders.masterDecline': kareta_require_role('master');",
 "case 'orders.masterDecline': kareta_require_api_capability($pdo,'requests.respond',['master']);",1),
("case 'orders.update':        kareta_require_role('client');",
 "case 'orders.update':        kareta_require_api_capability($pdo,'requests.update',['client']);",1),
("case 'orders.cancelByClient':  kareta_require_role('client');",
 "case 'orders.cancelByClient':  kareta_require_api_capability($pdo,'requests.update',['client']);",1),
("case 'orders.clientEdit':    kareta_require_role('client');",
 "case 'orders.clientEdit':    kareta_require_api_capability($pdo,'requests.update',['client']);",1),
("case 'orders.returnToAdmin': kareta_require_any_role(['admin','owner','master']);",
 "case 'orders.returnToAdmin': kareta_require_api_capability($pdo,'work_orders.update_status',['admin','owner','master']);",1),
("case 'orders.confirmHandover': kareta_require_role('client');",
 "case 'orders.confirmHandover': kareta_require_api_capability($pdo,'requests.update',['client']);",1),
("case 'orders.setStatus':  kareta_require_any_role(['master','sto','admin','owner']);",
 "case 'orders.setStatus':  kareta_require_api_capability($pdo,'work_orders.update_status',['master','sto','admin','owner']);",1),
("case 'orders.addStage':   kareta_require_any_role(['master','sto','admin','owner']);",
 "case 'orders.addStage':   kareta_require_api_capability($pdo,'work_orders.update',['master','sto','admin','owner']);",1),
("case 'orders.complete':     kareta_require_role('master');",
 "case 'orders.complete':     kareta_require_api_capability($pdo,'work_orders.update_status',['master']);",1),
("case 'orders.confirmDone':  kareta_require_role('client');",
 "case 'orders.confirmDone':  kareta_require_api_capability($pdo,'requests.update',['client']);",1),
("case 'orders.proposeExtraQuote': kareta_require_role('master');",
 "case 'orders.proposeExtraQuote': kareta_require_api_capability($pdo,'work_orders.update',['master']);",1),
("case 'orders.acceptExtraQuote':  kareta_require_role('client');",
 "case 'orders.acceptExtraQuote':  kareta_require_api_capability($pdo,'requests.update',['client']);",1),
("case 'orders.declineExtraQuote': kareta_require_role('client');",
 "case 'orders.declineExtraQuote': kareta_require_api_capability($pdo,'requests.update',['client']);",1),
("case 'sto.reassignMaster':  kareta_require_any_role(['admin','owner','sto']);",
 "case 'sto.reassignMaster':  kareta_require_api_capability($pdo,'work_orders.assign',['admin','owner','sto']);",1),
("case 'sto.unassignMaster':  kareta_require_any_role(['admin','owner','sto']);",
 "case 'sto.unassignMaster':  kareta_require_api_capability($pdo,'work_orders.assign',['admin','owner','sto']);",1),
("case 'stoBays.assign': kareta_require_any_role(['sto','admin','owner']);",
 "case 'stoBays.assign': kareta_require_api_capability($pdo,'work_orders.assign',['sto','admin','owner']);",1),
("case 'stoBays.release': kareta_require_any_role(['sto','admin','owner']);",
 "case 'stoBays.release': kareta_require_api_capability($pdo,'work_orders.assign',['sto','admin','owner']);",1),
("case 'partsRequest.saveOffer': kareta_require_any_role(['master','sto','admin','owner']);",
 "case 'partsRequest.saveOffer': kareta_require_api_capability($pdo,'requests.respond',['master','sto','admin','owner']);",1),
("case 'chats.create':      kareta_require_any_role(['client','master','sto','admin','owner']);",
 "case 'chats.create':      kareta_require_api_capability($pdo,'chats.use',['client','master','sto','admin','owner']);",1),
("case 'chats.supportOpen': kareta_require_any_role(['client','master','sto','seller','admin','owner']);",
 "case 'chats.supportOpen': kareta_require_api_capability($pdo,'chats.use',['client','master','sto','seller','admin','owner']);",1),
("case 'masterWall.getMine': kareta_require_any_role(['admin','owner','master']);",
 "case 'masterWall.getMine': kareta_require_api_capability($pdo,'profile.read',['admin','owner','master']);",1),
("case 'masterWall.save':    kareta_require_any_role(['admin','owner','master']);",
 "case 'masterWall.save':    kareta_require_api_capability($pdo,'profile.manage',['admin','owner','master']);",1),
("case 'masterWall.delete':  kareta_require_any_role(['admin','owner','master']);",
 "case 'masterWall.delete':  kareta_require_api_capability($pdo,'profile.manage',['admin','owner','master']);",1),
("case 'masterPosts.getMine':  kareta_require_any_role(['admin','owner','master']);",
 "case 'masterPosts.getMine':  kareta_require_api_capability($pdo,'profile.read',['admin','owner','master']);",1),
("case 'masterPosts.save':     kareta_require_any_role(['admin','owner','master']);",
 "case 'masterPosts.save':     kareta_require_api_capability($pdo,'profile.manage',['admin','owner','master']);",1),
("case 'masterPosts.delete':   kareta_require_any_role(['admin','owner','master']);",
 "case 'masterPosts.delete':   kareta_require_api_capability($pdo,'profile.manage',['admin','owner','master']);",1),
("case 'masterMetrics.getMine': kareta_require_any_role(['admin','owner','master']);",
 "case 'masterMetrics.getMine': kareta_require_api_capability($pdo,'profile.read',['admin','owner','master']);",1),
("case 'master.saveProfile':   kareta_require_any_role(['admin','owner','master']);",
 "case 'master.saveProfile':   kareta_require_api_capability($pdo,'profile.manage',['admin','owner','master']);",1),
("case 'master.saveGeo':       kareta_require_any_role(['admin','owner','master']);",
 "case 'master.saveGeo':       kareta_require_api_capability($pdo,'profile.manage',['admin','owner','master']);",1),
("case 'stoExchange.getLeads':    kareta_require_any_role(['admin','owner','sto']);",
 "case 'stoExchange.getLeads':    kareta_require_api_capability($pdo,'work_orders.read',['admin','owner','sto']);",1),
("case 'stoExchange.acceptLead':  kareta_require_any_role(['admin','owner','sto']);",
 "case 'stoExchange.acceptLead':  kareta_require_api_capability($pdo,'work_orders.assign',['admin','owner','sto']);",1),
("case 'stoExchange.assignOrderMaster': kareta_require_any_role(['admin','owner','sto']);",
 "case 'stoExchange.assignOrderMaster': kareta_require_api_capability($pdo,'work_orders.assign',['admin','owner','sto']);",1),
("case 'stoExchange.hideLead':   kareta_require_any_role(['admin','owner','sto']);",
 "case 'stoExchange.hideLead':   kareta_require_api_capability($pdo,'work_orders.assign',['admin','owner','sto']);",1),
]
for old,new,expected in repls:
    c=s.count(old)
    if c!=expected:
        raise SystemExit(f'expected {expected} for {old!r}, found {c}')
    s=s.replace(old,new)
# Duplicated master-news write gates occur in both early and switch dispatch paths.
for old,new,expected in [
("kareta_require_any_role(['master','admin','owner']); news_save",
 "kareta_require_api_capability($pdo,'profile.manage',['master','admin','owner']); news_save",2),
("kareta_require_any_role(['master','admin','owner']); news_delete",
 "kareta_require_api_capability($pdo,'profile.manage',['master','admin','owner']); news_delete",2),
("kareta_require_any_role(['master','admin','owner']); news_mine",
 "kareta_require_api_capability($pdo,'profile.read',['master','admin','owner']); news_mine",1),
]:
    c=s.count(old)
    if c!=expected:
        raise SystemExit(f'expected {expected} for {old!r}, found {c}')
    s=s.replace(old,new)
p.write_text(s,encoding='utf-8')
print('MIGRATED',sum(x[2] for x in repls)+5)
