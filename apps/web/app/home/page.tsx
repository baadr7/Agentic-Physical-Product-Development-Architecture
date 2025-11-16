import { PageBody, PageHeader } from '@kit/ui/page';
import Link from 'next/link';
import { DashboardDemo } from '~/home/_components/dashboard-demo';

export default function HomePage() {
  return (
    <>
      <PageHeader description={'Your SaaS at a glance'} />

      <PageBody>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Quick Start Steps */}
          <aside className="bg-white rounded-lg shadow-sm p-6 border border-slate-200">
            <h2 className="text-xl font-bold mb-3">Démarrage rapide — Step by step</h2>
            <ol className="list-decimal list-inside space-y-4 text-slate-700">
              <li>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">1. Accueil</p>
                    <p className="text-sm text-slate-500">Page d&apos;accueil du produit</p>
                  </div>
                  <Link
                    href="/"
                    className="ml-4 inline-block bg-slate-50 hover:bg-slate-100 text-slate-700 px-3 py-1 rounded-md text-sm font-medium"
                  >
                    Aller
                  </Link>
                </div>
              </li>

              <li>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">2. Projets</p>
                    <p className="text-sm text-slate-500">Liste des projets et accès au dashboard</p>
                  </div>
                  <Link
                    href="/projects"
                    className="ml-4 inline-block bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-1 rounded-md text-sm font-medium"
                  >
                    Ouvrir
                  </Link>
                </div>
              </li>

              <li>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">3. Détails du projet</p>
                    <p className="text-sm text-slate-500">Ouvrir le projet d&apos;exemple (proj-1)</p>
                  </div>
                  <Link
                    href="/projects/proj-1"
                    className="ml-4 inline-block bg-emerald-50 hover:bg-emerald-100 text-emerald-600 px-3 py-1 rounded-md text-sm font-medium"
                  >
                    Voir
                  </Link>
                </div>
              </li>

              <li>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">4. Générer</p>
                    <p className="text-sm text-slate-500">Lancer une génération depuis le projet</p>
                  </div>
                  <Link
                    href="/projects/proj-1/generate"
                    className="ml-4 inline-block bg-green-50 hover:bg-green-100 text-green-600 px-3 py-1 rounded-md text-sm font-medium"
                  >
                    Générer
                  </Link>
                </div>
              </li>

              <li>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">5. Résultats & DfX</p>
                    <p className="text-sm text-slate-500">Voir la galerie, le tableau et l&apos;analyse DfX</p>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href="/projects/proj-1/results"
                      className="inline-block bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-1 rounded-md text-sm font-medium"
                    >
                      Résultats
                    </Link>
                    <Link
                      href="/projects/proj-1/dfx"
                      className="inline-block bg-purple-50 hover:bg-purple-100 text-purple-600 px-3 py-1 rounded-md text-sm font-medium"
                    >
                      DfX
                    </Link>
                  </div>
                </div>
              </li>
            </ol>

            <div className="mt-6 text-sm text-slate-500">
              <p className="font-medium">Conseil :</p>
              <p className="mt-1">Suivez les étapes dans l&apos;ordre pour un premier flux complet (création → génération → évaluation).</p>
            </div>
          </aside>

          {/* Center: Dashboard preview */}
          <div className="lg:col-span-2">
            <DashboardDemo />
          </div>
        </div>
      </PageBody>
    </>
  );
}
