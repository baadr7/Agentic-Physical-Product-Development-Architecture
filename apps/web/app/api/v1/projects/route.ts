import { NextRequest } from 'next/server';

interface Project {
  id: string;
  title: string;
  description?: string;
  product_type?: string;
  brief?: string;
  materials?: string[];
  constraints?: Record<string, unknown>;
  logo_url?: string;
  created_at: string;
}

const projects: Project[] = [
  {
    id: 'proj-1',
    title: 'Projet Démo',
    description: 'Projet de démonstration (stub)',
    product_type: 'electronics',
    brief: 'Prototype initial',
    materials: ['Aluminium'],
    constraints: {},
    created_at: new Date().toISOString(),
  },
];

export async function GET() {
  return Response.json(projects);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const id = `proj-${Math.random().toString(16).slice(2,10)}`;
  const project: Project = {
    id,
    title: body.title || 'Sans titre',
    description: body.description,
    product_type: body.product_type || 'other',
    brief: body.brief,
    materials: body.materials || [],
    constraints: body.constraints || {},
    logo_url: body.logo_url,
    created_at: new Date().toISOString(),
  };
  projects.unshift(project);
  return Response.json(project, { status: 201 });
}
