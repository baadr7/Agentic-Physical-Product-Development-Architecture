'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MOCK_PROJECT } from '~/lib/mock-data';
import { Project, Run } from '~/lib/types';
import { apiDeleteProject, apiGetProject, apiGetRuns, apiPresignExportUrl, apiReportPdfUrl } from '~/lib/api/fastapi';

export default function ProjectPageClient({ projectId }: { projectId: string }) {
  const router = useRouter();
  // Use mock project but set id from route param so links work
  const [project, setProject] = useState<Project>({ ...MOCK_PROJECT, id: projectId });
  const [runs, setRuns] = useState<Run[]>([]);
  const [_selectedPerson, _setSelectedPerson] = useState('Moi');
  const [activeTab, setActiveTab] = useState<'overview' | 'files' | 'activity'>('overview');
  const [threshold, setThreshold] = useState<number>(500);
  const [loading, setLoading] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        // Try to fetch real project; fall back to mock if unavailable
        try {
          const p = await apiGetProject(projectId);
          if (p && mounted) setProject(p as Project);
        } catch {
          // ignore and keep mock
        }
        const all = await apiGetRuns();
        // Filter by project and sort by created_at desc if present
        const filtered = (all || [])
          .filter((r: any) => (r.project_id || r.projectId) === projectId)
          .map((r: any) => ({
            id: r.id || r.run_id,
            run_id: r.run_id || r.id,
            project_id: r.project_id || r.projectId || projectId,
            status: r.status || 'queued',
            started_at: r.started_at || r.created_at || new Date().toISOString(),
            finished_at: r.finished_at,
            duration_ms: r.duration_ms,
            parameters: r.options || r.parameters || {},
            metadata: r.metadata || {},
            created_at: r.created_at || r.started_at || new Date().toISOString(),
          })) as Run[];
        filtered.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
        if (mounted) setRuns(filtered);
      } catch (e) {
        console.error('Failed to load runs', e);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [projectId]);

  const totalRuns = runs.length;
  const completedRuns = runs.filter((r) => r.status === 'completed').length;
  const avgDuration = useMemo(() => {
    if (!runs.length) return 0;
    const ms = runs.reduce((s, r) => s + (r.duration_ms || 0), 0) / runs.length;
    return Math.round(ms);
  }, [runs]);

  // Run creation is handled from the Générer page; this page links to it.

  const chartData = runs.map((r) => ({ id: r.run_id, value: r.duration_ms || 0 }));
  const latestCompleted = runs.find((r) => r.status === 'completed');
  const latestRunId = latestCompleted?.run_id || runs[0]?.run_id;

  const handleDeleteProject = async () => {
    setDeleteError(null);
    const ok = window.confirm(`Supprimer le projet "${project.title}" ?\n\nCette action est irréversible.`);
    if (!ok) return;
    try {
      setDeleting(true);
      await apiDeleteProject(projectId);
      router.push('/projects');
      router.refresh();
    } catch (e: any) {
      setDeleteError(e?.message || 'Erreur lors de la suppression du projet');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header area: logo + title + datetime + action */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-slate-900 text-white rounded-md flex items-center justify-center font-bold">MK</div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{project.title}</h1>
              <p className="text-xs text-slate-500">{new Date().toLocaleString('fr-FR')}</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
              <div className="text-right">
              <div className="text-xs text-slate-500">Runs</div>
              <div className="font-bold text-xl text-indigo-700">{totalRuns}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500">Terminés</div>
              <div className="font-bold text-xl text-emerald-600">{completedRuns}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500">Durée Moy.</div>
              <div className="font-bold text-xl">{avgDuration} ms</div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href={`/projects/${projectId}/generate`}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-semibold"
              >
                Générer
              </Link>
              <Link
                href={`/projects/${projectId}/results`}
                className="bg-slate-100 hover:bg-slate-200 text-slate-900 px-4 py-2 rounded-md text-sm font-semibold"
              >
                Résultats
              </Link>
              <button
                onClick={handleDeleteProject}
                disabled={deleting}
                className="bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white px-4 py-2 rounded-md text-sm font-semibold"
              >
                {deleting ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {deleteError && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded">
            {deleteError}
          </div>
        )}
        {/* Main overview */}
        <section>
          {/* Vision globale */}
          <div className="bg-white rounded-lg p-6 border border-slate-200 mb-6">
            <h2 className="text-xl font-bold mb-2">Vision globale</h2>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">
              Ce projet vise à développer une plateforme SaaS permettant à des designers, ingénieurs ou étudiants de générer, itérer et valider des concepts produits (multicatégorie) à partir d’entrées naturelles (texte) ou graphiques (sketch). L’objectif principal est de rapprocher l’idéation de la validité industrielle en incorporant des règles DfX dès la phase de génération.
            </p>
            <div className="mt-4 text-sm text-slate-700">
              <strong>Principaux objectifs :</strong>
              <ul className="list-disc list-inside mt-2">
                <li>Faciliter l’exploration créative (variantes visuelles, 3D).</li>
                <li>Fournir une analyse DfX et des métriques physiques.</li>
                <li>Assurer la traçabilité et l’exportabilité (STL/STEP, PDF).</li>
                <li>Déploiement modulaire frontend/backend/ML.</li>
              </ul>
            </div>
            <div className="mt-4 text-sm text-slate-600">
              <details>
                <summary className="font-semibold cursor-pointer">Étapes clés du flux (voir plus)</summary>
                <ol className="list-decimal list-inside mt-2 space-y-1">
                  <li>Capture du brief (texte + champs structurés).</li>
                  <li>Normalisation / Extraction via LLM.</li>
                  <li>Prompt engineering pour diversité + contraintes DfX.</li>
                  <li>Génération visuelle (text2image / sketch2image).</li>
                  <li>Génération 3D paramétrique et optimisation optionnelle.</li>
                  <li>Meshing & FEM, scoring et packaging (exports).</li>
                </ol>
              </details>
            </div>
          </div>

          {/* Tabs + Overview content */}
          <div className="bg-white rounded-t-lg p-3 border-x border-t border-slate-200 flex gap-3 sticky top-0 z-10">
            <button onClick={() => setActiveTab('overview')} className={`px-4 py-2 rounded-md ${activeTab==='overview' ? 'bg-indigo-50 text-indigo-900 font-semibold' : 'hover:bg-slate-50'}`}>Vision & KPI</button>
            <button onClick={() => setActiveTab('files')} className={`px-4 py-2 rounded-md ${activeTab==='files' ? 'bg-indigo-50 text-indigo-900 font-semibold' : 'hover:bg-slate-50'}`}>Fichiers</button>
            <button onClick={() => setActiveTab('activity')} className={`px-4 py-2 rounded-md ${activeTab==='activity' ? 'bg-indigo-50 text-indigo-900 font-semibold' : 'hover:bg-slate-50'}`}>Activité</button>
          </div>

          <div className="bg-white rounded-b-lg p-6 border border-slate-200">
            {activeTab === 'overview' && (
              <>
                <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-slate-50 rounded-md">
                    <p className="text-sm text-slate-500">KPI</p>
                    <p className="font-bold text-xl">{project.title}</p>
                    <p className="text-sm text-slate-600 mt-2">{project.description}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-md">
                    <p className="text-sm text-slate-500">Dernière mise à jour</p>
                    <p className="font-semibold">{new Date().toLocaleString()}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-md">
                    <p className="text-sm text-slate-500">Résumé</p>
                    <p className="text-sm text-slate-600">Exploration & DfX intégrés</p>
                  </div>
                </div>

                {/* Chart */}
                <div className="mb-6">
                  <h4 className="font-semibold mb-2">Durée des runs (ms)</h4>
                  <div className="flex items-end gap-2 h-40">
                    {chartData.slice(0, 20).map((d) => {
                      const height = Math.min(100, Math.round((d.value / 2000) * 100));
                      const isAbove = d.value > threshold;
                      return (
                        <div key={d.id} title={`${d.id}: ${d.value}ms`} className="flex flex-col items-center">
                          <div style={{height: `${height}%`}} className={`w-6 rounded-t-md ${isAbove ? 'bg-rose-500' : 'bg-blue-500'}`} />
                          <div className="text-xs mt-2 font-mono">{d.value}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Runs list + Report area */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="lg:col-span-2">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold">Runs</h4>
                      <div className="text-sm text-slate-500">Total: {runs.length}</div>
                    </div>
                    <div className="overflow-auto border rounded-md">
                      <table className="w-full text-left text-sm border-collapse">
                        <thead>
                          <tr className="border-b bg-slate-50">
                            <th className="py-2 px-3">run_id</th>
                            <th className="py-2 px-3">Durée (ms)</th>
                            <th className="py-2 px-3">Statut</th>
                            <th className="py-2 px-3">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {runs.map((r) => (
                            <tr key={r.run_id} className="border-b hover:bg-slate-50">
                              <td className="py-2 px-3 font-mono">{r.run_id}</td>
                              <td className="py-2 px-3">{r.duration_ms ?? '-'}</td>
                              <td className="py-2 px-3">
                                <span className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold
                                  ${r.status === 'completed' ? 'bg-green-100 text-green-800' :
                                     r.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                                     r.status === 'failed' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-800'}`}>
                                  <span className={`h-2 w-2 rounded-full
                                    ${r.status === 'completed' ? 'bg-green-500' :
                                       r.status === 'processing' ? 'bg-yellow-500 animate-pulse' :
                                       r.status === 'failed' ? 'bg-rose-500' : 'bg-slate-400'}`}/>
                                  {r.status === 'completed' ? 'Terminé' : r.status === 'processing' ? 'En cours' : r.status === 'failed' ? 'Erreur' : 'En attente'}
                                </span>
                              </td>
                              <td className="py-2 px-3">
                                <a href={`/projects/${projectId}/results`} className="text-blue-600 hover:underline">Voir</a>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="lg:col-span-1">
                    <div className="p-4 bg-slate-50 rounded-md h-full flex flex-col">
                      <h5 className="font-semibold mb-2">Rapport</h5>
                      <p className="text-sm text-slate-600 mb-3">Aperçu rapide des métriques DfX et export.</p>
                      <div className="mt-auto">
                        {latestRunId ? (
                          <a
                            href={apiReportPdfUrl(latestRunId)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md mb-2"
                          >
                            📄 Télécharger Rapport
                          </a>
                        ) : (
                          <button disabled className="w-full bg-slate-300 text-white py-2 rounded-md mb-2">📄 Rapport indisponible</button>
                        )}
                        <button
                          disabled={!latestRunId || exporting}
                          onClick={async () => {
                            if (!latestRunId) return;
                            try {
                              setExporting(true);
                              // Request a presigned ZIP export as a placeholder
                              const r = await fetch(apiPresignExportUrl(), {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ run_id: latestRunId, kind: 'zip' }),
                              });
                              if (r.ok) {
                                const data = await r.json();
                                const url = data.url || data.signedURL || data.signedUrl;
                                if (url) window.open(url, '_blank');
                              } else {
                                console.error('Presign export failed', r.status);
                              }
                            } catch (e) {
                              console.error('Export error', e);
                            } finally {
                              setExporting(false);
                            }
                          }}
                          className={`w-full ${latestRunId ? 'bg-green-600 hover:bg-green-700' : 'bg-slate-300'} text-white py-2 rounded-md`}
                        >
                          {exporting ? '⏳ Export…' : '📦 Export STL/STEP'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'files' && (
              <div>
                <h4 className="font-semibold mb-3">Fichiers</h4>
                <p className="text-sm text-slate-600 mb-2">Aperçu des fichiers source, images et modèles 3D.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-md">Logo: <strong>MK</strong></div>
                  <div className="p-4 bg-slate-50 rounded-md">Date/Heure: {new Date().toLocaleString()}</div>
                </div>
              </div>
            )}

            {activeTab === 'activity' && (
              <div>
                <h4 className="font-semibold mb-3">Activity Feed</h4>
                <ul className="space-y-2 text-sm text-slate-700">
                  {runs.slice(0, 10).map((r) => (
                    <li key={r.run_id} className="p-2 bg-slate-50 rounded-md">
                      <div className="flex justify-between">
                        <div className="font-mono">{r.run_id}</div>
                        <div className="text-xs text-slate-500">{r.status}</div>
                      </div>
                      <div className="text-xs">Durée: {r.duration_ms ?? '-'} ms</div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
