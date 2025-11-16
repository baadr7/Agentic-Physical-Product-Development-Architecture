import ResultsClient from './ResultsClient';

// Await dynamic route params per Next.js 15 guidance
export default async function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ResultsClient projectId={id} />;
}
