import sys
try:
    from diffusion_pipeline import diffusion_generator
    import torch
    print('device=', getattr(diffusion_generator,'device',None))
    print('pipe=', getattr(diffusion_generator,'pipe',None) is not None)
    print('controlnet=', getattr(diffusion_generator,'controlnet_pipe',None) is not None)
    print('torch_cuda=', torch.cuda.is_available())
except Exception as e:
    print('error', e)
    sys.exit(2)
