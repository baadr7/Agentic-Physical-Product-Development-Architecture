import os
import requests


def mask(s: str | None) -> str:
    if not s:
        return '<missing>'
    if len(s) <= 12:
        return s[:4] + '...' + s[-4:]
    return s[:6] + '...' + s[-6:]


def main():
    # If running from a shell that doesn't load .env, attempt to read apps/api/.env.local
    env_path = os.path.join(os.path.dirname(__file__), '.env.local')
    if os.path.exists(env_path):
        try:
            with open(env_path, 'r', encoding='utf-8') as f:
                for ln in f:
                    ln = ln.strip()
                    if not ln or ln.startswith('#') or '=' not in ln:
                        continue
                    k, v = ln.split('=', 1)
                    k = k.strip()
                    v = v.strip().strip('\"').strip("\'")
                    if k not in os.environ:
                        os.environ[k] = v
        except Exception:
            pass

    url = os.getenv('SUPABASE_URL')
    key = os.getenv('SUPABASE_KEY')
    print('SUPABASE_URL:', url or '<missing>')
    print('SUPABASE_KEY present:', 'yes' if key else 'no', 'masked=', mask(key))

    if not url or not key:
        print('Missing SUPABASE_URL or SUPABASE_KEY; aborting auth test')
        return

    ep = url.rstrip('/') + '/rest/v1/runs?select=*&limit=1'
    headers = {
        'apikey': key,
        'Authorization': f'Bearer {key}',
        'Accept': 'application/json',
    }
    try:
        r = requests.get(ep, headers=headers, timeout=10)
        print('HTTP', r.status_code)
        try:
            print('JSON keys:', list(r.json()[:1] if isinstance(r.json(), list) else [r.json()]) )
        except Exception:
            text = r.text or ''
            print('Response text (truncated):', text[:500])
    except Exception as e:
        print('Request failed:', e)


if __name__ == '__main__':
    main()
