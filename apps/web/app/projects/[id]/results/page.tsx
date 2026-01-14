import ResultsClient from './ResultsClient';
import Breadcrumbs from '~/components/Breadcrumbs';

// Await dynamic route params per Next.js 15 guidance
export default async function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <div className="max-w-7xl mx-auto px-6 pt-6">
        <Breadcrumbs />
      </div>
      <ResultsClient projectId={id} />
    </>
  );
}
