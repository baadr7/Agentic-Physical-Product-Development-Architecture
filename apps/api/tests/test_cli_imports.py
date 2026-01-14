import importlib


def test_cli_modules_import_cleanly():
    """Ensure CLI/utility scripts can be imported without executing network calls or exiting."""
    modules = [
        'apps.api.env_check',
        'apps.api.apply_schema',
        'apps.api.seed_supabase',
    ]
    for name in modules:
        mod = importlib.import_module(name)
        # reload to ensure module-level code is safe to run multiple times
        importlib.reload(mod)
        assert hasattr(mod, 'main'), f"{name} should expose a main() function"
