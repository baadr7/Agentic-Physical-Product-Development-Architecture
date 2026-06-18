import { Radar } from 'react-chartjs-2';
import { ensureCharts } from './chartSetup';
import { useThemeTokens } from '@/theme';
import type { Concept } from '@/types';

ensureCharts();

// 3-axis radar: stress, deflection, proof. Be = dashed red, Bs = solid blue.
export default function BsBeRadar({ concept, size = 240 }: { concept: Concept; size?: number }) {
  const tk = useThemeTokens();
  const be = concept.fbs.behaviour.expected;
  const bs = concept.fbs.behaviour.simulated;
  // normalize to % of axis max (lower is better headroom)
  const MAX = { stress: 150, defl: 0.06 };
  const norm = (b: { stress_max_MPa: number; deflection_max_mm: number; proof_ok: boolean }) => [
    (b.stress_max_MPa / MAX.stress) * 100,
    (b.deflection_max_mm / MAX.defl) * 100,
    b.proof_ok ? 70 : 100,
  ];

  return (
    <div style={{ width: size, height: size }}>
      <Radar
        data={{
          labels: ['Contrainte', 'Flèche', 'Proof'],
          datasets: [
            {
              label: 'Be (attendu)',
              data: norm(be),
              borderColor: '#EF4444',
              borderDash: [6, 4],
              backgroundColor: 'rgba(239,68,68,0.06)',
              pointRadius: 2,
            },
            {
              label: 'Bs (simulé)',
              data: norm(bs),
              borderColor: '#3B82F6',
              backgroundColor: 'rgba(59,130,246,0.15)',
              pointRadius: 2.5,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { color: tk.textSecondary, font: { size: 11 } } } },
          scales: {
            r: {
              min: 0,
              max: 100,
              ticks: { display: false },
              grid: { color: tk.border },
              angleLines: { color: tk.border },
              pointLabels: { color: tk.textSecondary, font: { size: 11, weight: 600 } },
            },
          },
        }}
      />
    </div>
  );
}
