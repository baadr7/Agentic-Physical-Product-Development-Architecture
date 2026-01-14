"""Environment diagnostics for Supabase configuration.

Run:
    python env_check.py

Adds JWT role decode to distinguish anon vs service_role explicitly.
"""
from __future__ import annotations
import os
import json
import requests
import base64
from pathlib import Path


def _load_dotenv_if_present() -> None:
    try:
        from dotenv import load_dotenv

        load_dotenv(dotenv_path=Path(__file__).parent / '.env')
    except Exception:
        return


def _decode_jwt_role(token: str | None) -> str | None:
    if not token or token.count('.') < 2:
        return None
    try:
        payload_seg = token.split('.')[1]
        pad = '=' * (-len(payload_seg) % 4)
        decoded = base64.urlsafe_b64decode(payload_seg + pad)
        payload_json = json.loads(decoded.decode('utf-8'))
        return payload_json.get('role') or payload_json.get('roles')
    except Exception:
        return None


def main() -> None:
    _load_dotenv_if_present()

    SUPABASE_URL = os.getenv('SUPABASE_URL')
    SERVICE_KEY = os.getenv('SUPABASE_KEY') or os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    ANON_KEY = os.getenv('SUPABASE_ANON_KEY')
    JWT_ROLE = _decode_jwt_role(SERVICE_KEY)

    print('--- Supabase Environment Diagnostics ---')
    print(f"SUPABASE_URL: {SUPABASE_URL or 'NOT SET'}")
    print(f"SUPABASE_KEY length: {len(SERVICE_KEY) if SERVICE_KEY else 0}")
    print(f"SUPABASE_ANON_KEY length: {len(ANON_KEY) if ANON_KEY else 0}")
    print(f"Decoded JWT role: {JWT_ROLE or 'N/A'}")

    if not SUPABASE_URL:
        print('ERROR: SUPABASE_URL missing. Set https://<project-ref>.supabase.co')
        raise SystemExit(1)
    if not SERVICE_KEY:
        print('ERROR: SUPABASE_KEY (service role) missing. Provide service_role key from dashboard.')
        raise SystemExit(1)

    headers = {
        'apikey': SERVICE_KEY,
        'Authorization': f'Bearer {SERVICE_KEY}',
        'Accept': 'application/json',
    }

    # 1. Simple REST table existence probe
    rest_probe = f"{SUPABASE_URL}/rest/v1/projects?select=id&limit=1"
    try:
        r1 = requests.get(rest_probe, headers=headers, timeout=8)
        print(f"REST probe status: {r1.status_code}")
    except Exception as e:
        print('REST probe failed:', e)
        r1 = None

    # 2. Auth admin users endpoint (requires service role)
    admin_url = f"{SUPABASE_URL}/auth/v1/admin/users?per_page=1"
    try:
        r2 = requests.get(admin_url, headers=headers, timeout=8)
        print(f"Admin users status: {r2.status_code}")
    except Exception as e:
        print('Admin users request failed:', e)
        r2 = None

    classification = 'unknown'
    if r2 is not None:
        if r2.status_code == 200:
            classification = 'service_role (valid)'
        elif r2.status_code == 401:
            classification = 'anon-or-invalid (401)'
        elif r2.status_code == 403:
            classification = 'forbidden (403) - likely not service role'

    print(f"Key classification: {classification}")

    if classification != 'service_role (valid)' or JWT_ROLE == 'anon':
        print('\nRemediation steps:')
        print('  1. Open Supabase Dashboard → Project Settings → API.')
        print("  2. Under 'Project API Keys' copy the Service Role key (long JWT).")
        print('  3. Put it into apps/api/.env as SUPABASE_KEY=... (no quotes).')
        print('  4. Restart any running shells so environment reloads.')
        print('  5. Re-run: python env_check.py then python seed_supabase.py ...')
        if JWT_ROLE == 'anon':
            print('\nDetected anon key: you cannot call admin endpoints with it. Replace with service_role key.')
    else:
        # Attempt a parse of user list (optional)
        try:
            data = r2.json()
            count = len(data.get('users', [])) if isinstance(data, dict) else len(data) if isinstance(data, list) else 0
            print(f"Service role confirmed. Users returned: {count}")
        except Exception:
            print('Service role confirmed, but could not parse user list JSON.')

    print('\nDone.')


if __name__ == '__main__':
    main()
