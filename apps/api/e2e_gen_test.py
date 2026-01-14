import os
import time
import json
import base64
import argparse
from urllib.parse import urljoin
import requests

parser = argparse.ArgumentParser()
parser.add_argument('--base-url', dest='base_url', default=None)
args, _unknown = parser.parse_known_args()

BASE = args.base_url or os.environ.get('API_BASE', 'http://127.0.0.1:3001')
print('Using API base:', BASE)

def post(path, payload):
    url = urljoin(BASE, path)
    r = requests.post(url, json=payload, timeout=300)
    r.raise_for_status()
    return r.json()

def get(path):
    url = urljoin(BASE, path)
    r = requests.get(url, timeout=300)
    r.raise_for_status()
    return r.json()

# 1) create project
print('Creating project...')
proj = post('/api/v1/projects', {'title': 'e2e-test-project', 'description': 'e2e test'})
print('Project:', proj)
project_id = proj.get('id') or proj.get('project_id') or proj.get('id')
if not project_id:
    project_id = proj.get('id')

# 2) create run
print('Creating run...')
run_payload = {
    'project_id': project_id,
    'input_mode': 'text',
    'description': 'e2e run',
    'options': {'guidance_scale': 7.5, 'steps': 20}
}
run = post('/api/v1/runs', run_payload)
print('Run:', run)
run_id = run.get('run_id') or run.get('id') or run.get('run_id')
if not run_id:
    raise SystemExit('No run_id in response')

# 3) trigger generation
print('Triggering generation...')
gen_payload = {
    'count': 1,
    'options': {'guidance_scale': 7.5, 'steps': 20},
}
resp = post(f'/api/v1/runs/{run_id}/generate-variants', gen_payload)
print('Generate response:', resp)

# 4) poll for variants
print('Polling for variants (30s timeout)...')
variants = []
start = time.time()
while time.time() - start < 30:
    try:
        variants = get(f'/api/v1/runs/{run_id}/variants')
        if isinstance(variants, list) and len(variants) > 0:
            break
    except Exception as e:
        # ignore and retry
        pass
    time.sleep(1)

if not variants:
    print('No variants found after timeout; exiting')
    raise SystemExit(2)

print('Variants:', json.dumps(variants, indent=2)[:1000])

# 5) inspect first variant image_url
v = variants[0]
image_url = v.get('image_url') or v.get('thumbnail_url')
print('Image URL:', image_url)

if not image_url:
    print('No image URL found in variant')
    raise SystemExit(3)

# 6) fetch image
print('Fetching image...')
try:
    if image_url.startswith('data:'):
        # Decode data URI locally
        print('Image URL is a data: URI; decoding locally')
        header, b64 = image_url.split(',', 1)
        data = base64.b64decode(b64)
        fname = f"./e2e_{run_id}_variant.png"
        with open(fname, 'wb') as f:
            f.write(data)
        print('Saved image to', fname)
        print('SUCCESS: decoded data: URI to file')
    else:
        r = requests.get(image_url, timeout=30)
        print('Image HTTP status:', r.status_code)
        content_type = r.headers.get('content-type','')
        print('Content-Type:', content_type)
        if r.status_code == 200 and 'image' in content_type:
            fname = f"./e2e_{run_id}_variant.png"
            with open(fname, 'wb') as f:
                f.write(r.content)
            print('Saved image to', fname)
            print('SUCCESS: generated image seems real (HTTP 200 and image content)')
        else:
            print('Image fetch failed or non-image response')
except Exception as e:
    print('Failed to fetch image URL:', e)
    raise
