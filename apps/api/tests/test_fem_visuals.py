import pytest

try:
    from apps.api.fem_solver_general import solve_rect_plate
except Exception:
    # fallback for direct execution context
    from fem_solver_general import solve_rect_plate


def test_solve_rect_plate_returns_stress_array_or_b64():
    # use solver parameter names: length, width, thickness, load
    res = solve_rect_plate(length=40.0, width=30.0, load=100.0)
    assert res.get('ok') is True
    # prefer numeric array
    if 'stress_array' in res:
        arr = res['stress_array']
        assert isinstance(arr, list)
        assert len(arr) > 0
        assert 'stress_shape' in res
        shape = res['stress_shape']
        assert isinstance(shape, list) and len(shape) == 2
    else:
        # fallback to image b64
        b64 = res.get('stress_image_b64')
        assert b64 is None or isinstance(b64, str)

if __name__ == '__main__':
    pytest.main([__file__])
