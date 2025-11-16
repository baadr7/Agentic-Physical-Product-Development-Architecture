"use client"

import React, { useMemo, useState, useEffect } from 'react'
import { MOCK_PROJECTS as INITIAL_PROJECTS, MOCK_RUNS as INITIAL_RUNS, MOCK_VARIANTS } from '~/lib/mock-data'
import { Run, Project } from '~/lib/types'

type View = 'overview' | 'projects' | 'project-details' | 'generate' | 'results' | 'dfx'

export default function DashboardClient() {
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
        const runsResp = await fetch('http://localhost:8000/api/v1/runs')
        if (runsResp.ok) {
          const apiRuns = await runsResp.json()
          if (Array.isArray(apiRuns)) {
            // Map API runs to our Run type; keep optimistic local adds
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
      const payload = {
        project_id: projectId,
        input_mode: override?.metadata?.input_mode ?? (generateMode || 'text'),
        description: override?.metadata?.brief ?? brief,
        options: override?.parameters ?? params,
      }

      const res = await fetch('http://localhost:8000/api/v1/runs', {
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

      // Prepend the created run and switch to project details
      setRuns((s) => [createdRun, ...s])
      setActiveView('project-details')
      setSelectedProjectId(createdRun.project_id)
      
      // Optionally re-fetch runs to sync backend state (refresh after a short delay)
      setTimeout(async () => {
        try {
          const refreshResp = await fetch('http://localhost:8000/api/v1/runs')
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
      setActiveView('project-details')
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
    setActiveView('project-details')
  }

  const projectRuns = runs.filter((r) => r.project_id === selectedProjectId)
  const lastRun = projectRuns[0] ?? null
  const [variants, setVariants] = useState<any[]>([])
  const [variantsLoading, setVariantsLoading] = useState(false)
  const [prompts, setPrompts] = useState<any[]>([])
  const [fullLoading, setFullLoading] = useState(false)

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
        {/* Left navigation (narrower, more to the left) */}
        <aside className="col-span-2" role="complementary" aria-label="Sidebar navigation">
          <div className="bg-white rounded-lg shadow p-4 sticky top-6">
            <h3 className="text-sm font-semibold mb-4">Navigation</h3>
            <nav className="flex flex-col space-y-2" role="navigation" aria-label="Dashboard navigation">
              <button 
                onClick={() => setActiveView('overview')} 
                className={`text-left px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 ${activeView==='overview'?'bg-slate-100':''}`}
                aria-current={activeView==='overview' ? 'page' : undefined}
              >Vision globale</button>
              <button 
                onClick={() => setActiveView('projects')} 
                className={`text-left px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 ${activeView==='projects'?'bg-slate-100':''}`}
                aria-current={activeView==='projects' ? 'page' : undefined}
              >Projets</button>
              <button 
                onClick={() => setActiveView('project-details')} 
                className={`text-left px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 ${activeView==='project-details'?'bg-slate-100':''}`}
                aria-current={activeView==='project-details' ? 'page' : undefined}
              >Détails du projet</button>
              <button 
                onClick={() => setActiveView('generate')} 
                className={`text-left px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 ${activeView==='generate'?'bg-slate-100':''}`}
                aria-current={activeView==='generate' ? 'page' : undefined}
              >Générer</button>
              <button 
                onClick={() => setActiveView('results')} 
                className={`text-left px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 ${activeView==='results'?'bg-slate-100':''}`}
                aria-current={activeView==='results' ? 'page' : undefined}
              >Résultats</button>
              <button 
                onClick={() => setActiveView('dfx')} 
                className={`text-left px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 ${activeView==='dfx'?'bg-slate-100':''}`}
                aria-current={activeView==='dfx' ? 'page' : undefined}
              >DfX</button>
            </nav>

            <div className="mt-6">
              <button 
                onClick={() => addRun()} 
                className="w-full bg-indigo-600 text-white px-3 py-2 rounded hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                aria-label="Create a new run"
              >Ajouter un run</button>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="col-span-7 space-y-6">
          {/* Header with logo, date/time, KPI and key lines */}
          <header className="bg-white rounded-lg shadow p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-600 rounded flex items-center justify-center text-white font-bold">MK</div>
              <div>
                <h1 className="text-lg font-bold">Tableau de bord</h1>
                <div className="text-sm text-slate-500">{currentTime || '—'}</div>
              </div>
            </div>

            <div className="flex gap-8 items-center">
              <div className="text-sm">
                <div className="font-semibold">KPI</div>
                <div className="text-xs text-slate-600">Projects: {kpis.totalProjects} · Runs: {kpis.totalRuns}</div>
              </div>
              <div className="hidden md:block text-sm text-slate-700">
                <div>• Exploration créative facilitée</div>
                <div>• Support DfX dès génération</div>
                <div>• Export STL/PDF</div>
              </div>
            </div>
          </header>

          {/* Conditional views */}
          {activeView === 'overview' && (
            <section className="bg-white rounded-lg shadow p-4">
              <h2 className="font-bold">Vision globale</h2>
              <p className="mt-2 text-sm text-slate-600">Résumé et pipeline (1. Capture → ... → 9. Packaging). Voir étapes ci-dessous.</p>

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
                  <h4 className="font-semibold">Seuil (ex: métrique DfX)</h4>
                  <input type="range" min={0} max={100} value={threshold} onChange={(e)=>setThreshold(Number(e.target.value))} className="w-full" />
                  <div className="mt-3 flex items-end gap-2">
                    {sampleValues.map((v, i) => (
                      <div key={i} className="flex-1">
                        <div style={{height: `${v}px`}} className={`w-full rounded-t ${v>=threshold? 'bg-red-500':'bg-green-400'}`}></div>
                        <div className="text-xs text-center mt-1">{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeView === 'projects' && (
            <section className="bg-white rounded-lg shadow p-4">
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
                          <button onClick={()=>{setSelectedProjectId(p.id); setActiveView('project-details')}} className="px-2 py-1 text-sm bg-slate-100 rounded">Ouvrir</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          )}

          {activeView === 'project-details' && selectedProject && (
            <section className="bg-white rounded-lg shadow p-4">
              <div className="flex justify-between items-start">
                  <div>
                    <h2 className="font-bold">Détails — {selectedProject.title}</h2>
                    <div className="text-xs text-slate-500 mt-1">Type: {selectedProject.product_type} · Dernier run: {lastRun ? <ClientTime iso={lastRun.created_at} format="datetime" /> : '—'}</div>
                  </div>
                  <div className="text-sm text-slate-600">Runs: {projectRuns.length}</div>
                </div>

              <div className="mt-4">
                <Tabs>
                  <Tab key="overview" label="Overview">
                      {/* True overview: logo + date/time + KPI + 3-5 key lines */}
                      <div className="mt-2 grid grid-cols-3 gap-3 items-start">
                        <div className="p-3 bg-slate-50 rounded flex items-center justify-center">
                          {/* Logo or placeholder */}
                          {selectedProject?.logo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={selectedProject.logo_url} alt="logo" className="w-16 h-16 object-cover rounded" />
                          ) : (
                            <div className="w-16 h-16 bg-indigo-600 rounded flex items-center justify-center text-white font-bold">{(selectedProject?.title||'P').slice(0,1)}</div>
                          )}
                        </div>

                        <div className="p-3 bg-slate-50 rounded">
                          <div className="text-xs text-slate-500">Date / Heure</div>
                          <div className="mt-1 font-medium">{lastRun ? new Date(lastRun.created_at).toLocaleString() : (selectedProject ? new Date(selectedProject.created_at).toLocaleString() : new Date().toLocaleString())}</div>
                          <div className="mt-2 text-xs text-slate-600">Dernière MAJ: {selectedProject ? <ClientTime iso={selectedProject.updated_at} format="datetime" /> : '—'}</div>
                        </div>

                        <div className="p-3 bg-slate-50 rounded">
                          <div className="text-xs text-slate-500">KPI</div>
                          <div className="mt-1 font-medium">Runs: {projectRuns.length}</div>
                          <div className="mt-1 text-xs text-slate-600">Statut récent: {projectRuns[0]?.status ?? '—'}</div>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-2 text-sm text-slate-700">
                        <div><strong>Brief:</strong> {selectedProject?.brief ?? '—'}</div>
                        <div><strong>Matériaux:</strong> {(selectedProject?.materials || []).slice(0,3).join(', ') || '—'}</div>
                        <div><strong>Contraintes:</strong> {selectedProject && Object.keys(selectedProject.constraints || {}).length>0 ? Object.entries(selectedProject.constraints!).slice(0,3).map(([k,v])=> `${k}: ${v}`).join(' · ') : '—'}</div>
                        <div><strong>Type produit:</strong> {selectedProject?.product_type ?? '—'}</div>
                      </div>

                      <div className="mt-4">
                        <div className="text-sm font-semibold">Notes clés (éditable)</div>
                        <textarea value={editingNotes} onChange={(e)=>setEditingNotes(e.target.value)} className="w-full border rounded p-2 mt-2" rows={3} />
                        <div className="mt-2 flex gap-2">
                          <button onClick={saveNotes} className="px-3 py-1 bg-indigo-600 text-white rounded text-sm">Enregistrer</button>
                          <label className="px-3 py-1 bg-slate-100 rounded text-sm cursor-pointer">
                            Changer logo
                            <input type="file" accept="image/*" onChange={(e)=>onLogoChange(e.target.files?.[0])} className="hidden" />
                          </label>
                        </div>
                      </div>
                  </Tab>
                  <Tab key="runs" label="Runs">
                    <h4 className="font-semibold">Runs</h4>
                    <div className="mt-2">
                      <button onClick={()=>addRun({}, selectedProject.id)} className="px-3 py-2 bg-indigo-600 text-white rounded">Ajouter run (project)</button>
                    </div>
                    <div className="mt-3">
                      {projectRuns.length===0? <div className="text-sm text-slate-500">Aucun run</div> : (
                        <table className="w-full text-sm">
                          <thead className="text-left text-slate-500">
                            <tr><th>run_id</th><th>durée</th><th>statut</th><th>créé</th></tr>
                          </thead>
                          <tbody>
                            {projectRuns.map(r=> (
                              <tr key={r.id} className="border-t">
                                <td className="py-2">{r.run_id}</td>
                                <td className="py-2">{formatDuration(r.duration_ms)}</td>
                                <td className="py-2">{statusBadge(r.status)}</td>
                                <td className="py-2 text-xs text-slate-500"><ClientTime iso={r.created_at} format="datetime" /></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                    <div className="mt-6">
                      <h5 className="font-semibold mb-2">Variants (dernier run)</h5>
                      <button
                        disabled={!lastRun || variantsLoading}
                        onClick={async ()=> {
                          if(!lastRun) return
                          setVariantsLoading(true)
                          try {
                            const resp = await fetch(`http://localhost:8000/api/v1/runs/${lastRun.run_id}/variants`)
                            if(resp.ok){
                              const data = await resp.json()
                              if(Array.isArray(data)) setVariants(data)
                            }
                          } catch(e){ /* silent */ }
                          setVariantsLoading(false)
                        }}
                        className="px-2 py-1 bg-slate-100 rounded text-xs"
                      >{variantsLoading? 'Chargement...' : 'Rafraîchir variants'}</button>
                      {variants.length === 0 && <div className="text-xs text-slate-500 mt-2">Aucun variant chargé</div>}
                      {variants.length > 0 && (
                        <table className="w-full text-xs mt-2">
                          <thead className="text-left text-slate-500">
                            <tr>
                              <th>id</th><th>score</th><th>Fab.</th><th>Ass.</th><th>Sust.</th>
                            </tr>
                          </thead>
                          <tbody>
                            {variants.map(v=> (
                              <tr key={v.id} className="border-t">
                                <td className="py-1">{v.id.slice(0,8)}</td>
                                <td className="py-1">{v.score ?? '—'}</td>
                                <td className="py-1">{v.fabricability_score ?? '—'}</td>
                                <td className="py-1">{v.assemblability_score ?? '—'}</td>
                                <td className="py-1">{v.sustainability_score ?? '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                      <div className="mt-4">
                        <h5 className="font-semibold mb-2">Prompts (dernier run)</h5>
                        <button
                          disabled={!lastRun || fullLoading}
                          onClick={async ()=> {
                            if(!lastRun) return
                            setFullLoading(true)
                            try {
                              const resp = await fetch(`http://localhost:8000/api/v1/runs/${lastRun.run_id}/full`)
                              if(resp.ok){
                                const data = await resp.json()
                                setPrompts(Array.isArray(data.prompts)? data.prompts : [])
                                if(Array.isArray(data.variants)) setVariants(data.variants)
                              }
                            } catch(e){ /* silent */ }
                            setFullLoading(false)
                          }}
                          className="px-2 py-1 bg-slate-100 rounded text-xs mr-2"
                        >{fullLoading? 'Chargement...' : 'Rafraîchir full'}</button>
                        {prompts.length === 0 && <div className="text-xs text-slate-500">Aucun prompt chargé</div>}
                        {prompts.length > 0 && (
                          <ul className="text-xs mt-2 space-y-1 max-h-32 overflow-auto border rounded p-2 bg-slate-50">
                            {prompts.map(p=> (
                              <li key={p.id} className="leading-snug"><span className="text-slate-500">•</span> {p.prompt_text}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </Tab>
                  <Tab key="files" label="Files">
                    <div className="text-sm text-slate-600">Onglets de fichiers (ouvrir dans des onglets séparés)</div>
                    <div className="mt-2 flex gap-2">
                      <button className="px-2 py-1 bg-slate-100 rounded">Fichier A</button>
                      <button className="px-2 py-1 bg-slate-100 rounded">Fichier B</button>
                    </div>
                  </Tab>
                </Tabs>
              </div>
            </section>
          )}

          {activeView === 'generate' && (
            <section className="bg-white rounded-lg shadow p-4">
              <h2 className="font-bold">Générer</h2>
              <div className="mt-3 grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium">Mode</label>
                  <div className="mt-2 flex gap-2">
                    <label className={`px-3 py-2 border rounded cursor-pointer ${generateMode==='text'?'bg-slate-100':''}`}>
                      <input type="radio" name="mode" checked={generateMode==='text'} onChange={()=>setGenerateMode('text')} /> Texte
                    </label>
                    <label className={`px-3 py-2 border rounded cursor-pointer ${generateMode==='sketch'?'bg-slate-100':''}`}>
                      <input type="radio" name="mode" checked={generateMode==='sketch'} onChange={()=>setGenerateMode('sketch')} /> Sketch
                    </label>
                  </div>

                  {generateMode==='sketch' && (
                    <div className="mt-3">
                      <label className="block text-sm">Importer sketch</label>
                      <input type="file" accept="image/*,.sketch" onChange={(e)=>onSketchChange(e.target.files?.[0])} className="mt-2" />
                      {uploadedSketchName && <div className="text-sm text-slate-600 mt-1">Fichier: {uploadedSketchName}</div>}
                      {uploadedSketchPreview && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={uploadedSketchPreview} alt="preview" className="mt-2 h-40 object-contain border rounded" />
                      )}
                    </div>
                  )}

                  <div className="mt-3">
                    <label className="block text-sm">Brief / Description</label>
                    <textarea value={brief} onChange={(e)=>setBrief(e.target.value)} className="mt-2 w-full border rounded p-2" rows={4} />
                  </div>
                </div>

                <div>
                  <label className="block text-sm">Matériau</label>
                  <select value={material} onChange={(e)=>setMaterial(e.target.value)} className="mt-2 w-full border rounded p-2">
                    <option>PLA</option>
                    <option>ABS</option>
                    <option>Aluminium</option>
                    <option>Acier</option>
                    <option>Bois</option>
                  </select>

                  <div className="mt-4">
                    <label className="block text-sm">Guidance scale: {params.guidance_scale}</label>
                    <input type="range" min={1} max={20} value={params.guidance_scale} onChange={(e)=>setParams(p=>({...p, guidance_scale: Number(e.target.value)}))} className="w-full" />
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm">Steps: {params.steps}</label>
                    <input type="range" min={1} max={100} value={params.steps} onChange={(e)=>setParams(p=>({...p, steps: Number(e.target.value)}))} className="w-full" />
                  </div>

                  <div className="mt-4">
                    <button onClick={()=> addRun({status:'pending'}, undefined)} className="px-3 py-2 bg-indigo-600 text-white rounded">Lancer génération</button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeView === 'results' && (
            <section className="bg-white rounded-lg shadow p-4">
              <h2 className="font-bold">Résultats</h2>
              <div className="mt-3 grid grid-cols-3 gap-3">
                {(MOCK_VARIANTS || []).slice(0,6).map(v=> (
                  <div key={v.id} className="p-2 border rounded">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={v.thumbnail_url} alt={`variant-${v.id}`} className="h-32 w-full object-cover" />
                    <div className="text-sm mt-2">{v.id}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {activeView === 'dfx' && (
            <section className="bg-white rounded-lg shadow p-4">
              <h2 className="font-bold">DfX — Résumé automatique</h2>
              <div className="mt-2 text-sm text-slate-700">Score estimé: 72 / 100</div>
              <ul className="mt-2 list-disc list-inside text-sm">
                <li>Fabricabilité: moyenne</li>
                <li>Assemblabilité: bonne</li>
                <li>Sustainability: à améliorer</li>
              </ul>
            </section>
          )}
        </main>

        {/* Right column */}
        <aside className="col-span-3">
          <div className="bg-white rounded-lg shadow p-4 sticky top-6">
            <h4 className="font-semibold">Résumé DfX</h4>
            <p className="mt-2 text-sm text-slate-600">Score estimé: —</p>
            <p className="mt-1 text-sm text-slate-600">Recommandations: —</p>
          </div>

          <div className="bg-white rounded-lg shadow p-4 mt-4">
            <h4 className="font-semibold">Runs récents</h4>
              <ul className="mt-2 text-sm space-y-2">
              {runs.slice(0,5).map(r=> (
                <li key={r.id} className="border rounded p-2 text-xs">{r.run_id} · {r.status} · <ClientTime iso={r.created_at} format="time" /></li>
              ))}
            </ul>
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

