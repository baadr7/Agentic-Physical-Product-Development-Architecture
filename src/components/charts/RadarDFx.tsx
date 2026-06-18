import { useMemo } from 'react';
import { Radar } from 'react-chartjs-2';
import { ensureCharts } from './chartSetup';
import { useThemeTokens } from '@/theme';
import type { DFxScores } from '@/types';

ensureCharts();

const AXES: (keyof DFxScores)[] = ['dfm', 'dfa', 'dfr', 'dfc', 'dfs'];
const LABELS = ['DFM', 'DFA', 'DFR', 'DFC', 'DFS'];

export interface RadarSeries {
  label: string;
  scores: DFxScores;
  color: string; // rgb hex
}

export default function RadarDFx({
  series,
  size = 240,
  showLegend = false,
}: {
  series: RadarSeries[];
  size?: number;
  showLegend?: boolean;
}) {
  const tk = useThemeTokens();
  const data = useMemo(
    () => ({
      labels: LABELS,
      datasets: series.map((s) => {
        const rgb = hexToRgb(s.color);
        return {
          label: s.label,
          data: AXES.map((a) => s.scores[a]),
          backgroundColor: `rgba(${rgb},0.15)`,
          borderColor: `rgb(${rgb})`,
          borderWidth: 2,
          pointBackgroundColor: `rgb(${rgb})`,
          pointRadius: 2.5,
        };
      }),
    }),
    [series],
  );

  return (
    <div style={{ width: size, height: size }}>
      <Radar
        data={data}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: showLegend, labels: { color: tk.textSecondary, font: { size: 11 } } },
            tooltip: { enabled: true },
          },
          scales: {
            r: {
              min: 0,
              max: 100,
              ticks: { display: false, stepSize: 25 },
              grid: { color: tk.border },
              angleLines: { color: tk.border },
              pointLabels: {
                color: (ctx: any) => (ctx.label === 'DFS' ? '#10B981' : tk.textSecondary),
                font: { size: 11, weight: 600 },
              },
            },
          },
        }}
      />
    </div>
  );
}

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}
