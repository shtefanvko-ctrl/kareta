#!/usr/bin/env python3
"""Real local processes/TLS; not evidence of multiple physical machines."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time
import urllib.request

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--binary', type=Path, required=True)
args = parser.parse_args()
binary = args.binary.resolve()
processes = []

def wait_for(check, seconds=35):
    deadline = time.monotonic()+seconds
    while time.monotonic() < deadline:
        try:
            result = check()
            if result:
                return result
        except (OSError, ValueError):
            pass
        time.sleep(.1)
    raise AssertionError('Integration condition did not complete before timeout')

with tempfile.TemporaryDirectory(prefix='carat-integration-') as tmp:
    private = Path(tmp)/'private'
    subprocess.run(['python3', str(Path(__file__).with_name('setup-fleet.py')), str(private), 'worker-a', 'worker-b'], check=True, stdout=subprocess.DEVNULL)

    def api(path, payload=None):
        headers = {}
        if payload is not None:
            headers = {'Content-Type':'application/json', 'Authorization':'Bearer '+(private/'admin-token').read_text().strip()}
        request = urllib.request.Request('http://127.0.0.1:4174'+path, data=None if payload is None else json.dumps(payload).encode(), headers=headers)
        with urllib.request.urlopen(request, timeout=2) as response:
            return json.load(response)

    def start_coordinator():
        env = os.environ.copy()
        env.update(CARAT_FLEET_CONFIG=str(private/'fleet.json'), CARAT_ADMIN_TOKEN_FILE=str(private/'admin-token'))
        p = subprocess.Popen([str(binary)], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        processes.append(p)
        wait_for(lambda: p.poll() is None and api('/api/health')['status']=='ok', 5)
        return p

    try:
        # Prevent accidentally talking to an already running user's coordinator.
        import socket
        for port in [4174, 4175]:
            with socket.socket() as sock:
                sock.bind(('127.0.0.1', port))
        coordinator = start_coordinator()
        state = api('/api/fleet')
        assert (state['total'],state['online'],state['ready'])==(3,1,0)
        for node in ['worker-a','worker-b']:
            env = os.environ.copy()
            env.update(CARAT_AGENT_CERT=str(private/node/(node+'.crt')), CARAT_AGENT_KEY=str(private/node/(node+'.key')), CARAT_AGENT_CA=str(private/node/'ca.crt'))
            processes.append(subprocess.Popen([str(binary),'--agent'], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
        wait_for(lambda: api('/api/fleet')['online']==3)
        # Real resource admission may defer jobs on a genuinely overloaded host.
        wait_for(lambda: api('/api/fleet')['ready']==2)
        first = api('/api/tasks', {'kind':'system-probe', 'nodeId':'worker-a'})
        api('/api/tasks', {'kind':'system-probe', 'nodeId':'worker-b'})
        wait_for(lambda: all(t['status']=='completed' for t in api('/api/fleet')['tasks']))
        state = api('/api/fleet')
        assert len(state['tasks'])==2
        assert {t['nodeId'] for t in state['tasks']}=={'worker-a','worker-b'}
        assert all(t['result']['cpuCores']>0 and t['result']['hostname'] for t in state['tasks'])
        # Restart while a worker holds an unacknowledged result. Lost tasks must
        # not replay and a 404 completion must not strand the worker forever.
        api('/api/tasks', {'kind':'system-probe', 'nodeId':'worker-a'})
        wait_for(lambda: any(t['status']=='running' for t in api('/api/fleet')['tasks']))
        coordinator.terminate(); coordinator.wait(timeout=3)
        coordinator = start_coordinator()
        recovered = api('/api/tasks', {'kind':'system-probe', 'nodeId':'worker-a'})
        wait_for(lambda: any(t['id']==recovered['id'] and t['status']=='completed' for t in api('/api/fleet')['tasks']))
        assert len(api('/api/fleet')['tasks'])==1, 'Lost task was replayed'
        print('PASS: two local agents, real TLS/metrics/targeted execution and coordinator restart recovery; one physical host only.')
    finally:
        for p in reversed(processes):
            if p.poll() is None:
                p.terminate()
        for p in processes:
            try:
                p.wait(timeout=3)
            except subprocess.TimeoutExpired:
                p.kill(); p.wait()
