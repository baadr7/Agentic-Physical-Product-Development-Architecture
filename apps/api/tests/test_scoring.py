import math
import pytest

from scoring import compute_dfx_scores


def test_scoring_basic_defaults():
    scores = compute_dfx_scores({}, {})
    assert set(scores.keys()) == {
        'fabricability_score', 'assemblability_score', 'sustainability_score', 'overall_score'
    }
    for k,v in scores.items():
        assert isinstance(v, float)
        assert 0.0 <= v <= 100.0


def test_scoring_material_influence():
    pla = compute_dfx_scores({'material': 'PLA', 'mass_g': 60}, {})
    abs_ = compute_dfx_scores({'material': 'ABS', 'mass_g': 60}, {})
    assert pla['sustainability_score'] > abs_['sustainability_score']


def test_scoring_weight_constraint_penalty():
    # Overweight should reduce sustainability
    constrained = compute_dfx_scores({'mass_g': 150}, {'weight_max_g': 100})
    unconstrained = compute_dfx_scores({'mass_g': 150}, {})
    assert constrained['sustainability_score'] < unconstrained['sustainability_score']


def test_overall_weighting():
    # Adjust metrics to create distinct fabricability vs sustainability differences
    v1 = compute_dfx_scores({'part_count': 1, 'support_volume_ratio': 0.05, 'material': 'PLA', 'mass_g': 40}, {})
    v2 = compute_dfx_scores({'part_count': 4, 'support_volume_ratio': 0.30, 'material': 'ABS', 'mass_g': 90}, {})
    assert v1['overall_score'] > v2['overall_score']
    # overall should be between min/max of aspect scores (since weighted avg)
    aspects = [v1['fabricability_score'], v1['assemblability_score'], v1['sustainability_score']]
    assert min(aspects) <= v1['overall_score'] <= max(aspects)

