"""Lightweight SIMP-like topology optimization solver for smoke tests.

This is a compact, dependency-light implementation intended for CI and
local smoke runs. It produces a deterministic `layout_mask` (2D list)
and returns a result dict with `topopt_id` and `compliance` proxy.
"""
from __future__ import annotations

import uuid
import math
from typing import Tuple, Dict


def _mean_filter(x: list[list[float]], r: int) -> list[list[float]]:
    """Simple box blur with edge clamping."""
    if r <= 0:
        return x
    h = len(x)
    w = len(x[0]) if h else 0
    if h == 0 or w == 0:
        return x

    out: list[list[float]] = [[0.0 for _ in range(w)] for _ in range(h)]
    diam = 2 * r + 1
    denom = float(diam * diam)
    for i in range(h):
        for j in range(w):
            s = 0.0
            for di in range(-r, r + 1):
                ii = i + di
                if ii < 0:
                    ii = 0
                elif ii >= h:
                    ii = h - 1
                row = x[ii]
                for dj in range(-r, r + 1):
                    jj = j + dj
                    if jj < 0:
                        jj = 0
                    elif jj >= w:
                        jj = w - 1
                    s += row[jj]
            out[i][j] = s / denom
    return out


def _mean_2d(x: list[list[float]]) -> float:
    h = len(x)
    w = len(x[0]) if h else 0
    if h == 0 or w == 0:
        return 0.0
    s = 0.0
    for row in x:
        s += sum(row)
    return s / float(h * w)


def _max_abs_diff(a: list[list[float]], b: list[list[float]]) -> float:
    h = len(a)
    w = len(a[0]) if h else 0
    m = 0.0
    for i in range(h):
        ra = a[i]
        rb = b[i]
        for j in range(w):
            d = abs(ra[j] - rb[j])
            if d > m:
                m = d
    return m


def run_topopt_simp(nelx: int = 60, nely: int = 40, volfrac: float = 0.4, penal: float = 3.0,
                    rmin: float = 1.5, max_iter: int = 80, tol: float = 1e-3) -> Dict:
    """Run a toy SIMP-like topology optimization.

    Args:
        nelx, nely: mesh dimensions (elements)
        volfrac: target volume fraction (0..1)
        penal: penalization exponent (affects contrast)
        rmin: filter radius (in elements)
        max_iter: maximum iterations
        tol: convergence tolerance on density change

    Returns: dict with `layout_mask` (list of lists 0/1), `topopt_id`, and `compliance` metric
    """
    # Initialize density field
    nelx = int(max(1, nelx))
    nely = int(max(1, nely))
    volfrac = float(max(1e-3, min(1.0, volfrac)))
    x: list[list[float]] = [[volfrac for _ in range(nelx)] for _ in range(nely)]
    topopt_id = uuid.uuid4().hex[:12]

    r = max(1, int(round(rmin)))
    for it in range(max_iter):
        # Sensitivity proxy: encourage material where curvature of density is high
        lap: list[list[float]] = [[0.0 for _ in range(nelx)] for _ in range(nely)]
        for i in range(1, nely - 1):
            for j in range(1, nelx - 1):
                lap[i][j] = (
                    x[i - 1][j]
                    + x[i + 1][j]
                    + x[i][j - 1]
                    + x[i][j + 1]
                    - 4.0 * x[i][j]
                )

        sens: list[list[float]] = [[0.0 for _ in range(nelx)] for _ in range(nely)]
        sens_sum = 0.0
        for i in range(nely):
            for j in range(nelx):
                s = 1.0 - x[i][j] + 0.5 * abs(lap[i][j])
                if s < 1e-6:
                    s = 1e-6
                sens[i][j] = s
                sens_sum += s
        sens_mean = sens_sum / float(nelx * nely)

        # OC-like multiplicative update (proxy)
        xnew: list[list[float]] = [[0.0 for _ in range(nelx)] for _ in range(nely)]
        for i in range(nely):
            for j in range(nelx):
                xnew[i][j] = x[i][j] * math.sqrt(sens[i][j] / (sens_mean + 1e-9))

        # Enforce volume constraint by scaling
        mean_scale = volfrac / (_mean_2d(xnew) + 1e-12)
        for i in range(nely):
            for j in range(nelx):
                v = xnew[i][j] * mean_scale
                if v < 1e-3:
                    v = 1e-3
                elif v > 1.0:
                    v = 1.0
                xnew[i][j] = v

        # Apply smoothing filter
        x_filtered = _mean_filter(xnew, r)

        change = _max_abs_diff(x_filtered, x)
        x = x_filtered
        if change < tol:
            break

    # Threshold to produce binary layout mask
    mask: list[list[int]] = [[1 if x[i][j] >= 0.5 else 0 for j in range(nelx)] for i in range(nely)]

    # Compute a simple compliance proxy (sum of densities penalized)
    compliance = 0.0
    for row in x:
        for v in row:
            compliance += float(v) ** float(penal)

    return {
        'topopt_id': topopt_id,
        'layout_mask': mask,
        'densities': x,
        'compliance': float(compliance),
        'nelx': nelx,
        'nely': nely,
    }


if __name__ == '__main__':
    print(run_topopt_simp(40, 20, 0.4))
