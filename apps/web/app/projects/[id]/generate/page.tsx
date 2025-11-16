import GenerateClient from './GenerateClient';

export default async function GenerationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <GenerateClient projectId={id} />;
}
