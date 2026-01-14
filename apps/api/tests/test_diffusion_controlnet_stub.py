import base64
import io
import sys
import os

# Ensure local imports work
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

try:
    from diffusion_pipeline import diffusion_generator
except Exception:
    from apps.api.diffusion_pipeline import diffusion_generator

from PIL import Image


def make_simple_sketch_b64():
    img = Image.new('L', (256, 256), color=255)
    # draw a diagonal line
    for i in range(50, 200):
        img.putpixel((i, i), 0)
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return base64.b64encode(buf.getvalue()).decode()


def test_controlnet_generate_returns_image_b64():
    sketch_b64 = make_simple_sketch_b64()
    res = diffusion_generator.generate(prompt='test prompt', sketch_b64=sketch_b64, controlnet=True, steps=4, width=128, height=128)
    assert isinstance(res, dict)
    assert 'image_b64' in res
    assert res['image_b64'] is not None
    # Accept either stub backend or actual pipeline
    assert res.get('backend') in ('stub', 'stable-diffusion-controlnet', 'stable-diffusion-upscaled', 'stable-diffusion')


if __name__ == '__main__':
    test_controlnet_generate_returns_image_b64()
    print('ok')
