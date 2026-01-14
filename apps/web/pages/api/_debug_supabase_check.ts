import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!url || !anon) {
    return res.status(400).json({ ok: false, error: 'missing_env' });
  }

  try {
    const doFetch = async (key: string) =>
      await fetch(`${url}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          apikey: key,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: 'doesnotexist@example.com', password: 'abc123' }),
      });

    let resp = await doFetch(anon);

    const text = await resp.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch (_) {
      // keep raw text
    }

    const masked = anon
      ? `${anon.slice(0, 8)}...${anon.slice(Math.max(anon.length - 4, 0))}`
      : null;

    const anon_hash = anon ? crypto.createHash('sha256').update(anon).digest('hex') : null;
    const anon_len = anon ? anon.length : 0;

    // Read env files and compute hashes for comparison
    const fs = require('fs');
    const path = require('path');
    const envFiles = ['.env', '.env.development', '.env.local'];
    const envInfo: Record<string, any> = {};
    const cwd = process.cwd();
    const dirname = __dirname;
    for (const f of envFiles) {
      envInfo[f] = null;
      try {
        // try two candidate locations: project-root/apps/web/<f> and process.cwd()/<f>
        const candidates = [path.join(cwd, 'apps', 'web', f), path.join(cwd, f), path.join(dirname, '..', f)];
        let found = false;
        for (const p of candidates) {
          try {
            const rp = path.resolve(p);
            if (fs.existsSync(rp)) {
              const content = fs.readFileSync(rp, 'utf8');
              const m = content.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY\s*=\s*(?:\"?)([^#\r\n\"]+)(?:\"?)/);
              if (m && m[1]) {
                const key = m[1].trim();
                envInfo[f] = {
                  path: rp,
                  mask: `${key.slice(0, 8)}...${key.slice(Math.max(key.length - 4, 0))}`,
                  hash: crypto.createHash('sha256').update(key).digest('hex'),
                };
                found = true;
                break;
              } else {
                envInfo[f] = { path: rp, found: false };
                found = true;
                break;
              }
            }
          } catch (e) {
            // ignore
          }
        }
        if (!found) envInfo[f] = null;
      } catch (e) {
        envInfo[f] = { error: String(e) };
      }
    }

    // also report runtime cwd and dirname for debugging
    const runtime_info = { cwd, dirname };

    return res.status(200).json({ ok: resp.ok, status: resp.status, body, anon_mask: masked, anon_hash, anon_len, env_files: envInfo, runtime: runtime_info });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
