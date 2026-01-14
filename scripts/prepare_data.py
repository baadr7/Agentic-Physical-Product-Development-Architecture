import os, json, pathlib

RAW_DIR = pathlib.Path('data/raw')
PROC_DIR = pathlib.Path('data/processed')
PROC_DIR.mkdir(parents=True, exist_ok=True)

sample = {'status':'ok','source_files':[], 'note':'DVC stub transformation'}
for p in RAW_DIR.glob('*'):
    if p.is_file():
        sample['source_files'].append(p.name)

with open(PROC_DIR / 'dataset.json','w',encoding='utf-8') as f:
    json.dump(sample,f,indent=2)

print('Prepared processed dataset stub.')
