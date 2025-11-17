import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.run_id || !body.kind) {
      return Response.json({ error: 'run_id and kind required' }, { status: 400 });
    }
    return Response.json({ upload_url: 'https://example.com/upload/stub', expires_in: 3600 });
  } catch (e: any) {
    return Response.json({ error: e?.message || 'Invalid JSON' }, { status: 400 });
  }
}
