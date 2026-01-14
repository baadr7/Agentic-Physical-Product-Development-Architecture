from typing import List, Dict

# Compute Pareto front from variants multiobjective scores.
# Assumes 'scores' dict with numeric objectives: overall_score, fabricability, sustainability, aesthetic.

def pareto_front(variants: List[Dict]) -> List[Dict]:
    objs = ['fabricability','sustainability','aesthetic']
    front = []
    for v in variants:
        s = v.get('metrics', {}).get('scores', {})
        if not all(o in s for o in objs):
            continue
        dominated = False
        for u in variants:
            if u is v:
                continue
            su = u.get('metrics', {}).get('scores', {})
            if not all(o in su for o in objs):
                continue
            better_or_equal = all(su[o] >= s[o] for o in objs)
            strictly_better = any(su[o] > s[o] for o in objs)
            if better_or_equal and strictly_better:
                dominated = True
                break
        if not dominated:
            front.append({'id': v.get('id'), 'scores': {o: s[o] for o in objs}, 'overall_score': s.get('overall_score')})
    # Sort by overall score descending for presentation
    front.sort(key=lambda x: x.get('overall_score', 0), reverse=True)
    return front
