import base64
try:
    from apps.api.diffusion_pipeline import diffusion_generator
except Exception:
    from diffusion_pipeline import diffusion_generator


def make_simple_sketch_b64():
    from PIL import Image, ImageDraw
    import io
    img = Image.new('L', (64, 64), color=0)
    d = ImageDraw.Draw(img)
    d.line((0, 0, 63, 63), fill=255, width=2)
    d.line((0, 63, 63, 0), fill=255, width=2)
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return base64.b64encode(buf.getvalue()).decode()


def test_controlnet_mock_generates_image():
    # Enable mock controlnet path
    import os
    os.environ['CONTROLNET_MOCK'] = '1'
    sketch = make_simple_sketch_b64()
    out = diffusion_generator.generate(prompt='test sketch', sketch_b64=sketch, controlnet=True, steps=4, width=128, height=128)
    assert isinstance(out, dict)
    assert 'image_b64' in out and out['image_b64'] is not None
    assert out.get('controlnet') is True


if __name__ == '__main__':
    test_controlnet_mock_generates_image()
    print('ok')
