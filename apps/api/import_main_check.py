import traceback

try:
    import main
    print('main imported successfully')
except Exception:
    traceback.print_exc()
