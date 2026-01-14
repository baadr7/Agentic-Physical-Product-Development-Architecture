import datetime
from typing import List, Dict

try:
    import mlflow  # type: ignore
    _MLFLOW = True
except Exception:
    _MLFLOW = False

# Stub LLM report generator: builds narrative paragraphs from variant metrics.
# For real integration, call an LLM provider (OpenAI/Mistral) using API key.


def generate_dfx_report(run_id: str, variants: List[Dict]) -> str:
    now_utc = datetime.datetime.now(datetime.UTC)
    lines = [f"DfX Design Report for Run {run_id}", f"Generated at {now_utc.isoformat()}", ""]
    if not variants:
        lines.append("No variants available.")
        return "\n".join(lines)
    # Aggregate stats
    masses = [v.get('metrics', {}).get('mass_g', 0) for v in variants]
    avg_mass = sum(masses)/len(masses) if masses else 0
    lines.append(f"Average mass: {avg_mass:.2f} g across {len(variants)} variants.")
    sustainability = [v.get('metrics', {}).get('scores', {}).get('sustainability') for v in variants if v.get('metrics', {}).get('scores', {}).get('sustainability') is not None]
    if sustainability:
        lines.append(f"Mean sustainability score: {sum(sustainability)/len(sustainability):.2f}.")
    lines.append("")
    for v in variants[:5]:  # limit detail
        s = v.get('metrics', {}).get('scores', {})
        lines.append(f"Variant {v.get('id')}: overall={s.get('overall_score')} fabricability={s.get('fabricability')} sustainability={s.get('sustainability')} aesthetic={s.get('aesthetic')} feedback={s.get('user_feedback')}.")
    lines.append("")
    lines.append("Observations: High aesthetic feedback increases aesthetic weighting; consider balancing sustainability objectives in later iterations.")
    lines.append("Recommendations: Explore reduced support volume ratio to lower material use while maintaining manufacturability.")
    return "\n".join(lines)
