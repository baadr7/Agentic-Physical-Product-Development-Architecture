'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiCreateProject } from '~/lib/api/fastapi';

export default function CreateProjectPage() {
  const router = useRouter();
  const [title, setTitle] = useState('Nouveau Projet');
  const [description, setDescription] = useState('');
  const [productType, setProductType] = useState('other');
  const [brief, setBrief] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      setSubmitting(true);
      const proj = await apiCreateProject({
        title,
        description,
        product_type: productType,
        brief,
      });
      const id = (proj as any).id || (proj as any).project_id;
      if (id) router.push(`/projects/${id}`);
      else router.push('/projects');
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la création du projet');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <h1 className="text-3xl font-bold text-slate-900">Créer un Projet</h1>
          <p className="text-slate-600">Définissez un titre et un bref descriptif.</p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <form onSubmit={onSubmit} className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded">{error}</div>
          )}
          <div data-testid="create-project-title-field">
            <label className="block text-sm font-medium text-slate-700 mb-1">Titre</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-slate-300 rounded px-3 py-2"
              placeholder="Nom du projet"
              required
            />
          </div>
          <div data-testid="create-project-description-field">
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border border-slate-300 rounded px-3 py-2"
              rows={3}
            />
          </div>
          <div data-testid="create-project-type-field">
            <label className="block text-sm font-medium text-slate-700 mb-1">Type de produit</label>
            <select
              value={productType}
              onChange={(e) => setProductType(e.target.value)}
              className="w-full border border-slate-300 rounded px-3 py-2 bg-white"
            >
              <option value="furniture">Mobilier</option>
              <option value="electronics">Électronique</option>
              <option value="mechanical">Mécanique</option>
              <option value="other">Autre</option>
            </select>
          </div>
          <div data-testid="create-project-brief-field">
            <label className="block text-sm font-medium text-slate-700 mb-1">Brief</label>
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              className="w-full border border-slate-300 rounded px-3 py-2"
              rows={4}
              placeholder="Objectifs, contraintes, matériaux…"
            />
          </div>
          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white px-5 py-2 rounded font-semibold"
              data-testid="create-project-submit"
            >
              {submitting ? 'Création…' : 'Créer le projet'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
