from fastapi.testclient import TestClient
from main import app
import base64

client = TestClient(app)


def test_diffusion_stub_returns_image():
    payload = {
        "prompt": "test stub chair",
        "steps": 4,
        "upscale": False
    }
    resp = client.post('/api/v1/diffusion/generate', json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data.get('ok') is True
    image_b64 = data.get('image_b64')
    assert image_b64 is not None
    # Validate it's base64 and decodable
    try:
        img = base64.b64decode(image_b64)
        assert len(img) > 0
    except Exception:
        assert False, 'image_b64 was not valid base64' 
