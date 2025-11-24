"""Small CAD stub used when a full exporter isn't available.

Provides a deterministic minimal ASCII STL for smoke-testing and CI.
"""
def generate_cad_variant(params: dict | None = None) -> dict:
    """Return a dict with a minimal `stl_text` and meta."""
    width = params.get('width_mm', 60) if params else 60
    height = params.get('height_mm', 40) if params else 40
    depth = params.get('depth_mm', 10) if params else 10

    # Minimal unit cube approximating the requested size (scaled)
    w = float(width) / 10.0
    h = float(height) / 10.0
    d = float(depth) / 10.0

    stl = [
        'solid stub',
        f'  facet normal 0 0 1',
        '    outer loop',
        f'      vertex 0 0 0',
        f'      vertex {w:.3f} 0 0',
        f'      vertex 0 {h:.3f} 0',
        '    endloop',
        '  endfacet',
        'endsolid stub',
    ]
    return {'stl_text': '\n'.join(stl) + '\n', 'meta': {'w': w, 'h': h, 'd': d}}
"""CAD parametric generation stub.
Returns a mock STL string and basic geometric metrics from input dimensions.
"""
from __future__ import annotations
from typing import Dict, Any
import uuid

def generate_cad_variant(params: Dict[str, Any]) -> Dict[str, Any]:
    # Accept width/height/depth (mm)
    w = float(params.get('width_mm', 60.0))
    h = float(params.get('height_mm', 40.0))
    d = float(params.get('depth_mm', 30.0))
    volume_cm3 = (w * h * d) / 1000.0  # convert mm^3 to cm^3 (1 cm^3 = 1000 mm^3)
    surface_area_cm2 = 2*(w*h + h*d + w*d) / 100.0  # convert mm^2 to cm^2 (1 cm^2 = 100 mm^2)
    stl_lines = [
        'solid makerkit_stub',
        '  facet normal 0 0 0',
        '    outer loop',
        '      vertex 0 0 0',
        f'      vertex {w} 0 0',
        f'      vertex 0 {h} 0',
        '    endloop',
        '  endfacet',
        'endsolid makerkit_stub'
    ]
    stl_text = '\n'.join(stl_lines)
    return {
        'cad_id': f'cad-{uuid.uuid4().hex[:8]}',
        'stl_text': stl_text,
        'width_mm': w,
        'height_mm': h,
        'depth_mm': d,
        'volume_cm3': round(volume_cm3, 2),
        'surface_area_cm2': round(surface_area_cm2, 2),
    }

__all__ = ['generate_cad_variant']
