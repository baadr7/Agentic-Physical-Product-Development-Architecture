import requests
url='http://127.0.0.1:8001/api/v1/diffusion/generate'
payload={'prompt':'photorealistic mouse, hyperrealistic, studio lighting','width':1080,'height':1080,'steps':28}
headers={'Accept':'image/png'}
print('POST', url)
try:
    r=requests.post(url,json=payload,headers=headers,timeout=900)
    print('status', r.status_code, 'content-type', r.headers.get('Content-Type'))
    open('out_debug_8001_1080.png','wb').write(r.content)
    print('Saved out_debug_8001_1080.png', len(r.content), 'bytes')
except Exception as e:
    print('Request failed:', e)
