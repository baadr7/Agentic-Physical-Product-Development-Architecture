"use client"
import { useState } from "react"

export default function AIPage() {
  const [prompt, setPrompt] = useState("Design a luxury perfume bottle, elegant glass, gold accents, minimalist label, photorealistic, front and side views")
  const [width, setWidth] = useState(1080)
  const [height, setHeight] = useState(1080)
  const [loading, setLoading] = useState(false)
  const [imgSrc, setImgSrc] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [supaUrl, setSupaUrl] = useState<string | null>(null)
  const [saveToSupa, setSaveToSupa] = useState(false)
  const [adminToken, setAdminToken] = useState('')

  async function generate() {
    setLoading(true)
    setError(null)
    setImgSrc(null)
    try {
      const res = await fetch('/api/diffusion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, width, height, save_to_supabase: saveToSupa }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'Generation failed')
      // data.image_b64 is a PNG base64
      setImgSrc('data:image/png;base64,' + json.image_b64)
      if (json.supabase_url) setSupaUrl(json.supabase_url)
    } catch (e: any) {
      setError(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  async function generateDirect() {
    // Direct generate - same backend route but labeled for users who want quick generation
    setLoading(true)
    setError(null)
    setImgSrc(null)
    try {
      const res = await fetch('/api/diffusion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, width, height, save_to_supabase: saveToSupa }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'Generation failed')
      setImgSrc('data:image/png;base64,' + json.image_b64)
      if (json.supabase_url) setSupaUrl(json.supabase_url)
    } catch (e: any) {
      setError(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: 24 }}>
      <h1>Générateur d'images (Makerkit)</h1>
      <div style={{ display: 'grid', gap: 12 }}>
        <label>
          Prompt
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} style={{ width: '100%' }} />
        </label>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={saveToSupa} onChange={(e) => setSaveToSupa(e.target.checked)} />
            Save to Supabase
          </label>
          <label style={{ flex: 1 }}>
            Admin token (local):
            <input type="password" value={adminToken} onChange={(e) => setAdminToken(e.target.value)} style={{ width: '100%' }} />
          </label>
          <button onClick={async () => {
            if (!adminToken) return alert('Enter admin token');
            // Call server-side API to set token (server sends ADMIN_SECRET)
            try {
              const r = await fetch('/api/diffusion/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: adminToken }) })
              const j = await r.json()
              if (!j.ok) alert('Set token failed: ' + (j.error || JSON.stringify(j)))
              else alert('Token set')
            } catch (err) {
              alert(String(err))
            }
          }} style={{ padding: '8px 10px' }}>Set Token</button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <label>
            Width
            <input type="number" value={width} onChange={(e) => setWidth(Number(e.target.value))} style={{ width: 120 }} />
          </label>
          <label>
            Height
            <input type="number" value={height} onChange={(e) => setHeight(Number(e.target.value))} style={{ width: 120 }} />
          </label>
          <button onClick={generate} disabled={loading} style={{ padding: '8px 12px' }}>
            {loading ? 'Génération...' : 'Générer'}
          </button>
          <button onClick={generateDirect} disabled={loading} style={{ padding: '8px 12px' }}>
            {loading ? 'Génération...' : 'Générer (direct)'}
          </button>
        </div>
        {error && <div style={{ color: 'crimson' }}>{error}</div>}
        {imgSrc && (
          <div>
            <h3>Résultat</h3>
            <img src={imgSrc} alt="generated" style={{ maxWidth: '100%' }} />
            <div style={{ marginTop: 8 }}>
              <a href={imgSrc} download="makerkit_generated.png">Télécharger</a>
              {supaUrl && (
                <div style={{ marginTop: 8 }}>
                  <a href={supaUrl} target="_blank" rel="noreferrer">Open saved image (Supabase)</a>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
