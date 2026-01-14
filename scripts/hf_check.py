import os, requests
# Read .env
env_path = os.path.join(os.path.dirname(__file__), '..', 'apps', 'api', '.env')
vals = {}
with open(env_path, 'r', encoding='utf-8') as f:
    for line in f:
        line=line.strip()
        if not line or line.startswith('#') or '=' not in line: continue
        k,v=line.split('=',1)
        vals[k.strip()]=v.strip()
api_key = vals.get('HUGGINGFACE_API_KEY')
model = vals.get('HF_IMAGE_MODEL') or 'stabilityai/stable-diffusion-2-1'
hf_base = vals.get('HUGGINGFACE_API_BASE') or 'https://api-inference.huggingface.co'
print('HF model:', model)
print('HF base:', hf_base)
print('Have API key:', bool(api_key))
if not api_key:
    print('No key, aborting')
else:
    headers = {'Authorization': f'Bearer {api_key}', 'Accept':'application/octet-stream'}
    payload = {'inputs': 'photorealistic mouse', 'parameters': {'width':512,'height':512}, 'options':{'wait_for_model':True}}
    # Try several candidate public models to see which (if any) the key can call via router
    candidates = [
        model,
        'runwayml/stable-diffusion-v1-5',
        'CompVis/stable-diffusion-v-1-4-original',
        'stabilityai/stable-diffusion-xl-base-1-0',
        'stabilityai/stable-diffusion-2-1',
        'stabilityai/stable-diffusion-2',
        'stabilityai/stable-diffusion-xl-1-0',
        'dreamlike-art/dreamlike-photoreal-2.0',
        'prompthero/openjourney',
        'andite/anything-v4.0',
        'hakurei/waifu-diffusion'
    ]
    for m in candidates:
        url = f"{hf_base.rstrip('/')}/models/{m}"
        try:
            r = requests.post(url, json=payload, headers=headers, timeout=60)
            print('\n== Model:', m)
            print('URL:', url)
            print('Status:', r.status_code)
            ctype = r.headers.get('Content-Type') or ''
            print('Content-Type:', ctype)
            print('Content-Length:', len(r.content))
            # show short response/body hints
            body_head = r.content[:200]
            try:
                print('First bytes:', body_head)
            except Exception:
                pass
            if r.status_code != 200:
                try:
                    print('Response text:', r.text)
                except Exception:
                    pass
        except Exception as e:
            print('\n== Model:', m)
            print('Request error:', e)
