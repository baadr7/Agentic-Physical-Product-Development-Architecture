import { useT } from '@/i18n';

export default function Placeholder({ titleKey }: { titleKey: string }) {
  const t = useT();
  return (
    <div className="mx-auto max-w-app px-4 py-8">
      <h1 className="text-screen font-semibold">{t(titleKey)}</h1>
      <div className="card mt-6 grid h-64 place-items-center text-text-muted">
        {t('common.placeholderScreen')}
      </div>
    </div>
  );
}
