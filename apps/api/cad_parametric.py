import uuid, math, datetime, os
from datetime import UTC

try:
    import cadquery as cq  # type: ignore
    CADQUERY_AVAILABLE = True
except Exception:
    CADQUERY_AVAILABLE = False

# Basic parametric box with optional fillet; returns metrics and stub URLs.

def generate_cadquery_model(params: dict) -> dict:
    width = float(params.get('width_mm', 60))
    height = float(params.get('height_mm', 40))
    depth = float(params.get('depth_mm', 30))
    fillet = float(params.get('fillet_mm', 2.0))
    model_id = f'cadq-{uuid.uuid4().hex[:8]}'
    volume_cm3 = (width * height * depth) / 1000.0
    surface_area_cm2 = 2*(width*height + width*depth + height*depth)/100.0
    backend = 'cadquery' if CADQUERY_AVAILABLE else 'stub'
    if CADQUERY_AVAILABLE:
        try:
            wp = cq.Workplane('XY').box(width, depth, height)
            if fillet > 0:
                wp = wp.edges().fillet(fillet)
            # Additional metrics like bounding box can be derived
        except Exception:
            backend = 'cadquery-error'
    return {
        'model_id': model_id,
        'backend': backend,
        'metrics': {
            'volume_cm3': round(volume_cm3,3),
            'surface_area_cm2': round(surface_area_cm2,3),
            'fillet_mm': fillet,
            'width_mm': width,
            'height_mm': height,
            'depth_mm': depth,
        },
        'stl_url': f'https://example.com/{model_id}.stl',
        'step_url': f'https://example.com/{model_id}.step',
        'created_at': datetime.datetime.now(UTC).isoformat(),
    }

__all__ = ['generate_cadquery_model']
