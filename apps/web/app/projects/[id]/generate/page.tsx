import GenerateClient from './GenerateClient';
import Breadcrumbs from '~/components/Breadcrumbs';

export default async function GenerationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <div className="max-w-7xl mx-auto px-6 pt-6">
        <Breadcrumbs />
      </div>
      <GenerateClient projectId={id} />
    </>
  );
}
