import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const token = body?.token
    if (!token) return NextResponse.json({ ok: false, error: 'missing token' }, { status: 400 })

    const adminSecret = process.env.ADMIN_SECRET || ''
    if (!adminSecret) return NextResponse.json({ ok: false, error: 'server admin secret not configured' }, { status: 500 })

    const resp = await fetch('http://127.0.0.1:8000/v1/admin/set_hf_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, admin_key: adminSecret })
    })
    const data = await resp.json()
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 })
  }
}
