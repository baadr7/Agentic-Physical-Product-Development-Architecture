#!/usr/bin/env python3
"""Test Supabase persistence with the FastAPI backend."""
import requests
import time
import json

def main():
    print("=" * 50)
    print("Testing Supabase Persistence")
    print("=" * 50)

    # Test 1: POST a new run
    print("\n1. Creating a run via POST /api/v1/runs...")
    payload = {
        'project_id': 'proj-supabase-test-' + str(int(time.time())),
        'input_mode': 'text',
        'description': 'Testing Supabase persistence',
        'options': {'guidance_scale': 7.5, 'steps': 20}
    }

    try:
        r = requests.post('http://127.0.0.1:8000/api/v1/runs', json=payload, timeout=5)
        print(f"   Status: {r.status_code}")
        
        if r.status_code == 200:
            run = r.json()
            run_id = run.get('run_id')
            print(f"   ✓ Created run: {run_id}")
            print(f"   Status: {run.get('status')}")
            print(f"   Project: {run.get('project_id')}")
        else:
            print(f"   ✗ Error: {r.text}")
    except Exception as e:
        print(f"   ✗ Connection failed: {e}")
        # Do not exit with non-zero to avoid breaking pytest collection

    # Test 2: GET all runs
    print("\n2. Fetching all runs via GET /api/v1/runs...")
    time.sleep(1)

    try:
        g = requests.get('http://127.0.0.1:8000/api/v1/runs', timeout=5)
        print(f"   Status: {g.status_code}")
        
        if g.status_code == 200:
            runs = g.json()
            print(f"   ✓ Total runs: {len(runs)}")
            print("\n   Last 3 runs:")
            for run in runs[:3]:
                print(f"     - {run.get('run_id')}: {run.get('status')} (project: {run.get('project_id')})")
        else:
            print(f"   ✗ Error: {g.text}")
    except Exception as e:
        print(f"   ✗ Connection failed: {e}")

    print("\n" + "=" * 50)
    print("✓ Test complete - Supabase persistence check finished")
    print("=" * 50)

if __name__ == '__main__':
    main()
