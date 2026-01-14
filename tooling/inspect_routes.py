import sys
sys.path.insert(0, r'c:\Users\MSI\Documents\Makerkit\nextjs-saas-starter-kit-lite\apps\api')
import main
print('variants cad export route present:')
for r in main.app.routes:
    if '/api/v1/variants/{variant_id}/cad/export' == r.path:
        print('FOUND')
        break
else:
    print('NOT FOUND')
print('Total routes:', len(main.app.routes))
for r in main.app.routes:
    print(r.path)
