import os
from PIL import Image

def main():
    try:
        import torch
        from diffusers import StableDiffusionPipeline
    except Exception as e:
        print('Missing libraries:', e)
        return

    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    print('Using device:', device)
    model_id = os.environ.get('LOCAL_SD_MODEL','runwayml/stable-diffusion-v1-5')
    prompt = os.environ.get('LOCAL_PROMPT','photorealistic mouse, studio lighting, detailed fur')
    out_path = os.environ.get('LOCAL_OUT','out_local_generated.png')

    # generate at 512 then upscale to 1080x1080
    width = 512
    height = 512
    try:
        pipe = StableDiffusionPipeline.from_pretrained(model_id, torch_dtype=torch.float16 if device=='cuda' else torch.float32)
        pipe = pipe.to(device)
    except Exception as e:
        print('Failed to load pipeline:', e)
        return

    generator = None
    if device=='cuda':
        generator = torch.Generator(device=device).manual_seed(42)
    print('Generating... this may take a while on CPU')
    image = pipe(prompt, guidance_scale=7.5, num_inference_steps=28, height=height, width=width, generator=generator).images[0]
    # upscale to 1080x1080
    target_w = 1080
    target_h = 1080
    up = image.resize((target_w, target_h), resample=Image.LANCZOS)
    up.save(out_path)
    print('Saved image to', out_path)

if __name__ == '__main__':
    main()
