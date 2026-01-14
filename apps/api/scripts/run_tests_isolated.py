"""
Run each pytest file in apps/api/tests in a separate subprocess using the
apps/api virtualenv Python interpreter. This isolates import-time environment
and prevents cross-test leakage.

Usage:
  python run_tests_isolated.py

The script will run tests sequentially and stop on the first failure, printing
output for debugging. It returns exit code 0 if all test files passed.
"""
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
TESTS_DIR = ROOT / 'apps' / 'api' / 'tests'
VENV_PY = ROOT / 'apps' / 'api' / '.venv' / 'Scripts' / 'python.exe'

if not VENV_PY.exists():
    print(f"Virtualenv python not found at {VENV_PY}; using sys.executable: {sys.executable}")
    VENV_PY = Path(sys.executable)

py_files = sorted([p for p in TESTS_DIR.rglob('test_*.py') if p.is_file()])
if not py_files:
    print('No test files found under', TESTS_DIR)
    sys.exit(0)

all_ok = True
failed = []
for p in py_files:
    rel = p.relative_to(ROOT)
    print('='*80)
    print(f"Running tests in: {rel}")
    # Build environment for subprocess: inherit current env but ensure PYTHONPATH
    env = os.environ.copy()
    # Ensure project and apps/api on PYTHONPATH so tests can import main
    env['PYTHONPATH'] = f"{ROOT}{os.pathsep}{ROOT / 'apps' / 'api'}"
    cmd = [str(VENV_PY), '-m', 'pytest', str(p), '-q']
    print('CMD:', ' '.join(cmd))
    proc = subprocess.run(cmd, env=env, capture_output=True, text=True)
    print(proc.stdout)
    if proc.returncode != 0:
        print(proc.stderr)
        print(f"Tests failed in {rel} (exit {proc.returncode})")
        failed.append((str(rel), proc.returncode))
        all_ok = False
        break
    else:
        print(f"Passed: {rel}\n")

print('='*80)
if all_ok:
    print('All test files passed in isolated mode')
    sys.exit(0)
else:
    print('Some test files failed:')
    for f, code in failed:
        print('-', f, 'exit', code)
    sys.exit(1)
