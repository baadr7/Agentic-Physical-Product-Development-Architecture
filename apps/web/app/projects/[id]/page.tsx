import ProjectPageClient from './ProjectPageClient';

// Next.js 15 requires awaiting dynamic route params in some edge/render modes.
export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProjectPageClient projectId={id} />;
}
