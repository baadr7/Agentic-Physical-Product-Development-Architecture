"""Simple CAD exporter: create an ASCII STL from a TopOpt layout mask.

This exporter is intentionally lightweight and deterministic so tests and
smoke-runners can produce a tangible STL artifact without heavy geometry
dependencies. It creates a small cube for each high-density cell in the
layout mask and returns (step_bytes, stl_bytes).
"""
from typing import Tuple, Any

def _cube_triangles(x: float, y: float, z: float, size: float = 1.0):
    """Return list of triangles (normal, v1, v2, v3) for a cube centered at (x,y,z)."""
    hs = size / 2.0
    # 8 vertices
    v = [
        (x - hs, y - hs, z - hs),
        (x + hs, y - hs, z - hs),
        (x + hs, y + hs, z - hs),
        (x - hs, y + hs, z - hs),
        (x - hs, y - hs, z + hs),
        (x + hs, y - hs, z + hs),
        (x + hs, y + hs, z + hs),
        (x - hs, y + hs, z + hs),
    ]
    # faces as triangles, normals are approximate
    faces = [
        # bottom
        ((0.0, -1.0, 0.0), (v[0], v[1], v[2])), ((0.0, -1.0, 0.0), (v[0], v[2], v[3])),
        # top
        ((0.0, 1.0, 0.0), (v[4], v[6], v[5])), ((0.0, 1.0, 0.0), (v[4], v[7], v[6])),
        # front
        ((0.0, 0.0, -1.0), (v[0], v[4], v[5])), ((0.0, 0.0, -1.0), (v[0], v[5], v[1])),
        # back
        ((0.0, 0.0, 1.0), (v[3], v[2], v[6])), ((0.0, 0.0, 1.0), (v[3], v[6], v[7])),
        # left
        ((-1.0, 0.0, 0.0), (v[0], v[3], v[7])), ((-1.0, 0.0, 0.0), (v[0], v[7], v[4])),
        # right
        ((1.0, 0.0, 0.0), (v[1], v[5], v[6])), ((1.0, 0.0, 0.0), (v[1], v[6], v[2])),
    ]
    tris = []
    for n, verts in faces:
        tris.append((n, verts[0], verts[1], verts[2]))
    return tris


def generate_cad_files(result: dict | Any, cell_size: float = 1.0) -> Tuple[bytes, bytes]:
    """Generate (step_bytes, stl_bytes) from TopOpt `result`.

    Expects `result` to contain a `layout_mask` (2D list) where truthy values
    indicate material. The returned STEP bytes are a small placeholder text
    (real STEP export requires CadQuery or similar). The STL is ASCII and
    contains cubes for each material cell.
    """
    layout = result.get('layout_mask') if isinstance(result, dict) else None
    if layout is None:
        # Try alternate key names
        layout = result.get('layout') if isinstance(result, dict) else None

    if not layout:
        # fallback: single cube
        layout = [[1]]

    # normalize: list of lists of ints
    rows = layout
    nrows = len(rows)
    ncols = len(rows[0]) if nrows > 0 else 0

    tris = []
    # place cells centered around origin
    x0 = - (ncols * cell_size) / 2.0 + cell_size / 2.0
    y0 = - (nrows * cell_size) / 2.0 + cell_size / 2.0
    for i in range(nrows):
        for j in range(ncols):
            val = rows[i][j]
            if bool(val):
                x = x0 + j * cell_size
                y = y0 + i * cell_size
                z = 0.0 + cell_size / 2.0
                tris.extend(_cube_triangles(x, y, z, size=cell_size))

    # build ASCII STL
    lines = ["solid topopt"]
    for n, v1, v2, v3 in tris:
        lines.append(f"  facet normal {n[0]:.6f} {n[1]:.6f} {n[2]:.6f}")
        lines.append("    outer loop")
        lines.append(f"      vertex {v1[0]:.6f} {v1[1]:.6f} {v1[2]:.6f}")
        lines.append(f"      vertex {v2[0]:.6f} {v2[1]:.6f} {v2[2]:.6f}")
        lines.append(f"      vertex {v3[0]:.6f} {v3[1]:.6f} {v3[2]:.6f}")
        lines.append("    endloop")
        lines.append("  endfacet")
    lines.append("endsolid topopt")

    stl_text = "\n".join(lines) + "\n"
    stl_bytes = stl_text.encode('utf-8')

    # STEP is not implemented; provide a deterministic placeholder
    step_text = f"STEP_PLACEHOLDER: cells={nrows}x{ncols}\n"
    step_bytes = step_text.encode('utf-8')

    return step_bytes, stl_bytes
import base64
import io
import uuid
from typing import Tuple, Dict

try:
    import cadquery as cq  # type: ignore
    _CQ = True
except Exception:
    _CQ = False


def _generate_shape() -> 'cq.Workplane | None':  # type: ignore
    if not _CQ:
        return None
    # Simple parametric block with a fillet as placeholder
    wp = cq.Workplane("XY").box(40, 30, 10).edges("|Z").fillet(2.0)
    return wp


def generate_cad_files(variant: Dict) -> Tuple[bytes, bytes]:
    """Return STEP and STL file bytes for a given variant (stub if cadquery unavailable)."""
    if _CQ:
        shape = _generate_shape()
        if shape is not None:
            step = io.BytesIO()
            stl = io.BytesIO()
            cq.exporters.export(shape, step, "STEP")
            cq.exporters.export(shape, stl, "STL")
            return step.getvalue(), stl.getvalue()
    # Fallback stub content
    step_bytes = f"STEP-STUB-{uuid.uuid4().hex}".encode()
    stl_bytes = f"STL-STUB-{uuid.uuid4().hex}".encode()
    return step_bytes, stl_bytes


def encode_data_url(content: bytes, mime: str) -> str:
    b64 = base64.b64encode(content).decode()
    return f"data:{mime};base64,{b64}"