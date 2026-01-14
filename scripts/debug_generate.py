import requests, sys, base64, os

API = os.environ.get('API_BASE', 'http://127.0.0.1:8000')
url = f"{API}/api/v1/diffusion/generate"
prompt = ' '.join(sys.argv[1:]) if len(sys.argv) > 1 else 'photorealistic mouse, hyperrealistic, studio lighting, 1080x1080'
payload = {'prompt': prompt, 'width': 1080, 'height': 1080}
headers = {'Accept': 'image/png'}
print(f"POST {url} with prompt: {prompt[:120]}")
try:
    r = requests.post(url, json=payload, headers=headers, timeout=180)
    print('Status:', r.status_code)
    print('Content-Type:', r.headers.get('Content-Type'))
    print('X-Persisted:', r.headers.get('X-Persisted'))
    print('X-Public-Url:', r.headers.get('X-Public-Url'))
    data = r.content
    out = 'out_debug.png'
    with open(out, 'wb') as f:
        f.write(data)
    print(f'Saved response to {out} ({len(data)} bytes)')
    if data[:8] == b'\x89PNG\r\n\x1a\n':
        print('Looks like a PNG file (magic header OK)')
    else:
        print('Not a PNG (first bytes):', data[:32])
except Exception as e:
    print('Request failed:', e)
    sys.exit(1)
