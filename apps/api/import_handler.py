import base64
import csv
import io
import uuid
from typing import List, Dict

try:
    import pandas as pd  # type: ignore
    _PD = bool(getattr(pd, 'read_csv', None))
except Exception:
    _PD = False

REQUIRED_COLUMNS = ['run_id','mass_g','part_count','support_volume_ratio','material']


def parse_dataset(file_b64: str, filename: str) -> List[Dict]:
    """Parse CSV or XLSX dataset into variant metric dicts."""
    raw = base64.b64decode(file_b64)

    def _fallback_csv() -> List[Dict]:
        content = raw.decode('utf-8-sig', errors='replace')
        reader = csv.DictReader(io.StringIO(content))
        fieldnames = reader.fieldnames or []
        missing = [c for c in REQUIRED_COLUMNS if c not in fieldnames]
        if missing:
            raise ValueError(f"missing columns: {missing}")
        return [dict(row) for row in reader]

    # Pandas path (optional). If pandas is partially installed/broken, fall back.
    if _PD:
        try:
            buf = io.BytesIO(raw)
            if filename.lower().endswith('.xlsx'):
                read_excel = getattr(pd, 'read_excel', None)
                if not callable(read_excel):
                    raise AttributeError('pandas.read_excel not available')
                df = read_excel(buf)
            else:
                df = pd.read_csv(buf)
            missing = [c for c in REQUIRED_COLUMNS if c not in getattr(df, 'columns', [])]
            if missing:
                raise ValueError(f"missing columns: {missing}")
            return df.to_dict(orient='records')
        except Exception:
            return _fallback_csv()

    return _fallback_csv()


def build_variants(records: List[Dict]) -> List[Dict]:
    variants = []
    for r in records:
        vid = f"import-{uuid.uuid4().hex[:8]}"
        metrics = {
            'mass_g': float(r.get('mass_g', 0)),
            'part_count': int(r.get('part_count', 1)),
            'support_volume_ratio': float(r.get('support_volume_ratio', 0.0)),
            'material': r.get('material','PLA')
        }
        variants.append({
            'id': vid,
            'run_id': r.get('run_id'),
            'metrics': metrics,
            'score': None,
            'created_at': None
        })
    return variants
