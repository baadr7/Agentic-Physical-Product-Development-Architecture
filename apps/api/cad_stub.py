"""Small CAD stub used when a full exporter isn't available.

Provides a deterministic minimal ASCII STL for smoke-testing and CI.
"""
from __future__ import annotations

from typing import Dict, Any
import uuid


def generate_cad_variant(params: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """Return a dict with a minimal `stl_text` and meta.

    The function accepts an optional `params` dict with keys `width_mm`,
    `height_mm`, and `depth_mm`. It returns a simple STL string and some
    basic metrics. This is intentionally lightweight and deterministic for
    tests.
    """
    width = float(params.get('width_mm', 60.0)) if params else 60.0
    height = float(params.get('height_mm', 40.0)) if params else 40.0
    depth = float(params.get('depth_mm', 30.0)) if params else 30.0

    # Simple ASCII STL representing a single triangular facet (not a real solid)
    stl_lines = [
        'solid makerkit_stub',
        '  facet normal 0 0 0',
        '    outer loop',
        '      vertex 0 0 0',
        f'      vertex {width} 0 0',
        f'      vertex 0 {height} 0',
        '    endloop',
        '  endfacet',
        'endsolid makerkit_stub'
    ]
    stl_text = '\n'.join(stl_lines) + '\n'

    volume_cm3 = (width * height * depth) / 1000.0
    surface_area_cm2 = 2 * (width * height + height * depth + width * depth) / 100.0

    return {
        'cad_id': f'cad-{uuid.uuid4().hex[:8]}',
        'stl_text': stl_text,
        'width_mm': width,
        'height_mm': height,
        'depth_mm': depth,
        'volume_cm3': round(volume_cm3, 2),
        'surface_area_cm2': round(surface_area_cm2, 2),
    }


__all__ = ['generate_cad_variant']
