import os
import requests
from dotenv import load_dotenv

base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
for name in (".env.local", ".env"):
    p = os.path.join(base_dir, name)
    if os.path.exists(p):
        load_dotenv(p, override=True)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
assert SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY

headers = {
    "apikey": SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
}

url = SUPABASE_URL.rstrip('/') + "/rest/v1/runs"
params = {"select": "*", "order": "created_at.desc"}
resp = requests.get(url, headers=headers, params=params)
print("Status:", resp.status_code)
try:
    print(resp.json())
except Exception:
    print(resp.text)
