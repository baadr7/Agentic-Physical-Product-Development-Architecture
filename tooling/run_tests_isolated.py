import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEST_DIR = ROOT / 'apps' / 'api' / 'tests'
PYTHON = str(ROOT / 'apps' / 'api' / '.venv' / 'Scripts' / 'python.exe')

files = sorted([str(p) for p in TEST_DIR.rglob('test_*.py')])

results = []
for f in files:
    print(f"Running: {f}")
    cmd = [PYTHON, '-m', 'pytest', '-q', f]
    env = os.environ.copy()
    # ensure PYTHONPATH includes project and apps/api
    env['PYTHONPATH'] = f"{ROOT};{ROOT / 'apps' / 'api'}"
    proc = subprocess.run(cmd, env=env, capture_output=True, text=True)
    print(proc.stdout)
    if proc.returncode != 0:
        print(proc.stderr)
    results.append((f, proc.returncode))

print('\nSummary:')
failed = [r for r in results if r[1] != 0]
print(f"Total files: {len(results)}; Failed: {len(failed)}")
for f, code in failed:
    print(f"FAILED: {f} (code {code})")

if failed:
    raise SystemExit(1)
