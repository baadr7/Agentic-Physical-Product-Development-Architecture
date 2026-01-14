import os, base64, json
token = os.environ.get("SUPABASE_SERVICE_ROLE_KEY","")
def b64url_decode(s):
    s = s + "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s.encode())
try:
    header, payload, sig = token.split(".")
    data = json.loads(b64url_decode(payload))
    print(json.dumps(data, indent=2))
except Exception as e:
    print("decode error:", e)
