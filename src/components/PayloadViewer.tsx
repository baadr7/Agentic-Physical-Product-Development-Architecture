import { useState } from 'react';
import { useT } from '@/i18n';
import SimBadge from './SimBadge';

export default function PayloadViewer({
  title,
  source,
  timestamp,
  payload,
  defaultOpen = false,
}: {
  title: string;
  source?: string;
  timestamp?: string;
  payload: unknown;
  defaultOpen?: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify(payload, null, 2);

  function copy() {
    navigator.clipboard?.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-surface-overlay"
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-text-muted">{open ? '▾' : '▸'}</span>
          <span className="truncate text-body font-medium text-text-primary">{title}</span>
          <SimBadge />
        </div>
        {source && <span className="hidden truncate text-caption text-text-muted sm:block">{source}</span>}
      </button>
      {open && (
        <div className="border-t border-border">
          <div className="flex items-center justify-between border-b border-border bg-surface px-3 py-1.5">
            <div className="flex flex-wrap items-center gap-x-3 text-caption text-text-muted">
              {source && (
                <span>
                  {t('common.source')}: <span className="text-text-secondary">{source}</span>
                </span>
              )}
              {timestamp && (
                <span>
                  {t('common.timestamp')}: <span className="text-text-secondary">{timestamp}</span>
                </span>
              )}
            </div>
            <button onClick={copy} className="text-caption text-human hover:underline">
              {copied ? t('common.copied') : t('common.copy')}
            </button>
          </div>
          <pre className="max-h-72 overflow-auto bg-surface px-3 py-2 font-mono text-caption leading-relaxed text-text-secondary">
            {json}
          </pre>
        </div>
      )}
    </div>
  );
}
