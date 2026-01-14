import json
import sys
import os
from pathlib import Path
from fastapi.testclient import TestClient
from base64 import b64encode
import types
import pytest

# Ensure apps/api is on sys.path so tests can import main reliably
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

@pytest.fixture(autouse=True)
def _stub_diffusion_pipeline(monkeypatch):
    """Stub diffusion_pipeline only for this test module.

    This avoids importing heavy ML deps when tests import `main`, without
    polluting other test modules that need the real diffusion pipeline.
    """
    stub = types.ModuleType('diffusion_pipeline')
    # Match the shape expected by code paths: include backend and non-empty b64.
    stub.diffusion_generator = types.SimpleNamespace(
        generate=lambda *a, **k: {
            'image_b64': b64encode(b'\x89PNG\r\n\x1a\nTESTPNG').decode('utf-8'),
            'backend': 'stub',
            'controlnet': False,
        }
    )
    monkeypatch.setitem(sys.modules, 'diffusion_pipeline', stub)
    yield


def test_normalize_brief(monkeypatch):
    # Ensure HF key present so mistral uses _hf_inference path
    monkeypatch.setenv('HUGGINGFACE_API_KEY', 'testkey')

    # Import app after setting env
    import main
    # Patch the requests.post used inside our code (patch on main.requests)
    def fake_post(url, json=None, headers=None, timeout=None):
        class Resp:
            def raise_for_status(self):
                return None
            def json(self):
                # Simulate HF returning a generated_text field
                return {"generated_text": '{"material":"PLA","dimensions":{"width_mm":60,"height_mm":30},"dfx_aspects":["flexibility"]}'}
        return Resp()

    monkeypatch.setattr(main.requests, 'post', fake_post)

    client = TestClient(main.app)

    resp = client.post('/api/v1/llm/normalize-brief', json={'text': 'Small PLA stand, ~6cm wide'})
    assert resp.status_code == 200
    body = resp.json()
    assert body.get('ok') is True
    assert 'data' in body
    data = body['data']
    assert isinstance(data, dict)
    assert (
        ('constraints' in data and isinstance(data.get('constraints'), dict))
        or ('material' in data)
    )


def test_diffusion_generate_returns_image_and_persistence(monkeypatch):
    # Mock diffusion_generator.generate to return a known base64 PNG
    png_bytes = b'\x89PNG\r\n\x1a\nTESTPNG'
    img_b64 = b64encode(png_bytes).decode('utf-8')

    import main

    # Replace diffusion_generator with a simple stub object
    class StubGen:
        def generate(self, *args, **kwargs):
            return {'image_b64': img_b64, 'backend': 'stub'}

    monkeypatch.setattr(main, 'diffusion_generator', StubGen())

    # Ensure Supabase envs are set so code takes the supabase branch
    monkeypatch.setenv('SUPABASE_URL', 'https://supabase.test')
    monkeypatch.setenv('SUPABASE_KEY', 'testkey')

    # Mock upload and variant persist helpers to simulate successful persistence
    def fake_upload(image_b64_arg, dest_path):
        return f"https://supabase.test/storage/v1/object/public/prototype_gen/{dest_path}"

    def fake_persist(payload):
        return payload

    monkeypatch.setattr(main, '_upload_image_to_supabase', fake_upload)
    monkeypatch.setattr(main, '_persist_variant_supabase', fake_persist)

    # Also patch requests.post/patch used when recording variant assets or patching variants
    class FakeResp:
        ok = True
        def json(self):
            return []

    def fake_requests_post(*args, **kwargs):
        return FakeResp()

    def fake_requests_patch(*args, **kwargs):
        return FakeResp()

    monkeypatch.setattr(main.requests, 'post', fake_requests_post)
    monkeypatch.setattr(main.requests, 'patch', fake_requests_patch)

    client = TestClient(main.app)

    # JSON response fallback
    resp = client.post('/api/v1/diffusion/generate', json={'prompt':'x','width':64,'height':64})
    assert resp.status_code == 200
    body = resp.json()
    assert body.get('image_b64') == img_b64

    # Binary response when Accept: image/png (persistence headers expected)
    resp2 = client.post('/api/v1/diffusion/generate', json={'prompt':'x','width':64,'height':64,'run_id':'r1','variant_id':'v1'}, headers={'Accept': 'image/png'})
    assert resp2.status_code == 200
    assert resp2.headers.get('content-type', '').startswith('image/')
    assert resp2.headers.get('X-Persisted') in ('0','1')


def test_diffusion_persist_failure_and_no_variant_asset_call(monkeypatch):
    """When upload fails (returns None) and Supabase env is set, generation still
    succeeds and no variant_assets POST is attempted."""
    png_bytes = b'\x89PNG\r\n\x1a\nTESTPNG'
    img_b64 = b64encode(png_bytes).decode('utf-8')

    import main

    class StubGen2:
        def generate(self, *args, **kwargs):
            return {'image_b64': img_b64, 'backend': 'stub'}

    monkeypatch.setattr(main, 'diffusion_generator', StubGen2())
    monkeypatch.setenv('SUPABASE_URL', 'https://supabase.test')
    monkeypatch.setenv('SUPABASE_KEY', 'testkey')

    # Simulate upload failing (returns None)
    monkeypatch.setattr(main, '_upload_image_to_supabase', lambda a, b: None)

    calls = []
    def fake_post_record(*args, **kwargs):
        calls.append((args, kwargs))
        class R: ok = True
        def json(self): return []
        return R()

    monkeypatch.setattr(main.requests, 'post', fake_post_record)

    client = TestClient(main.app)
    resp = client.post('/api/v1/diffusion/generate', json={'prompt':'x','width':64,'height':64,'run_id':'r1','variant_id':'v1'}, headers={'Accept':'image/png'})
    assert resp.status_code == 200
    # upload failed -> X-Persisted should be '0'
    assert resp.headers.get('X-Persisted') == '0'
    # variant_assets POST should NOT have been called (calls list empty or only other posts)
    assert all('/variant_assets' not in (a[0][0] if a and a[0] else '') for a in calls)


def test_variant_asset_recording_posts_to_variant_assets(monkeypatch):
    png_bytes = b'\x89PNG\r\n\x1a\nTESTPNG'
    img_b64 = b64encode(png_bytes).decode('utf-8')

    import main
    class StubGen3:
        def generate(self, *args, **kwargs):
            return {'image_b64': img_b64, 'backend': 'stub'}

    monkeypatch.setattr(main, 'diffusion_generator', StubGen3())
    monkeypatch.setenv('SUPABASE_URL', 'https://supabase.test')
    monkeypatch.setenv('SUPABASE_KEY', 'testkey')

    # Simulate successful upload returning a public URL
    def fake_upload_return(image_b64_arg, dest_path):
        return f"https://supabase.test/storage/v1/object/public/prototype_gen/{dest_path}"
    monkeypatch.setattr(main, '_upload_image_to_supabase', fake_upload_return)

    posted = []
    def fake_post_capture(url, headers=None, json=None, timeout=None, data=None):
        posted.append(url)
        class R: ok = True
        def json(self): return []
        return R()

    monkeypatch.setattr(main.requests, 'post', fake_post_capture)

    client = TestClient(main.app)
    resp = client.post('/api/v1/diffusion/generate', json={'prompt':'x','width':64,'height':64,'run_id':'runner123','variant_id':'var123'}, headers={'Accept':'image/png'})
    assert resp.status_code == 200
    # Check that one of the posted URLs targets variant_assets
    assert any('/variant_assets' in u for u in posted)


def test_generate_variants_can_return_inline_image_b64(monkeypatch):
    """When requested, /generate-variants includes raw base64 image bytes in the response."""
    png_bytes = b'\x89PNG\r\n\x1a\nTESTPNG'
    img_b64 = b64encode(png_bytes).decode('utf-8')

    import main

    class StubGen:
        def generate(self, *args, **kwargs):
            return {'image_b64': img_b64, 'backend': 'stub'}

    monkeypatch.setattr(main, 'diffusion_generator', StubGen())
    monkeypatch.setattr(main, '_upload_image_to_supabase', lambda a, b: 'https://example.com/image.png')

    # Ensure a run exists in-memory
    main.RUNS.clear()
    main.VARIANTS.clear()
    main.RUNS.append({'run_id': 'run-inline-1', 'description': 'test run'})

    client = TestClient(main.app)
    resp = client.post(
        '/api/v1/runs/run-inline-1/generate-variants',
        json={'count': 1, 'width': 64, 'height': 64, 'include_image_b64': True},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body.get('ok') is True
    variants = body.get('variants')
    assert isinstance(variants, list) and len(variants) == 1
    v0 = variants[0]
    assert v0.get('image_b64') == img_b64
    assert v0.get('thumbnail_b64') == img_b64

