import os
import sys

import requests


def main():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY")

    if not url or not key:
        print("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env", file=sys.stderr)
        sys.exit(2)

    # Simple endpoint: list runs table (may be 200 or 404 if table doesn't exist)
    endpoint = f"{url.rstrip('/')}/rest/v1/runs?select=*"
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Accept": "application/json",
    }

    try:
        resp = requests.get(endpoint, headers=headers, timeout=15)
        print("Status:", resp.status_code)
        print("Headers:", dict(resp.headers))
        print("Body:")
        # Print small body safely
        text = resp.text
        print(text[:1000])
        if resp.status_code == 401:
            print("Got 401 Unauthorized — verify service role key and project URL match.")
        elif resp.status_code == 404:
            print("Table 'runs' likely missing — key works, apply schema.")
    except Exception as e:
        print("Error:", e, file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
