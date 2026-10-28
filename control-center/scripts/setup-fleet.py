#!/usr/bin/env python3
"""Create an OFFLINE fleet configuration and private credentials. Never install services."""
import argparse
import json
import os
from pathlib import Path
import re
import secrets
import subprocess

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('directory', type=Path)
parser.add_argument('nodes', nargs='+', help='Unique worker IDs matching [a-zA-Z0-9_-]{1,64}')
args = parser.parse_args()
if len(args.nodes) > 64 or len(set(args.nodes)) != len(args.nodes) or any(not re.fullmatch(r'[a-zA-Z0-9_-]{1,64}', n) or n == 'coordinator' for n in args.nodes):
    parser.error('Invalid or duplicate worker ID')
root = args.directory.resolve()
if root.exists():
    parser.error('Destination must not exist; refusing to replace credentials')
os.umask(0o077)
root.mkdir(parents=True, mode=0o700)

def openssl(*argv):
    subprocess.run(['openssl', *map(str, argv)], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

openssl('req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-256', '-nodes', '-days', '365', '-subj', '/CN=CARAT private fleet CA', '-keyout', root/'ca.key', '-out', root/'ca.crt', '-addext', 'basicConstraints=critical,CA:TRUE', '-addext', 'keyUsage=critical,keyCertSign,cRLSign')

def issue(name, directory, client):
    directory.mkdir(exist_ok=True, mode=0o700)
    key, csr, cert, ext = [directory / (name + suffix) for suffix in ['.key', '.csr', '.crt', '.ext']]
    openssl('req', '-new', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-256', '-nodes', '-subj', '/CN='+name, '-keyout', key, '-out', csr)
    ext.write_text('basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature\nextendedKeyUsage='+('clientAuth' if client else 'serverAuth')+'\n'+('' if client else 'subjectAltName=DNS:localhost\n'))
    openssl('x509', '-req', '-in', csr, '-CA', root/'ca.crt', '-CAkey', root/'ca.key', '-set_serial', str(secrets.randbits(128)), '-days', '90', '-extfile', ext, '-out', cert)
    csr.unlink(); ext.unlink()
    return cert, key

cert, key = issue('localhost', root, False)
for node in args.nodes:
    directory = root / node
    issue(node, directory, True)
    (directory/'ca.crt').write_bytes((root/'ca.crt').read_bytes())
(root/'admin-token').write_text(secrets.token_urlsafe(48)+'\n')
(root/'fleet.json').write_text(json.dumps({'ca':str(root/'ca.crt'),'cert':str(cert),'key':str(key),'nodes':[{'id':n,'name':n,'reserveCpu':1,'reserveMemoryBytes':1073741824} for n in args.nodes]},indent=2)+'\n')
print('Created private fleet configuration at', root)
print('No machines connected or services installed. Copy only each worker subdirectory to that worker.')
