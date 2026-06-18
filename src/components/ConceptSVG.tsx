import { useThemeTokens } from '@/theme';
import type { Concept } from '@/types';

const PROCESS_FILL: Record<string, string> = {
  casting: '#8B5CF6',
  cnc: '#6366F1',
  hybrid: '#EC4899',
};

/**
 * Inline SVG concept thumbnail. For the curated DN100 valves (bore set) it draws
 * a stylized butterfly-valve cross-section; for generated concepts it draws a
 * generic machined-part body. In both cases process drives the colour and wall
 * thickness is visually parameterized. Stylized, not engineering-accurate.
 */
export default function ConceptSVG({ concept, size = 120 }: { concept: Concept; size?: number }) {
  const tk = useThemeTokens();
  const s = concept.fbs.structure;
  const fill = PROCESS_FILL[s.process] ?? '#8B5CF6';
  const isV2 = concept.id.includes('v2');
  const isValve = s.bore_mm > 0;
  const cx = size / 2;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className={isV2 ? 'animate-fadein' : ''}>
      {isValve ? (
        <ValveBody size={size} fill={fill} wall_mm={s.wall_mm} surface={tk.surface} sub={tk.textSecondary} />
      ) : (
        <GenericPart size={size} fill={fill} process={s.process} surface={tk.surface} sub={tk.textSecondary} />
      )}
      {/* wall thickness label */}
      <text x={cx} y={size - 6} textAnchor="middle" fill={tk.textSecondary} fontSize={size * 0.085} fontFamily="monospace">
        {s.wall_mm} mm
      </text>
      {isV2 && (
        <text x={cx} y={14} textAnchor="middle" fill="#F59E0B" fontSize={size * 0.09} fontWeight={700}>
          v2
        </text>
      )}
    </svg>
  );
}

function ValveBody({ size, fill, wall_mm, surface, sub }: { size: number; fill: string; wall_mm: number; surface: string; sub: string }) {
  const cx = size / 2;
  const cy = size / 2;
  const outer = size * 0.38;
  const wall = Math.min(outer * 0.5, (wall_mm / 9) * outer * 0.45);
  const bore = outer - wall;
  const bolts = 4;
  return (
    <>
      <circle cx={cx} cy={cy} r={outer} fill={fill} fillOpacity={0.18} stroke={fill} strokeWidth={2} />
      <circle cx={cx} cy={cy} r={outer - wall / 2} fill="none" stroke={fill} strokeWidth={wall} strokeOpacity={0.45} />
      <circle cx={cx} cy={cy} r={bore} fill={surface} stroke={fill} strokeWidth={1.2} />
      {/* butterfly disc */}
      <line x1={cx - bore} y1={cy} x2={cx + bore} y2={cy} stroke={fill} strokeWidth={size * 0.05} strokeOpacity={0.8} />
      <circle cx={cx} cy={cy} r={size * 0.03} fill={fill} />
      {Array.from({ length: bolts }).map((_, i) => {
        const a = (Math.PI / 2) * i + Math.PI / 4;
        const bx = cx + Math.cos(a) * (outer + size * 0.06);
        const by = cy + Math.sin(a) * (outer + size * 0.06);
        return <circle key={i} cx={bx} cy={by} r={size * 0.03} fill={sub} />;
      })}
    </>
  );
}

// Generic part body: a rounded block whose look hints at the process —
// casting (solid + draft), CNC (machined pocket), hybrid (two-tone insert).
function GenericPart({ size, fill, process, surface, sub }: { size: number; fill: string; process: string; surface: string; sub: string }) {
  const x = size * 0.2;
  const y = size * 0.24;
  const w = size * 0.6;
  const h = size * 0.46;
  const r = size * 0.06;
  const cx = size / 2;
  const cy = y + h / 2;
  return (
    <>
      {/* body */}
      <rect x={x} y={y} width={w} height={h} rx={r} fill={fill} fillOpacity={0.18} stroke={fill} strokeWidth={2} />
      {/* mounting holes (assembly cue) */}
      {[x + size * 0.08, x + w - size * 0.08].map((hx, i) => (
        <circle key={i} cx={hx} cy={y + size * 0.08} r={size * 0.028} fill={surface} stroke={fill} strokeWidth={1.2} />
      ))}
      {process === 'cnc' && (
        // machined pocket
        <rect x={cx - w * 0.22} y={cy - h * 0.12} width={w * 0.44} height={h * 0.32} rx={r * 0.6} fill={surface} stroke={fill} strokeWidth={1.4} />
      )}
      {process === 'casting' && (
        // draft fillet line
        <path d={`M ${x + size * 0.04} ${y + h - size * 0.05} Q ${cx} ${cy} ${x + w - size * 0.04} ${y + h - size * 0.05}`} fill="none" stroke={fill} strokeWidth={1.4} strokeOpacity={0.6} />
      )}
      {process === 'hybrid' && (
        // contrasting insert
        <rect x={cx - w * 0.16} y={cy - h * 0.18} width={w * 0.32} height={h * 0.4} rx={r * 0.5} fill={sub} fillOpacity={0.5} stroke={fill} strokeWidth={1.2} />
      )}
    </>
  );
}
