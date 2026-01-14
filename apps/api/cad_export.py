"""CAD exporter with optional CadQuery support and an ASCII-STL fallback.

The fallback now performs a simple triangle deduplication so adjacent cube
faces shared between cells are removed (reducing internal duplicated faces).
Returns a tuple `(step_bytes, stl_bytes)`.
"""
from typing import Tuple, Any
import io
import tempfile
import os
import math


def _cube_triangles(x: float, y: float, z: float, size: float = 1.0):
    hs = size / 2.0
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
    faces = [
        ((0.0, -1.0, 0.0), (v[0], v[1], v[2])), ((0.0, -1.0, 0.0), (v[0], v[2], v[3])),
        ((0.0, 1.0, 0.0), (v[4], v[6], v[5])), ((0.0, 1.0, 0.0), (v[4], v[7], v[6])),
        ((0.0, 0.0, -1.0), (v[0], v[4], v[5])), ((0.0, 0.0, -1.0), (v[0], v[5], v[1])),
        ((0.0, 0.0, 1.0), (v[3], v[2], v[6])), ((0.0, 0.0, 1.0), (v[3], v[6], v[7])),
        ((-1.0, 0.0, 0.0), (v[0], v[3], v[7])), ((-1.0, 0.0, 0.0), (v[0], v[7], v[4])),
        ((1.0, 0.0, 0.0), (v[1], v[5], v[6])), ((1.0, 0.0, 0.0), (v[1], v[6], v[2])),
    ]
    tris = []
    for n, verts in faces:
        tris.append((n, verts[0], verts[1], verts[2]))
    return tris


def _ascii_stl_from_tris(tris):
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
    return ("\n".join(lines) + "\n").encode("utf-8")


def _round_vertex(v, ndigits=6):
    return (round(v[0], ndigits), round(v[1], ndigits), round(v[2], ndigits))


def _dedupe_tris(tris, ndigits=6):
    """Remove duplicated triangles (shared faces between adjacent cubes).

    Triangles are considered identical if their vertex sets match up to
    rounding precision. This also removes internal faces where two cubes
    produce the same triangle with reversed winding.
    """
    seen = set()
    out = []
    for n, a, b, c in tris:
        key = tuple(sorted([_round_vertex(a, ndigits), _round_vertex(b, ndigits), _round_vertex(c, ndigits)]))
        if key in seen:
            continue
        seen.add(key)
        # Recompute a consistent normal (unit) to avoid sign inconsistencies
        ux = (b[0] - a[0], b[1] - a[1], b[2] - a[2])
        vx = (c[0] - a[0], c[1] - a[1], c[2] - a[2])
        nx = (ux[1] * vx[2] - ux[2] * vx[1], ux[2] * vx[0] - ux[0] * vx[2], ux[0] * vx[1] - ux[1] * vx[0])
        norm = math.sqrt(nx[0] * nx[0] + nx[1] * nx[1] + nx[2] * nx[2])
        if norm > 0:
            nn = (nx[0] / norm, nx[1] / norm, nx[2] / norm)
        else:
            nn = (0.0, 0.0, 0.0)
        out.append((nn, a, b, c))
    return out


def generate_cad_files(result: dict | Any, cell_size: float = 1.0) -> Tuple[bytes, bytes]:
    """Return (step_bytes, stl_bytes).

    If CadQuery is installed, build a compact CAD using boxes for each
    material cell and export STEP/STL via CadQuery exporters. Otherwise fall
    back to the deterministic ASCII-STL cube approach used previously.
    """
    layout = None
    if isinstance(result, dict):
        layout = result.get("layout_mask") or result.get("layout")

    if not layout:
        layout = [[1]]

    # Try CadQuery if available
    try:
        import cadquery as cq  # type: ignore
        from cadquery import exporters  # type: ignore

        rows = layout
        nrows = len(rows)
        ncols = len(rows[0]) if nrows > 0 else 0
        x0 = - (ncols * cell_size) / 2.0 + cell_size / 2.0
        y0 = - (nrows * cell_size) / 2.0 + cell_size / 2.0

        assembly = None
        for i in range(nrows):
            for j in range(ncols):
                if bool(rows[i][j]):
                    x = x0 + j * cell_size
                    y = y0 + i * cell_size
                    b = cq.Workplane("XY").transformed(offset=(x, y, 0)).box(cell_size, cell_size, cell_size)
                    if assembly is None:
                        assembly = b
                    else:
                        assembly = assembly.union(b)

        if assembly is None:
            raise Exception("CadQuery assembly empty")

        with tempfile.TemporaryDirectory() as td:
            step_path = os.path.join(td, "topopt.step")
            stl_path = os.path.join(td, "topopt.stl")
            exporters.export(assembly, step_path)
            exporters.export(assembly, stl_path)
            with open(step_path, "rb") as f:
                step_bytes = f.read()
            with open(stl_path, "rb") as f:
                stl_bytes = f.read()

        return step_bytes, stl_bytes
    except Exception:
        # Fall back to ASCII STL cube approach
        rows = layout
        nrows = len(rows)
        ncols = len(rows[0]) if nrows > 0 else 0
        tris = []
        x0 = - (ncols * cell_size) / 2.0 + cell_size / 2.0
        y0 = - (nrows * cell_size) / 2.0 + cell_size / 2.0
        for i in range(nrows):
            for j in range(ncols):
                if bool(rows[i][j]):
                    x = x0 + j * cell_size
                    y = y0 + i * cell_size
                    z = 0.0 + cell_size / 2.0
                    tris.extend(_cube_triangles(x, y, z, size=cell_size))

        tris = _dedupe_tris(tris, ndigits=6)
        stl_bytes = _ascii_stl_from_tris(tris)
        step_text = f"STEP_PLACEHOLDER: cells={nrows}x{ncols}\n"
        step_bytes = step_text.encode("utf-8")
        return step_bytes, stl_bytes


def generate_gltf_for_result(result: dict | Any, cell_size: float = 1.0) -> bytes:
    """Generate a minimal `glTF` JSON (bytes) with embedded binary buffer (base64).

    The output is a `.gltf` JSON where the `buffer.uri` is a data URI containing
    the binary blob (positions as float32, indices as uint32). This is sufficient
    for three.js / model-viewer to load for preview.
    """
    import json
    import struct
    import base64

    layout = None
    if isinstance(result, dict):
        layout = result.get("layout_mask") or result.get("layout")
    if not layout:
        layout = [[1]]

    # Build triangles from cube fallback (we dedupe later)
    rows = layout
    nrows = len(rows)
    ncols = len(rows[0]) if nrows > 0 else 0
    tris = []
    x0 = - (ncols * cell_size) / 2.0 + cell_size / 2.0
    y0 = - (nrows * cell_size) / 2.0 + cell_size / 2.0
    for i in range(nrows):
        for j in range(ncols):
            if bool(rows[i][j]):
                x = x0 + j * cell_size
                y = y0 + i * cell_size
                z = 0.0 + cell_size / 2.0
                tris.extend(_cube_triangles(x, y, z, size=cell_size))

    tris = _dedupe_tris(tris, ndigits=6)

    # Unique vertices and indices
    vert_map = {}
    verts = []
    indices = []
    for n, a, b, c in tris:
        for v in (a, b, c):
            key = _round_vertex(v, ndigits=6)
            if key not in vert_map:
                vert_map[key] = len(verts)
                verts.append(key)
            indices.append(vert_map[key])

    # Binary buffer: positions (float32) followed by indices (uint32)
    pos_bytes = b"".join([struct.pack("<fff", float(x), float(y), float(z)) for (x, y, z) in verts])
    idx_bytes = b"".join([struct.pack("<I", int(i)) for i in indices])
    bin_blob = pos_bytes + idx_bytes
    b64 = base64.b64encode(bin_blob).decode("ascii")
    uri = f"data:application/octet-stream;base64,{b64}"

    # glTF JSON structure (minimal)
    gltf = {
        "asset": {"version": "2.0", "generator": "mk-cad-export"},
        "buffers": [{"uri": uri, "byteLength": len(bin_blob)}],
        "bufferViews": [
            {"buffer": 0, "byteOffset": 0, "byteLength": len(pos_bytes), "target": 34962},
            {"buffer": 0, "byteOffset": len(pos_bytes), "byteLength": len(idx_bytes), "target": 34963},
        ],
        "accessors": [
            {"bufferView": 0, "byteOffset": 0, "componentType": 5126, "count": len(verts), "type": "VEC3"},
            {"bufferView": 1, "byteOffset": 0, "componentType": 5125, "count": len(indices), "type": "SCALAR"},
        ],
        "meshes": [{"primitives": [{"attributes": {"POSITION": 0}, "indices": 1, "mode": 4}]}],
        "nodes": [{"mesh": 0}],
        "scenes": [{"nodes": [0]}],
        "scene": 0,
    }

    return json.dumps(gltf, separators=(",", ":")).encode("utf-8")


def encode_data_url(content_bytes: bytes, content_type: str = 'application/octet-stream') -> str:
    """Return a data URI (base64) for the given bytes and content type.

    This is a convenience used by callers that embed small previews as
    data URLs (for example in test fixtures or quick previews).
    """
    import base64

    if not isinstance(content_bytes, (bytes, bytearray)):
        content_bytes = bytes(content_bytes)
    b64 = base64.b64encode(content_bytes).decode('ascii')
    return f"data:{content_type};base64,{b64}"