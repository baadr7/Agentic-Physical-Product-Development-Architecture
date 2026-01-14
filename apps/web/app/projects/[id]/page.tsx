import ProjectPageClient from './ProjectPageClient';
import Breadcrumbs from '~/components/Breadcrumbs';

// Next.js 15 requires awaiting dynamic route params in some edge/render modes.
export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <div className="max-w-7xl mx-auto px-6 pt-6">
        <Breadcrumbs />
      </div>
      <ProjectPageClient projectId={id} />
    </>
  );
}

// SQL code to insert a new project
/*
insert into projects (user_id,title,description,product_type,brief,materials,constraints)
values ('YOUR_USER_UUID','Demo Project','Prototype','other','Handlebar',array['Aluminium','Rubber'],'{}'::jsonb)
returning id;
*/
