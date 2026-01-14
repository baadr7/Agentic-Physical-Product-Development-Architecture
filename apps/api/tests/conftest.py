import os
import sys

# Ensure both the repo root and apps/api are on sys.path so tests can import
# either `main` or `apps.api.*` regardless of the directory pytest is run from.
HERE = os.path.dirname(__file__)
APPS_API_DIR = os.path.abspath(os.path.join(HERE, ".."))
REPO_ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))

for p in (REPO_ROOT, APPS_API_DIR):
	if p and p not in sys.path:
		sys.path.insert(0, p)

# Never load apps/api/.env during pytest (it can leak local secrets into tests).
os.environ.setdefault('LOAD_DOTENV', '0')

# Keep tests isolated from developer machine env.
# Individual tests can opt-in by setting env vars explicitly (e.g. test_auth_rbac).
for k in (
	'SUPABASE_URL',
	'SUPABASE_KEY',
	'SUPABASE_SERVICE_ROLE_KEY',
	'SUPABASE_STORAGE_BUCKET',
	'SUPABASE_JWT_SECRET',
	'JWT_REQUIRED',
	'REQUIRE_REAL_IMAGES',
):
	os.environ.pop(k, None)

# Default to auth disabled unless a test enables it.
os.environ.setdefault('JWT_REQUIRED', '0')
