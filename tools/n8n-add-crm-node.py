"""
Adds a disabled CRM-inbound HTTP Request node to n8n workflow DEzTechUg_bot
as a third fan-out branch from `Insert row1` (alongside Telegram + Gmail).

Why disabled: prod CRM endpoint /api/leads/inbound is not deployed yet.
The node will be enabled together with Sprint 2 deploy.

Usage: python3 tools/n8n-add-crm-node.py
"""
import json
import os
import sys
import urllib.request
import urllib.error
import uuid


def env(key: str) -> str:
    """Read env var from os.environ first, then fall back to .env.local."""
    if key in os.environ and os.environ[key]:
        return os.environ[key]
    try:
        with open(".env.local", "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith(f"{key}="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    except FileNotFoundError:
        pass
    sys.exit(f"Missing env: {key} (set it in .env.local or process env)")


API_KEY = env("N8N_API_KEY")
WF_ID = "SkUMV2EUN8hObo76"
BASE = env("N8N_API_URL").rstrip("/") + "/api/v1"
SECRET = env("N8N_INBOUND_SECRET")
NODE_NAME = "[CRM] Send Lead to Inbound"
BACKUP_DIR = "tmp/n8n-backups"


def http(method: str, path: str, body=None):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=data,
        method=method,
        headers={
            "X-N8N-API-KEY": API_KEY,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8")


def main():
    # 1. Fetch current workflow state from n8n (single source of truth)
    print(f"GET {BASE}/workflows/{WF_ID}")
    code, wf = http("GET", f"/workflows/{WF_ID}")
    if code != 200 or not isinstance(wf, dict):
        sys.exit(f"GET failed: HTTP {code} | body: {wf}")
    # Save fresh backup
    os.makedirs(BACKUP_DIR, exist_ok=True)
    ts = __import__("datetime").datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_path = os.path.join(BACKUP_DIR, f"DEzTechUg_bot-before-{ts}.json")
    with open(backup_path, "w", encoding="utf-8") as f:
        json.dump(wf, f, ensure_ascii=False, indent=2)
    print(f"Backup saved: {backup_path}")

    # 2. Idempotency check
    existing = [n for n in wf["nodes"] if n["name"] == NODE_NAME]
    if existing:
        print(f"Node '{NODE_NAME}' already present — aborting to avoid duplicates")
        sys.exit(2)

    # 3. Build new node
    insert_row = next(n for n in wf["nodes"] if n["name"] == "Insert row1")
    new_x = insert_row["position"][0] + 208
    new_y = insert_row["position"][1] + 288  # below Send a message which is +144
    new_node = {
        "parameters": {
            "method": "POST",
            "url": "https://crm.xn--c1abdaj0ewa6e.xn--p1ai/api/leads/inbound",
            "sendHeaders": True,
            "headerParameters": {
                "parameters": [
                    {"name": "X-N8N-Secret", "value": SECRET},
                    {"name": "Content-Type", "value": "application/json"},
                ]
            },
            "sendBody": True,
            "specifyBody": "json",
            "jsonBody": "={{ JSON.stringify($json) }}",
            "options": {},
        },
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.2,
        "position": [new_x, new_y],
        "id": str(uuid.uuid4()),
        "name": NODE_NAME,
        "disabled": True,
        "onError": "continueRegularOutput",
    }
    wf["nodes"].append(new_node)

    # 4. Add connection Insert row1 -> new node
    conns = wf["connections"].setdefault("Insert row1", {"main": [[]]})
    conns["main"][0].append({"node": NODE_NAME, "type": "main", "index": 0})

    # 5. Build PUT body (only writable fields)
    put_body = {
        "name": wf["name"],
        "nodes": wf["nodes"],
        "connections": wf["connections"],
        "settings": wf.get("settings") or {"executionOrder": "v1"},
    }

    # 6. Save "after" snapshot for diffing
    after_path = os.path.join(BACKUP_DIR, "DEzTechUg_bot-after.json")
    with open(after_path, "w", encoding="utf-8") as f:
        json.dump(put_body, f, ensure_ascii=False, indent=2)
    print(f"Saved preview: {after_path}")
    print(f"Total nodes: {len(put_body['nodes'])}, fan-out from Insert row1: {len(put_body['connections']['Insert row1']['main'][0])}")

    # 7. PUT
    print("\nPUT", f"{BASE}/workflows/{WF_ID}")
    code, resp = http("PUT", f"/workflows/{WF_ID}", put_body)
    print(f"HTTP {code}")
    if code >= 400:
        print(resp)
        sys.exit(3)
    if isinstance(resp, dict):
        print("OK. updatedAt:", resp.get("updatedAt"))
        print("Nodes after:", [n["name"] for n in resp["nodes"]])
        for n in resp["nodes"]:
            if n["name"] == NODE_NAME:
                print(f"  -> {NODE_NAME}: disabled={n.get('disabled')}, onError={n.get('onError')}")


if __name__ == "__main__":
    main()
