import { useT } from '@/i18n';
import { CONNECTOR_ICON } from './icons';

export type ConnectorKey = 'PLM' | 'STD' | 'CAD' | 'MES' | 'ERP' | 'DT' | 'FBS' | 'HITL';

const ICONS: { key: ConnectorKey; label: string }[] = [
  { key: 'PLM', label: 'PLM' },
  { key: 'STD', label: 'Normes' },
  { key: 'CAD', label: 'CAD' },
  { key: 'MES', label: 'MES' },
  { key: 'ERP', label: 'ERP' },
  { key: 'DT', label: 'Digital Twin' },
  { key: 'FBS', label: 'FBS' },
  { key: 'HITL', label: 'HITL' },
];

/** Persistent horizontal strip — 8 system icons, pulse on trigger. */
export default function ConnectorStrip({ active = [] }: { active?: ConnectorKey[] }) {
  const t = useT();
  return (
    <div className="card flex items-center gap-2 overflow-x-auto px-3 py-2">
      <span className="shrink-0 pr-1 text-caption font-semibold uppercase tracking-wide text-text-muted">
        {t('common.simulated') === 'Simulé' ? 'Connexion simulée' : 'Simulated connection'}
      </span>
      <div className="flex flex-1 items-center justify-around gap-2">
        {ICONS.map((ic) => {
          const on = active.includes(ic.key);
          return (
            <div key={ic.key} className="flex flex-col items-center gap-1">
              <div
                className={`grid h-9 w-9 place-items-center rounded-md border transition-colors ${
                  on
                    ? 'border-human bg-human/20 text-human animate-pulsering'
                    : 'border-border bg-surface text-text-muted'
                }`}
              >
                {(() => {
                  const Ic = CONNECTOR_ICON[ic.key];
                  return <Ic size={17} strokeWidth={1.8} />;
                })()}
              </div>
              <span className={`text-[9px] ${on ? 'text-human' : 'text-text-muted'}`}>{ic.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
