import os
import uuid
import io
import logging
from datetime import datetime, timezone
from typing import Dict

log = logging.getLogger('parametric3d')


# Placeholder parametric generation; in production integrate Blender headless or CADQuery.
# We synthesize a simple rectangular prism with fillets heuristics and compute volume, surface area.
DEFAULTS = {
    'width_mm': 60.0,
    'height_mm': 40.0,
    'depth_mm': 30.0,
    'wall_thickness_mm': 2.0,
    'material': 'PLA'
}

EXPORT_BASE_URL = os.getenv('EXPORT_BASE_URL', 'https://example.com/exports')


def generate_parametric_model(params: Dict) -> Dict:
    p = {**DEFAULTS, **{k: v for k, v in (params or {}).items() if v is not None}}
    w = float(p['width_mm']); h = float(p['height_mm']); d = float(p['depth_mm'])
    volume_mm3 = w * h * d  # rectangular approximation
    surface_mm2 = 2 * (w * h + w * d + h * d)
    manufacturability = max(0.0, 1.0 - (p['wall_thickness_mm'] / max(5.0, w / 10.0)))
    model_id = f"mdl-{uuid.uuid4().hex[:10]}"
    stl_url = f"{EXPORT_BASE_URL}/{model_id}.stl"
    step_url = f"{EXPORT_BASE_URL}/{model_id}.step"
    return {
        'model_id': model_id,
        'params': p,
        'metrics': {
            'volume_mm3': volume_mm3,
            'surface_mm2': surface_mm2,
            'manufacturability_score': round(manufacturability, 3),
        },
        'stl_url': stl_url,
        'step_url': step_url,
        'created_at': datetime.now(timezone.utc).isoformat()
    }


def export_ascii_stl_box(params: Dict) -> bytes:
    """Generate a simple ASCII STL for a rectangular box based on params.

    Returns bytes of the ASCII STL.
    """
    p = {**DEFAULTS, **{k: v for k, v in (params or {}).items() if v is not None}}
    w = float(p['width_mm']) / 1000.0
    h = float(p['height_mm']) / 1000.0
    d = float(p['depth_mm']) / 1000.0
    x = w / 2.0; y = h / 2.0; z = d / 2.0

    verts = [
        (-x, -y, -z),
        ( x, -y, -z),
        ( x,  y, -z),
        (-x,  y, -z),
        (-x, -y,  z),
        ( x, -y,  z),
        ( x,  y,  z),
        (-x,  y,  z),
    ]

    # faces as triangles (two per quad) using vertex indices
    faces = [
        (0,1,2),(0,2,3),  # bottom
        (4,6,5),(4,7,6),  # top
        (0,4,5),(0,5,1),  # front
        (1,5,6),(1,6,2),  # right
        (2,6,7),(2,7,3),  # back
        (3,7,4),(3,4,0),  # left
    ]

    def fmt(v):
        return f"{v[0]:.6f} {v[1]:.6f} {v[2]:.6f}"

    out = io.StringIO()
    out.write(f"solid box_{uuid.uuid4().hex[:8]}\n")
    for tri in faces:
        # simple normal of (0,0,0) is acceptable for many viewers; compute if needed
        out.write(f"  facet normal 0.0 0.0 0.0\n")
        out.write(f"    outer loop\n")
        for idx in tri:
            out.write(f"      vertex {fmt(verts[idx])}\n")
        out.write(f"    endloop\n")
        out.write(f"  endfacet\n")
    out.write(f"endsolid box_{uuid.uuid4().hex[:8]}\n")
    return out.getvalue().encode('utf-8')


def export_step_box(params: Dict) -> bytes | None:
    """Attempt to generate a STEP file for a simple box using CadQuery.

    Returns bytes of the STEP file when CadQuery is available, otherwise None.
    """
    p = {**DEFAULTS, **{k: v for k, v in (params or {}).items() if v is not None}}
    w = float(p['width_mm']) / 1000.0
    h = float(p['height_mm']) / 1000.0
    d = float(p['depth_mm']) / 1000.0
    try:
        import tempfile
        try:
            import cadquery as cq
            from cadquery import exporters
        except Exception:
            return None

        # Create a simple box centered on the origin
        work = cq.Workplane('XY').box(w, h, d)

        # Export to a temporary file and read bytes back (exporters expects a filename)
        tmp = tempfile.NamedTemporaryFile(suffix='.step', delete=False)
        tmp_name = tmp.name
        tmp.close()
        try:
            exporters.export(work, tmp_name)
            with open(tmp_name, 'rb') as f:
                data = f.read()
        finally:
            try:
                os.remove(tmp_name)
            except Exception:
                pass
        return data
    except Exception as e:
        log.debug(f"export_step_box_failed: {e}")
        return None


__all__ = ['generate_parametric_model', 'export_ascii_stl_box', 'export_step_box']
