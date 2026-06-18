import { useT } from '@/i18n';

export default function SimBadge({ connected = false }: { connected?: boolean }) {
  const t = useT();
  return (
    <span
      className={`pill ${
        connected ? 'bg-emerald-500/15 text-status-pass' : 'bg-slate-500/15 text-status-simulated'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-status-pass' : 'bg-status-simulated'}`}
      />
      {connected ? t('common.connected') : t('common.simulated')}
    </span>
  );
}
