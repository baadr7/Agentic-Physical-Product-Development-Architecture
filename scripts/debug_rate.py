import os, sys

os.environ['REDIS_URL']='fakeredis://localhost'
os.environ['RATE_LIMIT_WINDOW_SECONDS']='2'
os.environ['RATE_LIMIT_MAX_REQUESTS']='3'
os.environ['SUPABASE_JWT_SECRET']='testsecret'
os.environ['JWT_REQUIRED']='1'

for mod in list(sys.modules.keys()):
    if mod.startswith('apps.api') or mod in ('main','lib.env_utils'):
        del sys.modules[mod]

from apps.api.lib import env_utils, rate_limiter

print('RATE CONFIG', env_utils.get_rate_config())
for i in range(1,6):
    allowed,count = rate_limiter.rate_check('user:user-rl')
    print(i, 'allowed=', allowed, 'count=', count)
