'use client';

import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

import { apiCreateProject } from '~/lib/api/fastapi';

export default function CreateProjectPage() {
  const router = useRouter();
  const [title, setTitle] = useState('New product concept');
  const [description, setDescription] = useState('');
  const [productType, setProductType] = useState('other');
  const [brief, setBrief] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    try {
      setSubmitting(true);
      const project = await apiCreateProject({
        title,
        description,
        product_type: productType,
        brief,
      });
      const id =
        project.id ||
        (project as ProjectCreateResponse).project_id;
      router.push(id ? `/projects/${id}` : '/projects');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not create the project.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Create a project</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Start with a concise brief. You can refine constraints and generate variants from the project workspace.
        </p>
      </section>

      <form onSubmit={onSubmit} className="space-y-5 rounded-lg border border-slate-200 bg-white p-6">
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <Field label="Title" testId="create-project-title-field">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            placeholder="Product name"
            required
          />
        </Field>

        <Field label="Description" testId="create-project-description-field">
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            rows={3}
            placeholder="Short product context"
          />
        </Field>

        <Field label="Product type" testId="create-project-type-field">
          <select
            value={productType}
            onChange={(event) => setProductType(event.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
          >
            <option value="furniture">Furniture</option>
            <option value="electronics">Electronics</option>
            <option value="mechanical">Mechanical</option>
            <option value="other">Other</option>
          </select>
        </Field>

        <Field label="Brief" testId="create-project-brief-field">
          <textarea
            value={brief}
            onChange={(event) => setBrief(event.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            rows={5}
            placeholder="Goals, constraints, materials, target users, manufacturing limits..."
          />
        </Field>

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center justify-center rounded-md bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:bg-slate-300"
          data-testid="create-project-submit"
        >
          {submitting ? 'Creating...' : 'Create project'}
        </button>
      </form>
    </div>
  );
}

type ProjectCreateResponse = {
  project_id?: string;
};

function Field({
  label,
  testId,
  children,
}: {
  label: string;
  testId: string;
  children: ReactNode;
}) {
  return (
    <div data-testid={testId}>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      {children}
    </div>
  );
}
