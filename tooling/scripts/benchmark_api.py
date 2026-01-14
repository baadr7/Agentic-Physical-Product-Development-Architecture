import time, statistics, requests, os

BASE = os.getenv('API_BASE','http://localhost:8001')
ENDPOINTS = [
    '/health',
    '/api/v1/projects',
    '/api/v1/runs',
    '/admin/metrics'
]
ITERATIONS = int(os.getenv('BENCH_ITERS','10'))

results = {}
for ep in ENDPOINTS:
    durs = []
    url = BASE + ep
    for i in range(ITERATIONS):
        t0 = time.time()
        try:
            r = requests.get(url, timeout=5)
            r.raise_for_status()
        except Exception:
            pass
        durs.append((time.time()-t0)*1000.0)
    results[ep] = {
        'count': len(durs),
        'avg_ms': statistics.mean(durs),
        'p95_ms': sorted(durs)[int(0.95*(len(durs)-1))] if durs else 0.0
    }

print('Benchmark Results:')
for ep, data in results.items():
    print(f"{ep}: avg={data['avg_ms']:.2f}ms p95={data['p95_ms']:.2f}ms")
