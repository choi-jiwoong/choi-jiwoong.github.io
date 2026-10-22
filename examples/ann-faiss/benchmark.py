import json
import platform
import resource
import time
import faiss
import numpy as np

faiss.omp_set_num_threads(1)
rng = np.random.default_rng(42)
items = rng.normal(size=(10000, 64)).astype('float32')
queries = rng.normal(size=(200, 64)).astype('float32')
faiss.normalize_L2(items)
faiss.normalize_L2(queries)
k = 10
exact = faiss.IndexFlatIP(64)
exact.add(items)
_, truth = exact.search(queries, k)
ann = faiss.IndexHNSWFlat(64, 32, faiss.METRIC_INNER_PRODUCT)
ann.hnsw.efConstruction = 100
started = time.perf_counter()
ann.add(items)
build_seconds = time.perf_counter() - started
print(json.dumps({'python': platform.python_version(), 'machine': platform.machine(),
    'faiss': faiss.__version__, 'numpy': np.__version__, 'threads': 1,
    'items': len(items), 'queries': len(queries), 'dimension': 64, 'k': k,
    'build_seconds': build_seconds,
    'serialized_index_bytes': len(faiss.serialize_index(ann))}))
for ef in (16, 32, 64, 128):
    ann.hnsw.efSearch = ef
    ann.search(queries[:10], k)  # warm up before timing
    latencies = []
    hits = 0
    for _ in range(5):
        for query, target in zip(queries, truth):
            started = time.perf_counter()
            _, found = ann.search(query.reshape(1, -1), k)
            latencies.append((time.perf_counter() - started) * 1000)
            hits += len(set(found[0]) & set(target))
    print(json.dumps({'efSearch': ef, 'recall_at_10': hits / (5 * len(queries) * k),
        'p50_ms': float(np.percentile(latencies, 50)),
        'p95_ms': float(np.percentile(latencies, 95)),
        'process_peak_rss_mib': resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / (1024 if platform.system() == 'Linux' else 1024 * 1024)}))
