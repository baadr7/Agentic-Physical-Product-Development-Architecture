"""Seed Supabase with a demo auth user, project, and run.

Usage:
  python seed_supabase.py [email] [password]

Environment variables required (taken from .env in this folder):
  SUPABASE_URL=https://<ref>.supabase.co
  SUPABASE_KEY=<service_role_key>

This script will:
  1. Ensure a demo user exists (creates if missing).
  2. Insert a demo project owned by that user.
  3. Insert a demo run linked to the project.
  4. Print JSON summary you can copy to configure the web app.

Safe to re-run: it will detect existing user/project/run by deterministic identifiers.
"""
from __future__ import annotations
import os, sys, json, requests, uuid, base64
from typing import Optional, Tuple

API_ENV_PATH = os.path.join(os.path.dirname(__file__), '.env')

def load_env_file(path: str):
    if not os.path.exists(path):
        return
    with open(path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            if '=' in line:
                k, v = line.split('=', 1)
                # Strip inline comments after value (e.g. KEY=token # comment)
                if '#' in v:
                    v = v.split('#', 1)[0].rstrip()
                if k and v is not None:
                    # Always override for Supabase keys to avoid stale shell values
                    if k in ('SUPABASE_URL', 'SUPABASE_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY'):
                        os.environ[k] = v
                    elif k not in os.environ:
                        os.environ[k] = v

def _jwt_role(token: str | None):
    if not token or token.count('.') < 2:
        return None
    try:
        seg = token.split('.')[1]
        pad = '=' * (-len(seg) % 4)
        decoded = base64.urlsafe_b64decode(seg + pad)
        data = json.loads(decoded.decode('utf-8'))
        return data.get('role') or data.get('roles')
    except Exception:
        return None

def get_session_and_headers() -> Tuple[requests.Session, dict]:
    load_env_file(API_ENV_PATH)

    SUPABASE_URL = os.getenv('SUPABASE_URL')
    RAW_SUPABASE_KEY = os.getenv('SUPABASE_KEY')
    SERVICE_ROLE_ALT = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

    role_primary = _jwt_role(RAW_SUPABASE_KEY)
    role_alt = _jwt_role(SERVICE_ROLE_ALT)

    # Choose key: prefer one with role service_role; otherwise keep primary.
    if role_primary != 'service_role' and role_alt == 'service_role':
        SUPABASE_KEY = SERVICE_ROLE_ALT
    else:
        SUPABASE_KEY = RAW_SUPABASE_KEY or SERVICE_ROLE_ALT

    if role_primary and role_primary != 'service_role':
        print(f"[warn] SUPABASE_KEY appears to be role={role_primary}; looking for service_role.")
    if role_alt and role_alt == 'service_role' and role_primary != 'service_role':
        print('[info] Using SUPABASE_SERVICE_ROLE_KEY instead of provided SUPABASE_KEY.')

    # Validate SUPABASE_URL not left with placeholder
    if SUPABASE_URL and ('<ref>' in SUPABASE_URL or '<your-ref>' in SUPABASE_URL or '<' in SUPABASE_URL or '>' in SUPABASE_URL):
        print('ERROR: SUPABASE_URL contains a placeholder. Replace <ref>/\u003cyour-ref\u003e with your project ref (e.g. https://abcd1234.supabase.co).')
        raise SystemExit(1)

    if not SUPABASE_URL or not SUPABASE_KEY:
        print('ERROR: SUPABASE_URL or SUPABASE_KEY missing. Set them in apps/api/.env')
        print(f"Diagnostics: primary_len={len(RAW_SUPABASE_KEY or '')} alt_len={len(SERVICE_ROLE_ALT or '')} role_primary={role_primary} role_alt={role_alt}")
        raise SystemExit(1)

    session = requests.Session()
    common_headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    }
    return session, common_headers

def get_user_by_email(session: requests.Session, common_headers: dict, email: str) -> Optional[dict]:
    # Supabase auth admin list users does not support direct email filter; fetch all and search (limited to first page)
    url = f"{os.getenv('SUPABASE_URL')}/auth/v1/admin/users?per_page=100"
    r = session.get(url, headers=common_headers)
    print(f"[debug] list users status={r.status_code}")
    if r.status_code == 401:
        key_used = (common_headers.get('Authorization') or '')
        key_hint = f"length={len(key_used)} startswith={key_used[:6]}" if key_used else 'no key loaded'
        raise RuntimeError(
            "Invalid or insufficient API key (401). Seeding requires the SERVICE ROLE key.\n"
            f"Loaded key diagnostic: {key_hint}.\n"
            "Steps:\n"
            "  1. In Supabase Dashboard: Project Settings > API.\n"
            "  2. Copy the 'service_role' key (NOT the anon public key).\n"
            "  3. Put it in apps/api/.env as SUPABASE_KEY=... (no quotes).\n"
            "  4. Ensure SUPABASE_URL=https://<project-ref>.supabase.co is set.\n"
            "  5. Re-run: python seed_supabase.py dev@example.com DevPass123!\n"
        )
    if not r.ok:
        raise RuntimeError(f"List users failed {r.status_code} {r.text}")
    data = r.json()
    for u in data.get('users', []) if isinstance(data, dict) else data:
        if (u.get('email') or '').lower() == email.lower():
            return u
    return None

def create_user(session: requests.Session, common_headers: dict, email: str, password: str) -> dict:
    url = f"{os.getenv('SUPABASE_URL')}/auth/v1/admin/users"
    payload = {'email': email, 'password': password, 'email_confirm': True}
    r = session.post(url, headers=common_headers, json=payload)
    print(f"[debug] create user status={r.status_code}")
    if not r.ok:
        raise RuntimeError(f"Create user failed {r.status_code} {r.text}")
    return r.json()

def upsert_project(session: requests.Session, common_headers: dict, user_id: str) -> dict:
    # Deterministic title so we avoid duplicates
    title = 'Demo Project'
    # Query existing project
    query_url = f"{os.getenv('SUPABASE_URL')}/rest/v1/projects?user_id=eq.{user_id}&title=eq.{requests.utils.quote(title)}&select=*"
    qr = session.get(query_url, headers=common_headers)
    if qr.ok and isinstance(qr.json(), list) and qr.json():
        return qr.json()[0]
    insert_url = f"{os.getenv('SUPABASE_URL')}/rest/v1/projects"
    headers = dict(common_headers)
    headers['Prefer'] = 'return=representation'
    payload = {
        'user_id': user_id,
        'title': title,
        'description': 'Projet de démonstration semé automatiquement.',
        'product_type': 'mechanical',
        'brief': 'Créer un support simple imprimable en 3D.',
        'materials': ['PLA'],
        'constraints': {'max_size_cm': 10},
    }
    ir = session.post(insert_url, headers=headers, json=payload)
    if not ir.ok:
        raise RuntimeError(f"Insert project failed {ir.status_code} {ir.text}")
    rows = ir.json()
    return rows[0] if isinstance(rows, list) and rows else rows

def upsert_run(session: requests.Session, common_headers: dict, project_id: str) -> dict:
    # Query for existing seeded run by brief description
    run_list_url = f"{os.getenv('SUPABASE_URL')}/rest/v1/runs?project_id=eq.{project_id}&select=*"
    lr = session.get(run_list_url, headers=common_headers)
    if lr.ok:
        for rrow in lr.json() if isinstance(lr.json(), list) else []:
            if (rrow.get('metadata') or {}).get('seed_tag') == 'initial-demo':
                return rrow
    insert_url = f"{os.getenv('SUPABASE_URL')}/rest/v1/runs"
    headers = dict(common_headers); headers['Prefer'] = 'return=representation'
    run_id = f"run-seed-{uuid.uuid4().hex[:8]}"
    payload = {
        'run_id': run_id,
        'project_id': project_id,
        'status': 'pending',
        'parameters': {'size_cm': 5},
        'metadata': {'seed_tag': 'initial-demo'},
    }
    ir = session.post(insert_url, headers=headers, json=payload)
    if not ir.ok:
        raise RuntimeError(f"Insert run failed {ir.status_code} {ir.text}")
    rows = ir.json()
    return rows[0] if isinstance(rows, list) and rows else rows

def main():
    EMAIL = sys.argv[1] if len(sys.argv) > 1 else 'dev@example.com'
    PASSWORD = sys.argv[2] if len(sys.argv) > 2 else 'DevPass123!'

    session, headers = get_session_and_headers()
    try:
        user = get_user_by_email(session, headers, EMAIL)
        if not user:
            user = create_user(session, headers, EMAIL, PASSWORD)
            print(f"Created user {EMAIL}")
        else:
            print(f"User {EMAIL} already exists")
        user_id = user.get('id') or user.get('user', {}).get('id')
        if not user_id:
            raise RuntimeError('Could not determine user id from response')
        project = upsert_project(session, headers, user_id)
        print(f"Project id: {project.get('id')}")
        run = upsert_run(session, headers, project.get('id'))
        summary = {
            'user': {'id': user_id, 'email': EMAIL},
            'project': {'id': project.get('id'), 'title': project.get('title')},
            'run': {'id': run.get('id'), 'run_id': run.get('run_id'), 'status': run.get('status')},
        }
        print('\nJSON Summary:\n' + json.dumps(summary, indent=2, ensure_ascii=False))
        print('\nNext steps: Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in apps/web/.env.local then set NEXT_PUBLIC_DISABLE_AUTH=false and restart pnpm dev.')
    except Exception as e:
        print('Seed failed:', e)
        sys.exit(1)


if __name__ == '__main__':
    main()
