import os, json, pathlib, random
ART_DIR = pathlib.Path('models/artifacts')
SRC_DIR = pathlib.Path('models/src')
ART_DIR.mkdir(parents=True, exist_ok=True)
# Dummy training producing a "model" metrics file
metrics = {
  'epochs': 3,
  'loss_final': round(random.uniform(0.1,0.5),3),
  'accuracy_final': round(random.uniform(0.7,0.95),3)
}
with open(ART_DIR / 'model-metrics.json','w') as f:
    json.dump(metrics,f,indent=2)
print('Model trained (stub).')
