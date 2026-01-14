import os
import json
import requests
from dotenv import load_dotenv

# Load .env if present (supports both .env and .env.local)
# Load envs from apps/api, preferring .env.local if present
base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
for name in (".env.local", ".env"):
    p = os.path.join(base_dir, name)
    if os.path.exists(p):
        load_dotenv(p, override=True)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

assert SUPABASE_URL, "SUPABASE_URL is required"
assert SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY is required"

print("Using SUPABASE_URL:", SUPABASE_URL)

headers = {
    "apikey": SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

# Insert a run via REST
payload = {
    "status": "queued",
    "prompt": "REST insert test",
    "metadata": {"source": "rest_insert_test.py"}
}

url = SUPABASE_URL.rstrip('/') + "/rest/v1/runs"
params = {"select": "*"}

resp = requests.post(url, headers=headers, params=params, data=json.dumps(payload))
print("Status:", resp.status_code)
try:
    print("Body:", resp.json())
except Exception:
    print("Body:", resp.text)

if resp.status_code >= 400:
    print("Headers:", resp.headers)
    # Try to fetch OpenAPI to help diagnose table/columns
    try:
        openapi = requests.get(SUPABASE_URL.rstrip('/') + "/rest/v1", headers={"apikey": SUPABASE_SERVICE_ROLE_KEY}).json()
        tables = [k for k in openapi.get("definitions", {}).keys()]
        print("REST tables available:", tables)
        runs_def = openapi.get("definitions", {}).get("runs")
        if runs_def and "properties" in runs_def:
            cols = list(runs_def["properties"].keys())
            print("runs columns:", cols)
            if "prompt" not in cols:
                print("Hint: Apply apps/api/scripts/supabase_schema.sql in Supabase to add expected columns.")
    except Exception as e:
        print("Could not fetch OpenAPI:", e)
