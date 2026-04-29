import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  let body: { text?: string } = {};
  try {
    body = (await req.json()) as { text?: string };
  } catch {
    body = {};
  }
  const text = body.text || '';
  // Simple stub normalization: extract materials lines and size if present
  const materials = text
    .split(/[,\n]/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && /[a-zA-Z]/.test(s))
    .slice(0, 5);
  const sizeMatch = text.match(/(\d{1,3})\s?cm/);
  const size_cm = sizeMatch?.[1] ? parseInt(sizeMatch[1], 10) : undefined;
  const constraints = { size_cm, notes: 'Stub LLM normalization applied' };
  return Response.json({ ok: true, materials, constraints, size_cm });
}
