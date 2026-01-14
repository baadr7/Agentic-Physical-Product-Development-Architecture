from fastapi.testclient import TestClient
import sys, os
# Ensure apps/api is on sys.path so `import main` resolves like tests do
API_PATH = os.path.dirname(os.path.dirname(__file__))
if API_PATH not in sys.path:
	sys.path.insert(0, API_PATH)
import main

print('VARIANTS before append:', len(main.VARIANTS))
vid = 'var-cadtest'
main.VARIANTS.append({'id': vid, 'run_id': 'run-test', 'metrics': {'scores': {'overall_score':1}}})
print('VARIANTS after append:', len(main.VARIANTS))

client = TestClient(main.app)
resp = client.post(f'/api/v1/variants/{vid}/cad/export')
print('Response status:', resp.status_code)
print('Response body:', resp.text)

# Also print first few VARIANTS inside handler by calling a helper route if exists
