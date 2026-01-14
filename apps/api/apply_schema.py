#!/usr/bin/env python3
"""Schema helper for Supabase.

This script does NOT execute SQL directly (Supabase blocks arbitrary SQL over REST).
Instead it:
  1. Verifies connectivity with your service role key.
  2. Checks for existence of core tables (projects, runs, variants).
  3. If missing, prints concise instructions to apply migration file
   `supabase/migrations/001_create_schema.sql` via the Supabase SQL Editor.

Usage:
  python apply_schema.py

Environment:
  SUPABASE_URL=https://<ref>.supabase.co
  SUPABASE_KEY=<service_role_key>
"""
import os
import sys
import requests
import base64
import json


def _load_local_env():
    """Load apps/api/.env into os.environ for common SUPABASE_* keys if present."""
    try:
        env_path = os.path.join(os.path.dirname(__file__), '.env')
        if os.path.exists(env_path):
            with open(env_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith('#'):
                        continue
                    if '=' in line:
                        k, v = line.split('=', 1)
                        v = v.strip()
                        # Common .env quoting patterns; safe for JWTs/URLs.
                        if (v.startswith('"') and v.endswith('"')) or (v.startswith("'") and v.endswith("'")):
                            v = v[1:-1]
                        if k in ('SUPABASE_URL', 'SUPABASE_KEY', 'SUPABASE_SERVICE_ROLE_KEY'):
                            os.environ[k] = v
                        elif k not in os.environ:
                            os.environ[k] = v
    except Exception:
        return


def get_supabase_env():
    """Return (SUPABASE_URL, SUPABASE_KEY, headers) reading current environment and .env file."""
    _load_local_env()
    SUPABASE_URL = os.getenv('SUPABASE_URL')
    # Prefer service role for server-side schema checks.
    key_source = 'SUPABASE_SERVICE_ROLE_KEY' if os.getenv('SUPABASE_SERVICE_ROLE_KEY') else 'SUPABASE_KEY'
    SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('SUPABASE_KEY')
    if not SUPABASE_URL or not SUPABASE_KEY:
        return None, None, None
    headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json',
    }
    return SUPABASE_URL, SUPABASE_KEY, {**headers, '_key_source': key_source}


def _decode_jwt_payload_unverified(token: str):
    """Best-effort decode of JWT payload without verifying signature.

    Returns a dict or None. Does not log or return the raw token.
    """
    try:
        parts = token.split('.')
        if len(parts) < 2:
            return None
        payload_b64 = parts[1]
        # base64url padding
        payload_b64 += '=' * (-len(payload_b64) % 4)
        data = base64.urlsafe_b64decode(payload_b64.encode('utf-8'))
        obj = json.loads(data.decode('utf-8'))
        return obj if isinstance(obj, dict) else None
    except Exception:
        return None


def _describe_key_for_debug(token: str) -> str:
    """Return a short, non-sensitive description of the Supabase API key."""
    payload = _decode_jwt_payload_unverified(token)
    parts = token.split('.')
    jwt_shape = f"jwt_parts={len(parts)}"
    if not payload:
        return f'unrecognized-key-format ({jwt_shape})'
    # Supabase keys typically include: ref, role, iss
    ref = payload.get('ref')
    # Some bad copies have typos (e.g. 'rose' or 'ros'); note that any manual edits
    # to a JWT will invalidate its signature and Supabase will reject it.
    role = payload.get('role') or payload.get('ros') or payload.get('rose')
    iss = payload.get('iss')
    exp = payload.get('exp')
    iat = payload.get('iat')
    suffix = ''
    if 'role' not in payload and ('rose' in payload or 'ros' in payload):
        suffix = ' [ERROR: key payload looks edited/corrupted — replace it from Supabase dashboard]'
    if role not in ('anon', 'service_role'):
        # Keep the stronger message if we already detected corruption.
        if 'ERROR:' not in suffix:
            suffix = ' [warn: unexpected role claim]'
    return f"iss={iss!s} ref={ref!s} role={role!s} iat={iat!s} exp={exp!s} {jwt_shape}{suffix}"


def _project_ref_from_url(url_base: str) -> str | None:
    try:
        # https://<ref>.supabase.co
        host = url_base.split('://', 1)[1].split('/', 1)[0]
        ref = host.split('.', 1)[0]
        return ref or None
    except Exception:
        return None

def connectivity_check():
    url_base, key, headers = get_supabase_env()
    if not url_base or not headers:
        print('ERROR: SUPABASE_URL or SUPABASE_KEY missing. Create apps/api/.env with the required keys.')
        return False
    # Safe diagnostics to debug the very common "Invalid API key" issue.
    key_source = headers.pop('_key_source', 'SUPABASE_KEY') if isinstance(headers, dict) else 'SUPABASE_KEY'
    if key:
        desc = _describe_key_for_debug(key)
        print(f'Using key from: {key_source} ({desc})')
        payload = _decode_jwt_payload_unverified(key)
        url_ref = _project_ref_from_url(url_base)
        if payload and url_ref and payload.get('ref') and payload.get('ref') != url_ref:
            print(f'[warn] Key ref does not match SUPABASE_URL ref (key={payload.get("ref")!s} url={url_ref!s}).')
        if payload and 'role' not in payload and ('rose' in payload or 'ros' in payload):
            print('[ERROR] Supabase key payload has a typo in the role claim (e.g. rose/ros).')
            print('        This means the JWT was edited/corrupted; Supabase will reject it as an invalid API key (401).')
            print('        Fix: Supabase Dashboard → Project Settings → API → copy the `service_role` key again (no edits).')
    try:
        r = requests.get(f'{url_base}/rest/v1/', headers=headers, timeout=8)
        print(f'Connectivity status: {r.status_code}')
        if r.status_code not in (200, 400):
            print(f'Unexpected response: {r.text[:200]}')
        return True
    except Exception as e:
        print('Connection failed:', e)
        return False

def table_exists(table: str) -> bool:
    url_base, _, headers = get_supabase_env()
    if not url_base or not headers:
        print('ERROR: SUPABASE_URL or SUPABASE_KEY missing. Create apps/api/.env with the required keys.')
        return False
    url = f'{url_base}/rest/v1/{table}?select=id&limit=1'
    r = requests.get(url, headers=headers, timeout=8)
    if r.status_code == 200:
        return True
    # Supabase returns 400 with JSON error when relation missing
    if r.status_code == 400 and 'does not exist' in r.text:
        return False
    # Other errors we treat as unknown (print for diagnostics)
    print(f'[warn] Table check for {table} status={r.status_code} body={r.text[:160]}')
    return False

def main():
    url_base, key, headers = get_supabase_env()
    if not url_base or not headers:
        print('ERROR: SUPABASE_URL or SUPABASE_KEY missing. Create apps/api/.env with:')
        print('  SUPABASE_URL=https://<project-ref>.supabase.co')
        print('  SUPABASE_KEY=<service_role_key>  # NOT the anon key')
        print('You can copy the template from apps/api/.env.example')
        sys.exit(1)

    # Basic placeholder validation
    if '<' in url_base or '>' in url_base:
        print('ERROR: SUPABASE_URL still contains a placeholder. Example: https://abcd1234.supabase.co')
        sys.exit(1)

    print(f'Checking Supabase at {url_base} ...')
    if not connectivity_check():
        sys.exit(1)

    missing = []
    for tbl in ('projects', 'runs', 'variants'):
        if not table_exists(tbl):
            missing.append(tbl)

    if not missing:
        print('✓ Core tables exist (projects, runs, variants). Schema likely applied.')
        print('You can proceed to run seed_supabase.py to insert demo data.')
        return

    print('Schema appears incomplete. Missing tables:', ', '.join(missing))
    print('\nTo apply the schema:')
    print('  1. Open Supabase dashboard > SQL Editor')
    print('  2. Paste contents of supabase/migrations/001_create_schema.sql')
    print('  3. Run the script, confirm creation + RLS policies')
    print('  4. Re-run: python apply_schema.py (should show tables exist)')
    print('\nTip: Commit migration after running via dashboard so it stays in version control.')


if __name__ == '__main__':
    main()
