"""
Toggle disabled-флаг CRM-ноды в n8n workflow DEzTechUg_bot.
Usage:
    python3 tools/n8n-toggle-crm-node.py enable   # включить ноду (после деплоя CRM)
    python3 tools/n8n-toggle-crm-node.py disable  # отключить ноду (если CRM нужно временно отключить)

Читает API-ключ и URL из .env.local (или env vars).
"""
import json
import os
import sys
import urllib.request
import urllib.error


def env(key: str) -> str:
    if key in os.environ and os.environ[key]:
        return os.environ[key]
    try:
        with open('.env.local', 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line.startswith(f'{key}='):
                    return line.split('=', 1)[1].strip().strip('"').strip("'")
    except FileNotFoundError:
        pass
    sys.exit(f'Missing env: {key}')


API_KEY = env('N8N_API_KEY')
BASE = env('N8N_API_URL').rstrip('/') + '/api/v1'
WF_ID = 'SkUMV2EUN8hObo76'
NODE_NAME = '[CRM] Send Lead to Inbound'


def http(method: str, path: str, body=None):
    data = json.dumps(body).encode('utf-8') if body is not None else None
    req = urllib.request.Request(
        f'{BASE}{path}',
        data=data,
        method=method,
        headers={
            'X-N8N-API-KEY': API_KEY,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode('utf-8')
            return resp.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8')


def main():
    if len(sys.argv) != 2 or sys.argv[1] not in ('enable', 'disable'):
        sys.exit('Usage: python3 tools/n8n-toggle-crm-node.py [enable|disable]')
    target_disabled = sys.argv[1] == 'disable'

    code, wf = http('GET', f'/workflows/{WF_ID}')
    if code != 200 or not isinstance(wf, dict):
        sys.exit(f'GET failed: HTTP {code} | {wf}')

    node = next((n for n in wf['nodes'] if n['name'] == NODE_NAME), None)
    if not node:
        sys.exit(f'Node "{NODE_NAME}" not found in workflow')

    current = bool(node.get('disabled', False))
    print(f'Current state: disabled={current}')
    if current == target_disabled:
        print('Already in target state, nothing to do.')
        return

    node['disabled'] = target_disabled

    put_body = {
        'name': wf['name'],
        'nodes': wf['nodes'],
        'connections': wf['connections'],
        'settings': wf.get('settings') or {'executionOrder': 'v1'},
    }
    code, resp = http('PUT', f'/workflows/{WF_ID}', put_body)
    print(f'PUT HTTP {code}')
    if code >= 400:
        print(resp)
        sys.exit(2)

    if isinstance(resp, dict):
        new_node = next((n for n in resp['nodes'] if n['name'] == NODE_NAME), None)
        new_state = bool(new_node.get('disabled', False)) if new_node else 'unknown'
        print(f'New state: disabled={new_state}')
        print(f'Workflow updatedAt: {resp.get("updatedAt")}')


if __name__ == '__main__':
    main()
