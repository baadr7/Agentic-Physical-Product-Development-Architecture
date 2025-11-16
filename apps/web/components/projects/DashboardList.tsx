'use client';

import Link from 'next/link';
import { useState } from 'react';
import { MOCK_PROJECTS } from '~/lib/mock-data';
import type { Project } from '~/lib/types';

export function DashboardList() {
  const [projects] = useState<Project[]>(MOCK_PROJECTS);

  const getProductTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      furniture: '🪑 Mobilier',
      electronics: '📱 Électronique',
      mechanical: '⚙️ Mécanique',
      other: '📦 Autre',
    };
    return labels[type] || type;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-slate-900">Projets</h1>
              <p className="text-slate-600 mt-1">
                Gérez vos concepts produits avec intelligence IA
              </p>
            </div>
            <Link
              href="/projects/create"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition"
            >
              + Nouveau Projet
            </Link>
          </div>
        </div>
      </header>

      {/* Projects Grid */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        {projects.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-500 text-lg">Aucun projet. Créez-en un pour commencer !</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project: Project) => (
              <div
                key={project.id}
                className="bg-white rounded-lg shadow-md hover:shadow-lg transition border border-slate-200 overflow-hidden"
              >
                <div className="p-6">
                  {/* Title */}
                  <h3 className="text-xl font-bold text-slate-900 mb-2">
                    {project.title}
                  </h3>

                  {/* Type Badge */}
                  <div className="inline-block bg-slate-100 text-slate-700 text-sm px-3 py-1 rounded-full mb-4">
                    {getProductTypeLabel(project.product_type)}
                  </div>

                  {/* Description */}
                  <p className="text-slate-600 text-sm mb-4 line-clamp-2">
                    {project.description}
                  </p>

                  {/* KPIs (mock) */}
                  <div className="grid grid-cols-3 gap-2 mb-4 text-center py-2 bg-slate-50 rounded-lg">
                    <div>
                      <p className="text-xs text-slate-500">Runs</p>
                      <p className="font-bold text-slate-900">3</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Score</p>
                      <p className="font-bold text-blue-600">8.7</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Status</p>
                      <p className="font-bold text-green-600">✓</p>
                    </div>
                  </div>

                  {/* Date */}
                  <p className="text-xs text-slate-400 mb-4">
                    Créé {new Date(project.created_at).toLocaleDateString('fr-FR')}
                  </p>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Link
                      href={`/projects/${project.id}`}
                      className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-600 text-center py-2 rounded-lg font-semibold transition"
                    >
                      Détails
                    </Link>
                    <Link
                      href={`/projects/${project.id}/generate`}
                      className="flex-1 bg-green-50 hover:bg-green-100 text-green-600 text-center py-2 rounded-lg font-semibold transition"
                    >
                      Générer
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default function ProjectsDashboard() {
  return <DashboardList />;
}
