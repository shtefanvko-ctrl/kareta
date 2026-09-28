from pathlib import Path
import re, json, sys

root=Path('/mnt/c/Users/KARETA.KZ/Desktop/kareta.kz')
db=root/'api/db.php'
raw=db.read_text(encoding='utf-8')
lines=raw.splitlines(keepends=True)

def line_slice(a,b):
    return ''.join(lines[a-1:b])

# Validate original anchors before modifying.
anchors={
 'identity_start':(2678,'function auth_send_otp'),
 'identity_end':(2819,'}'),
 'cfg_path':(6780,'function app_config_path'),
 'cfg_default_end':(6792,'}'),
 'cfg_read':(6911,'function app_config_read'),
 'cfg_save_end':(6938,'}'),
}
for name,(ln,needle) in anchors.items():
    if needle not in lines[ln-1]:
        raise SystemExit(f'anchor mismatch {name} line {ln}: {lines[ln-1]!r}')

identity_funcs=line_slice(2678,2819)
config_funcs=line_slice(6780,6792) + '\n' + line_slice(6911,6938)

domains=root/'api/domains'
domains.mkdir(parents=True,exist_ok=True)

identity_header="""<?php
declare(strict_types=1);

/**
 * Stage 12: critical identity/admin actions extracted from api/db.php.
 * Add new identity/admin actions here, never to the db.php monolith.
 */
function kareta_identity_admin_dispatch(?PDO $pdo, string $action, array $body): bool {
    switch ($action) {
        case 'auth.sendOtp':
            auth_send_otp($pdo, $body);
            return true;
        case 'auth.verifyOtp':
            auth_verify_otp($pdo, $body);
            return true;
        case 'users.getAll':
            kareta_require_role('admin');
            users_getAll($pdo);
            return true;
        case 'users.setRole':
            kareta_require_role('admin');
            users_setRole($pdo, $body);
            return true;
        case 'users.setActive':
            kareta_require_role('admin');
            users_setActive($pdo, $body);
            return true;
        case 'users.upsert':
            kareta_json(['ok'=>false,'error'=>'method_deprecated','message'=>'Use profile.updateMine or users.upsertAdmin'], 405);
            return true;
        case 'profile.updateMine':
            profile_update_mine($pdo, $body);
            return true;
        case 'users.upsertAdmin':
            kareta_require_role('admin');
            kareta_json(['ok'=>true,'user'=>kareta_upsert_profile($pdo,$body['user']??$body)]);
            return true;
        default:
            return false;
    }
}

"""
(domains/'identity_admin.php').write_text(identity_header+identity_funcs,encoding='utf-8')

config_header="""<?php
declare(strict_types=1);

/**
 * Stage 12: runtime configuration actions extracted from api/db.php.
 * Add new runtime-config actions here, never to the db.php monolith.
 */
function kareta_runtime_config_dispatch(string $action, array $body): bool {
    switch ($action) {
        case 'config.get':
            kareta_require_role('owner');
            kareta_json(['ok'=>true,'config'=>app_config_read()]);
            return true;
        case 'config.save':
            kareta_require_role('owner');
            app_config_save($body);
            kareta_json(['ok'=>true]);
            return true;
        default:
            return false;
    }
}

"""
(domains/'runtime_config.php').write_text(config_header+config_funcs,encoding='utf-8')

# Remove extracted function line ranges from bottom to top using original line numbers.
remove_ranges=[(6911,6938),(6780,6792),(2678,2819)]
keep=[True]*len(lines)
for a,b in remove_ranges:
    for idx in range(a-1,b):
        keep[idx]=False
new=''.join(line for i,line in enumerate(lines) if keep[i])

# Remove old inline router cases/comments precisely.
old_blocks=[
"""    case 'auth.sendOtp':   auth_send_otp($pdo, $body);   break;
    case 'auth.verifyOtp': auth_verify_otp($pdo, $body); break;
    case 'users.getAll':      kareta_require_role('admin'); users_getAll($pdo);             break;
    case 'users.setRole':     kareta_require_role('admin'); users_setRole($pdo,$body);      break;
    case 'users.setActive':   kareta_require_role('admin'); users_setActive($pdo,$body);    break;
    // users.upsert """,
]
# Newline normalization: db text uses \n in Python even if original Windows.
for prefix in old_blocks:
    if prefix not in new:
        raise SystemExit('identity router block anchor not found')

new=new.replace("""    case 'auth.sendOtp':   auth_send_otp($pdo, $body);   break;
    case 'auth.verifyOtp': auth_verify_otp($pdo, $body); break;
    case 'users.getAll':      kareta_require_role('admin'); users_getAll($pdo);             break;
    case 'users.setRole':     kareta_require_role('admin'); users_setRole($pdo,$body);      break;
    case 'users.setActive':   kareta_require_role('admin'); users_setActive($pdo,$body);    break;
    // users.upsert """ , """    // Stage 12: identity/admin actions are dispatched by api/domains/identity_admin.php.
    // users.upsert """,1)
new=new.replace("""    case 'users.upsert':      kareta_json(['ok'=>false,'error'=>'method_deprecated','message'=>'Use profile.updateMine or users.upsertAdmin'], 405); break;
    case 'profile.updateMine': profile_update_mine($pdo,$body); break;
""","",1)
new=new.replace("""    case 'users.upsertAdmin': kareta_require_role('admin'); kareta_json(['ok'=>true,'user'=>kareta_upsert_profile($pdo,$body['user']??$body)]); break;

""","",1)
new=new.replace("""    case 'config.get':        kareta_require_role('owner'); kareta_json(['ok'=>true,'config'=>app_config_read()]); break;
    case 'config.save':       kareta_require_role('owner'); app_config_save($body); kareta_json(['ok'=>true]); break;
""","    // Stage 12: config actions are dispatched by api/domains/runtime_config.php.\n",1)

# Add requires after existing identity/context service includes.
needle="require_once __DIR__ . '/identity/context_service.php';\n"
if needle not in new:
    raise SystemExit('require anchor not found')
new=new.replace(needle, needle+"require_once __DIR__ . '/domains/identity_admin.php';\nrequire_once __DIR__ . '/domains/runtime_config.php';\n",1)

# Add domain dispatchers before monolithic switch.
needle2="$action = (string)($body['action'] ?? '');\n\nswitch ($action) {"
if needle2 not in new:
    raise SystemExit('switch anchor not found')
new=new.replace(needle2, "$action = (string)($body['action'] ?? '');\n\n/* Stage 12 strangler dispatch: critical domains live outside the monolith. */\nif (kareta_identity_admin_dispatch($pdo, $action, $body)) exit;\nif (kareta_runtime_config_dispatch($action, $body)) exit;\n\nswitch ($action) {",1)

db.write_text(new,encoding='utf-8')
print('TRANSFORM_OK')
print('OLD_BYTES',len(raw.encode('utf-8')))
print('NEW_BYTES',len(new.encode('utf-8')))
print('REMOVED_BYTES',len(raw.encode('utf-8'))-len(new.encode('utf-8')))
print('IDENTITY_DOMAIN_BYTES',(domains/'identity_admin.php').stat().st_size)
print('CONFIG_DOMAIN_BYTES',(domains/'runtime_config.php').stat().st_size)
