import { NextResponse } from 'next/server';

export async function GET() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!url || !anon) {
    return NextResponse.json({ ok: false, error: 'missing_env' }, { status: 400 });
  }

  try {
    // Make a lightweight request to the Auth token endpoint using a dummy body.
    // We intentionally use a non-existent account so Supabase will return a clear error
    // but we surface the status/message without returning the secret key.
    const resp = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'apikey': anon,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: 'doesnotexist@example.com', password: 'abc123' }),
    });

    const text = await resp.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch (_) {
      // keep raw text
    }

    return NextResponse.json(
      { ok: resp.ok, status: resp.status, body },
      { status: 200 },
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
