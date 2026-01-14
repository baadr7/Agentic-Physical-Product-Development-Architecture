"use client"

import React, { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { IconChart, IconFolder } from '~/components/icons'
import { MOCK_PROJECTS as INITIAL_PROJECTS, MOCK_RUNS as INITIAL_RUNS } from '~/lib/mock-data'
import { Run, Project } from '~/lib/types'
import { apiGetProjects, apiGetRuns, apiGetVariants } from '~/lib/api/fastapi'

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let nextIndex = 0

  async function worker() {
    while (true) {
      const i = nextIndex
      nextIndex += 1
      if (i >= items.length) return
      results[i] = await fn(items[i]!)
    }
  }

  const workers = Array.from({ length: Math.max(1, limit) }, () => worker())
  await Promise.all(workers)
  return results
}

// Keep the dashboard focused on global overview only
type View = 'overview' | 'projects'

export default function DashboardClient() {
  const router = useRouter()
  // Projects and runs state — start from mocks but editable in UI
  const [projects, setProjects] = useState<Project[]>(() => INITIAL_PROJECTS)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(() => projects[0]?.id ?? null)
  const [runs, setRuns] = useState<Run[]>(() => INITIAL_RUNS)

  const [activeView, setActiveView] = useState<View>('overview')
  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null

  // UI states
  const [threshold, setThreshold] = useState<number>(50)
  const [_projectType, _setProjectType] = useState<string>('mous/objet')

  // Generate form
  const [generateMode, setGenerateMode] = useState<'text' | 'sketch'>('text')
  const [brief, setBrief] = useState<string>('')
  const [material, setMaterial] = useState<string>('PLA')
  const [params, setParams] = useState({ guidance_scale: 7.5, steps: 20 })
  const [uploadedSketchName, setUploadedSketchName] = useState<string | null>(null)
  const [uploadedSketchPreview, setUploadedSketchPreview] = useState<string | null>(null)

  // editable notes state for selected project
  const [editingNotes, setEditingNotes] = useState<string>()

  // Client-only current time to avoid hydration mismatch
  const [currentTime, setCurrentTime] = useState<string>('')
  useEffect(() => {
    setCurrentTime(new Date().toLocaleString())
  }, [])

  // Client-only time formatter to avoid hydration mismatches when rendering
  // dates/times that could differ between server and client (locale, seconds tick)
  function ClientTime({ iso, format = 'time', options }: { iso?: string | null, format?: 'time' | 'date' | 'datetime', options?: Intl.DateTimeFormatOptions }){
    const [value, setValue] = useState<string>('—')
    useEffect(() => {
      if (!iso) return setValue('—')
      try {
        const d = new Date(iso)
        if (Number.isNaN(d.getTime())) return setValue('—')
        if (format === 'time') setValue(d.toLocaleTimeString(undefined, options))
        else if (format === 'date') setValue(d.toLocaleDateString(undefined, options))
        else setValue(d.toLocaleString(undefined, options))
      } catch {
        setValue('—')
      }
    }, [iso, format, JSON.stringify(options)])
    return <>{value}</>
  }

  // Local type for backend run shape
  type RunOut = {
    run_id: string
    project_id?: string
    status?: string
    started_at?: string
    finished_at?: string
    duration_ms?: number
    options?: Record<string, unknown>
    metadata?: Record<string, unknown>
    created_at?: string
  }

  // Fetch runs/projects from the API on mount and keep them in sync
  useEffect(() => {
    const syncFromApi = async () => {
      try {
        const [apiProjects, apiRunsRaw] = await Promise.all([
          apiGetProjects().catch(() => null),
          apiGetRuns().catch(() => null),
        ])

        if (Array.isArray(apiProjects)) {
          setProjects(apiProjects as Project[])
          setSelectedProjectId((prev) => prev ?? (apiProjects[0]?.id ?? null))
        }

        if (Array.isArray(apiRunsRaw)) {
          const apiRuns = apiRunsRaw as any[]
          const mappedRuns = apiRuns.map((r: RunOut) => ({
            id: r.run_id,
            run_id: r.run_id,
            project_id: r.project_id ?? '',
            status: (r.status as Run['status']) ?? 'queued',
            started_at: r.started_at ?? r.created_at ?? new Date().toISOString(),
            finished_at: r.finished_at ?? undefined,
            duration_ms: r.duration_ms,
            parameters: r.options || {},
            metadata: r.metadata || {},
            created_at: r.created_at ?? new Date().toISOString(),
          }))

          // Infer completed when variants exist but status is queued/pending.
          const candidates = mappedRuns.filter((r) => {
            const s = String(r.status || '').toLowerCase()
            return (s === 'queued' || s === 'pending') && Boolean(r.run_id)
          })
          await mapWithConcurrency(candidates, 4, async (r) => {
            try {
              const vs = await apiGetVariants(r.run_id)
              if (Array.isArray(vs) && vs.length > 0) {
                ;(r as any).status = 'completed'
              }
            } catch {
              // ignore
            }
          })

          setRuns(mappedRuns)
        }
      } catch (err) {
        console.log('API runs fetch failed, using local state:', err)
        // Keep current state; use fallback
      }
    }
    syncFromApi()
  }, [])

  const addRun = async (override?: Partial<Run>, targetProjectId?: string) => {
    const projectId = targetProjectId ?? selectedProjectId ?? projects[0]?.id ?? 'project-1'

    // Attempt to create the run via the backend prototype. If the API is not reachable,
    // fall back to local in-memory state to keep UI responsive in offline/dev.
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000'
      const payload = {
        project_id: projectId,
        input_mode: override?.metadata?.input_mode ?? (generateMode || 'text'),
        description: override?.metadata?.brief ?? brief,
        options: override?.parameters ?? params,
      }
      const res = await fetch(`${base}/api/v1/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        throw new Error(`API error ${res.status}`)
      }

      const data = await res.json()

      // Map backend RunOut -> our Run shape where possible
      const now = new Date().toISOString()
      const createdRun: Run = {
        id: data.run_id,
        run_id: data.run_id,
        project_id: data.project_id || projectId,
        status: (data.status as Run['status']) ?? 'queued',
        started_at: now,
        finished_at: undefined,
        duration_ms: undefined,
        parameters: payload.options,
        metadata: { brief: payload.description },
        created_at: data.created_at ?? now,
      }

      // Prepend the created run and return to projects list (dashboard no longer hosts project views)
      setRuns((s) => [createdRun, ...s])
      setActiveView('projects')
      setSelectedProjectId(createdRun.project_id)
      
      // Optionally re-fetch runs to sync backend state (refresh after a short delay)
      setTimeout(async () => {
        try {
          const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000'
          const refreshResp = await fetch(`${base}/api/v1/runs`)
          if (refreshResp.ok) {
            const apiRuns = await refreshResp.json()
            if (Array.isArray(apiRuns)) {
              const mappedRuns = apiRuns.map((r: RunOut) => ({
                id: r.run_id,
                run_id: r.run_id,
                project_id: r.project_id ?? '',
                status: (r.status as Run['status']) ?? 'queued',
                started_at: r.started_at ?? r.created_at ?? new Date().toISOString(),
                finished_at: r.finished_at ?? undefined,
                duration_ms: r.duration_ms,
                parameters: r.options || {},
                metadata: r.metadata || {},
                created_at: r.created_at ?? new Date().toISOString(),
              }))
              setRuns(mappedRuns)
            }
          }
        } catch {
          // Silently fail; optimistic update already in place
        }
      }, 500)
      
      return createdRun
    } catch (err) {
      // Fallback: create a local in-memory run so the UX still works
      console.warn('Failed to create run via API, falling back to local run:', err)
      const now = new Date().toISOString()
      const id = `run-${Date.now()}`
      const newRun: Run = {
        id,
        run_id: id,
        project_id: projectId,
        status: override?.status ?? 'pending',
        started_at: now,
        finished_at: override?.finished_at ?? undefined,
        duration_ms: override?.duration_ms ?? undefined,
        parameters: override?.parameters ?? { guidance_scale: params.guidance_scale },
        metadata: override?.metadata ?? { brief },
        created_at: now,
      }
      setRuns((s) => [newRun, ...s])
      setActiveView('projects')
      setSelectedProjectId(newRun.project_id)
      return newRun
    }
  }

  const createProject = (name: string, type: string) => {
    const id = `proj-${Date.now()}`
    const newProject: Project = {
      id,
      user_id: 'user-1',
      title: name,
      description: '',
      product_type: (type === 'mous/objet' ? 'other' : (type as Project['product_type'])) ,
      brief: '',
      materials: [],
      constraints: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    setProjects((p) => [newProject, ...p])
    setSelectedProjectId(id)
    setActiveView('projects')
    try { router.push(`/projects/${id}`) } catch {}
  }

  const projectRuns = runs.filter((r) => r.project_id === selectedProjectId)
  const [runVariants, setRunVariants] = useState<Record<string, any[]>>({})
  const [variantsLoading, setVariantsLoading] = useState<boolean>(false)

  async function refreshVariants(runId: string){
    try {
      setVariantsLoading(true)
      const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000'
      const vResp = await fetch(`${base}/api/v1/runs/${runId}/variants`, { cache: 'no-store' })
      if(vResp.ok){
        const arr = await vResp.json()
        setRunVariants(prev => ({...prev, [runId]: arr}))
      }
    } catch(err){
      console.warn('Variants fetch failed', err)
    } finally {
      setVariantsLoading(false)
    }
  }

  useEffect(()=>{
    // Preload variants for the first few runs
    runs.slice(0,3).forEach(r=> refreshVariants(r.run_id))
  },[runs])

  const kpis = useMemo(() => ({
    totalProjects: projects.length,
    totalRuns: runs.length,
    recentStatus: runs[0]?.status ?? '—',
  }), [projects, runs])

  // Simple visual bars for threshold effect
  const sampleValues = [20, 35, 55, 70, 40, 90]

  useEffect(()=>{
    // when selected project changes, initialise editable notes
    setEditingNotes(selectedProject?.description ?? '')
  },[selectedProjectId, selectedProject?.description])

  function statusBadge(status?: Run['status']){
    const s = status ?? 'pending'
    const base = 'inline-block px-2 py-0.5 rounded text-xs font-medium'
    if(s==='pending') return <span className={`${base} bg-amber-100 text-amber-800`}>pending</span>
    if(s==='processing') return <span className={`${base} bg-sky-100 text-sky-800`}>processing</span>
    if(s==='completed') return <span className={`${base} bg-emerald-100 text-emerald-800`}>completed</span>
    return <span className={`${base} bg-red-100 text-red-800`}>{s}</span>
  }

  function formatDuration(ms?: number | null){
    if(!ms) return '—'
    if(ms < 1000) return `${ms} ms`
    return `${Math.round(ms/1000)} s`
  }

  // logo upload (client-only preview)
  const onLogoChange = (file?: File) => {
    if(!file) return
    const url = URL.createObjectURL(file)
    setProjects(prev=> prev.map(p=> p.id===selectedProjectId ? {...p, logo_url: url} : p))
  }

  // sketch upload preview
  const onSketchChange = (file?: File) => {
    setUploadedSketchName(file?.name ?? null)
    if(file){
      const url = URL.createObjectURL(file)
      setUploadedSketchPreview(url)
    } else {
      setUploadedSketchPreview(null)
    }
  }

  const saveNotes = ()=>{
    if(!selectedProjectId) return
    setProjects(prev => prev.map(p=> p.id===selectedProjectId ? {...p, description: editingNotes ?? p.description} : p))
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6" role="main">
      <div className="max-w-7xl mx-auto grid grid-cols-12 gap-6">
        {/* Main content full width with a right sidebar for context */}
        <main className="col-span-12 lg:col-span-8 space-y-6">
          {/* Header with logo, KPI and quick link */}
          <header className="bg-white rounded-xl border border-slate-200 p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-700 rounded-lg flex items-center justify-center text-white font-bold">MK</div>
              <div>
                <h1 className="text-xl font-bold">Tableau de bord</h1>
                <div className="text-sm text-slate-500">{currentTime || '—'}</div>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-sm">
                <div className="font-semibold inline-flex items-center gap-2"><IconChart /> KPI</div>
                <div className="text-xs text-slate-600">Projets: {kpis.totalProjects} · Runs: {kpis.totalRuns}</div>
              </div>
              <Link href="/projects" className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 inline-flex items-center gap-2"><IconFolder /> Ouvrir Projets</Link>
            </div>
          </header>

          {/* Conditional views */}
          {activeView === 'overview' && (
            <section className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="font-bold">Vision globale</h2>
              <p className="mt-2 text-sm text-slate-600">Vue d’ensemble du pipeline (Capture → Normalisation → Génération → DfX → Packaging). Utilisez les étapes ci‑dessous comme guide rapide.</p>

              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold">Étapes</h4>
                  <ol className="list-decimal list-inside text-sm text-slate-700 mt-2">
                    <li>Capture du brief</li>
                    <li>Extraction / Normalisation</li>
                    <li>Prompt Engineering</li>
                    <li>Génération visuelle</li>
                    <li>Génération 3D & optimisation</li>
                  </ol>
                </div>

                <div>
                  <h4 className="font-semibold">Seuil (métrique DfX)</h4>
                  <input type="range" min={0} max={100} value={threshold} onChange={(e)=>setThreshold(Number(e.target.value))} className="w-full" />
                  <div className="mt-3 flex items-end gap-2">
                    {sampleValues.map((v, i) => (
                      <div key={i} className="flex-1">
                        <div style={{height: `${v}px`}} className={`w-full rounded-t ${v>=threshold? 'bg-rose-500':'bg-emerald-400'}`}></div>
                        <div className="text-xs text-center mt-1">{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeView === 'projects' && (
            <section className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex justify-between items-center">
                <h2 className="font-bold">Projets</h2>
                <AddProjectForm onCreate={createProject} />
              </div>

              <div className="mt-4">
                {projects.length === 0 ? <div>Aucun projet</div> : (
                  <ul className="space-y-2">
                    {projects.map(p=> (
                      <li key={p.id} className="p-2 border rounded flex justify-between items-center">
                        <div>
                          <div className="font-semibold">{p.title}</div>
                          <div className="text-xs text-slate-500">Type: {p.product_type} · créé: <ClientTime iso={p.created_at} format="date" /></div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={()=> router.push(`/projects/${p.id}`)} className="px-2 py-1 text-sm bg-slate-100 rounded">Ouvrir</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          )}
          
           </main>

        {/* Right column */}
        <aside className="col-span-12 lg:col-span-4 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h4 className="font-semibold">Runs récents</h4>
            <ul className="mt-2 text-sm space-y-2">
              {runs.slice(0,5).map(r=> {
                const variants = runVariants[r.run_id] || []
                const img = variants[0]?.image_url || variants[0]?.thumbnail_url
                return (
                  <li key={r.id} className="border rounded p-2 text-xs flex gap-2 items-center">
                    {img && <img src={img} alt="thumbnail" className="w-10 h-10 rounded object-cover border" />}
                    <div className="flex-1">
                      <div className="font-mono truncate" title={r.run_id}>{r.run_id}</div>
                      <div className="flex justify-between">
                        <span>{r.status}</span>
                        <span><ClientTime iso={r.created_at} format="time" /></span>
                      </div>
                    </div>
                    <button onClick={()=> refreshVariants(r.run_id)} className="text-[10px] px-2 py-1 bg-slate-100 rounded">↻</button>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h4 className="font-semibold mb-2">Accès rapides</h4>
            <div className="flex flex-col gap-2">
              <Link href="/projects" className="px-3 py-2 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100">Ouvrir Projets</Link>
              <button onClick={()=> setActiveView('projects')} className="px-3 py-2 rounded-md bg-slate-100 hover:bg-slate-200">Créer un projet</button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

function AddProjectForm({onCreate}:{onCreate:(name:string,type:string)=>void}){
  const [name,setName]=useState('')
  const [type,setType]=useState('mous/objet')
  return (
    <div className="flex items-center gap-2">
      <input aria-label="Nom projet" value={name} onChange={e=>setName(e.target.value)} placeholder="Nom projet" className="border rounded px-2 py-1 text-sm" />
      <select aria-label="Type projet" value={type} onChange={e=>setType(e.target.value)} className="border rounded px-2 py-1 text-sm">
        <option value="mous/objet">Souris</option>
        <option value="table">Table</option>
        <option value="montre">Montre</option>
        <option value="meuble">Meuble</option>
        <option value="electronique">Électronique</option>
      </select>
      <button aria-label="Créer projet" onClick={()=>{ if(name.trim()) { onCreate(name,type); setName('') }}} className="px-2 py-1 bg-slate-100 rounded text-sm">Créer</button>
    </div>
  )
}

// Minimal Tabs components to keep everything in one file
function Tabs({children}:{children:React.ReactNode}){
  const [index,setIndex]=useState(0)
  const tabs = React.Children.toArray(children) as React.ReactElement[]
  return (
    <div>
      <div className="flex gap-2" role="tablist" aria-label="Project tabs">
        {tabs.map((t,i)=> (
          <button
            key={i}
            role="tab"
            aria-selected={i===index}
            aria-controls={`tab-panel-${i}`}
            onClick={()=>setIndex(i)}
            className={`px-3 py-1 rounded ${i===index?'bg-slate-100':''}`}
          >{React.isValidElement(t) ? ((t.props as { label?: string }).label ?? `Tab ${i+1}`) : `Tab ${i+1}`}</button>
        ))}
      </div>
      <div className="mt-3">
        <div id={`tab-panel-${index}`} role="tabpanel" aria-labelledby={`tab-${index}`}>
          {tabs[index]}
        </div>
      </div>
    </div>
  )
}
function Tab({children, label: _label}:{children:React.ReactNode, label:string}){ return <div>{children}</div> }

