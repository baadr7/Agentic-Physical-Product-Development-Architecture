import { PageBody, PageHeader } from '@kit/ui/page';
import Link from 'next/link';

export default function HomePage() {
  return (
    <>
      <PageHeader description={'Vision globale'} />

      <PageBody>
        {/* Hero */}
        <section className="mb-8">
          <div className="rounded-2xl p-8 md:p-10 bg-gradient-to-r from-slate-900 to-slate-700 text-white border border-slate-800">
            <h1 className="text-2xl md:text-3xl font-bold mb-2">Vision du projet</h1>
            <p className="text-slate-200 max-w-2xl">
              Concevez, générez et validez vos concepts produits avec un accompagnement DfX dès l’idéation. Centralisez vos projets, lancez des runs en un clic et exportez vos livrables.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/projects" className="inline-flex items-center justify-center bg-white text-slate-900 hover:bg-slate-100 font-semibold px-4 py-2 rounded-lg">
                Ouvrir Projets
              </Link>
              <Link href="/projects/create" className="inline-flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg">
                Créer un projet
              </Link>
            </div>
          </div>
        </section>

        {/* Content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Steps */}
          <aside className="bg-white rounded-xl p-6 border border-slate-200">
            <h2 className="text-lg font-bold mb-3">Démarrage rapide — Flux projet</h2>
            <ol className="list-decimal list-inside space-y-4 text-slate-700">
              <li className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">1. Projets</p>
                  <p className="text-sm text-slate-500">Créez ou ouvrez un projet existant</p>
                </div>
                <Link href="/projects" className="ml-4 inline-block bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-1 rounded-md text-sm font-medium">Ouvrir</Link>
              </li>
              <li className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">2. Détails du projet</p>
                  <p className="text-sm text-slate-500">Renseignez le brief et le contexte</p>
                </div>
                <Link href="/projects/proj-1" className="ml-4 inline-block bg-emerald-50 hover:bg-emerald-100 text-emerald-600 px-3 py-1 rounded-md text-sm font-medium">Voir</Link>
              </li>
              <li className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">3. Générer</p>
                  <p className="text-sm text-slate-500">Lancez une génération (LLM + DfX)</p>
                </div>
                <Link href="/projects/proj-1/generate" className="ml-4 inline-block bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-1 rounded-md text-sm font-medium">Générer</Link>
              </li>
              <li className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">4. Résultats & DfX</p>
                  <p className="text-sm text-slate-500">Analysez les variantes, scores et exports</p>
                </div>
                <div className="flex gap-2">
                  <Link href="/projects/proj-1/results" className="inline-block bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-1 rounded-md text-sm font-medium">Résultats</Link>
                  <Link href="/projects/proj-1/dfx" className="inline-block bg-purple-50 hover:bg-purple-100 text-purple-600 px-3 py-1 rounded-md text-sm font-medium">DfX</Link>
                </div>
              </li>
            </ol>
          </aside>

          {/* Right column: Welcome + Quick Access */}
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl p-6 border border-slate-200">
              <h3 className="text-lg font-bold mb-2">Bienvenue</h3>
              <p className="text-sm text-slate-600">Gérez vos projets, lancez des générations et analysez les résultats DfX. Utilisez la barre latérale pour naviguer entre “Projets”, “Générer”, “Résultats” et “DfX”.</p>
            </div>
            <div className="bg-white rounded-xl p-6 border border-slate-200">
              <h3 className="text-lg font-bold mb-2">Accès rapide</h3>
              <div className="flex flex-col gap-2">
                <Link href="/projects" className="inline-flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg">Ouvrir Projets</Link>
                <Link href="/projects/create" className="inline-flex items-center justify-center bg-slate-900 hover:bg-slate-800 text-white font-semibold px-4 py-2 rounded-lg">Créer un projet</Link>
              </div>
            </div>
          </div>
        </div>
      </PageBody>
    </>
  );
}
