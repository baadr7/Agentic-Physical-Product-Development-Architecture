from typing import Dict

# Adaptive feedback weighting tracker (in-memory). For production use persistent DB.

_FEEDBACK_HISTORY: Dict[str, Dict[str, float]] = {}
# Structure: run_id -> { 'count': int, 'avg_rating': float, 'ema_rating': float }


def update_feedback(run_id: str, rating: float) -> Dict[str, float]:
    entry = _FEEDBACK_HISTORY.get(run_id, {'count': 0, 'avg_rating': 0.0, 'ema_rating': 0.0})
    c = entry['count'] + 1
    avg = (entry['avg_rating'] * entry['count'] + rating) / c
    # Exponential moving average with alpha dependent on sample size (slower drift when many samples)
    alpha = 0.5 if c < 10 else 0.2 if c < 50 else 0.1
    ema = entry['ema_rating'] * (1 - alpha) + rating * alpha
    entry['count'] = c
    entry['avg_rating'] = avg
    entry['ema_rating'] = ema
    _FEEDBACK_HISTORY[run_id] = entry
    return entry


def derive_weights(base_weights: Dict[str, float], feedback_entry: Dict[str, float]) -> Dict[str, float]:
    if not feedback_entry:
        return base_weights
    avg = feedback_entry.get('avg_rating', 0.0)
    ema = feedback_entry.get('ema_rating', avg)
    adjusted = dict(base_weights)
    # Use EMA for aesthetic bump; use gap (4 - avg) for sustainability emphasis
    if ema >= 4.0:
        adjusted['aesthetic'] = min(adjusted.get('aesthetic', 1.0) * (1.05 + (ema-4)*0.05), 5.0)
    else:
        adjusted['sustainability'] = min(adjusted.get('sustainability', 1.0) * (1.02 + (4-ema)*0.03), 5.0)
    # Gentle penalty on fabricability if average rating low (<3)
    if avg < 3.0:
        adjusted['fabricability'] = max(adjusted.get('fabricability',1.0) * 0.95, 0.3)
    # Renormalize
    s = sum(adjusted.values())
    if s > 0:
        factor = len(adjusted)/s
        for k in adjusted:
            adjusted[k] = round(adjusted[k] * factor, 4)
    return adjusted
