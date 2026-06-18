import { useEffect, useState } from 'react';

const COLOR = (v: number, accent?: boolean) =>
  accent ? '#10B981' : v >= 70 ? '#22C55E' : v >= 50 ? '#F59E0B' : '#EF4444';

/** Horizontal bar gauge animating 0→value in 600ms, threshold tick at 70. */
export default function GaugeDFx({
  value,
  label,
  accent = false,
  threshold = 70,
  compact = false,
}: {
  value: number;
  label?: string;
  accent?: boolean;
  threshold?: number;
  compact?: boolean;
}) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setW(value));
    return () => cancelAnimationFrame(id);
  }, [value]);

  return (
    <div className="w-full">
      {label && (
        <div className="mb-0.5 flex items-center justify-between">
          <span className={`text-caption font-medium ${accent ? 'text-dfs' : 'text-text-secondary'}`}>
            {label}
          </span>
          <span className="mono tnum text-text-primary">{value}</span>
        </div>
      )}
      <div className={`relative w-full rounded bg-surface ${compact ? 'h-1.5' : 'h-2'}`}>
        <div
          className="h-full rounded transition-[width] duration-[600ms] ease-out"
          style={{ width: `${w}%`, backgroundColor: COLOR(value, accent) }}
        />
        {/* threshold tick */}
        <div
          className="absolute top-[-2px] h-[calc(100%+4px)] w-px bg-text-muted/70"
          style={{ left: `${threshold}%` }}
          title={`Seuil ${threshold}`}
        />
      </div>
    </div>
  );
}
