import { useEffect, useRef, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Database, RefreshCw } from 'lucide-react';
import { useLangStore } from '@/i18n';
import { useAppState } from '@/store/appState';
import { useThemeTokens } from '@/theme';
import { useBackendStore, offlineCustomFields } from '@/store/backend';
import { pingBackend, createProject, retrieveFields } from '@/api/client';
import { AGENT_CONFIG, pick } from '@/config/hitlMatrix';
import { AGENT_COLOR } from '@/components/AgentCard';
import { runOrchestration, isOrchestrationComplete } from '@/engine/orchestration';
import type { AgentId, AgentStatus, HITLLevel } from '@/types';

// ---- node graph layout (n8n-style horizontal flow) ----
interface Node {
  id: string;
  label: string;
  x: number;
  y: number;
  kind: 'io' | 'agent' | 'source';
  agent?: AgentId;
  color?: string;
}
interface Edge {
  from: string;
  to: string;
  flowsWith?: AgentId; // animates while this agent runs
}

const W = 1180;
const H = 560;

const NODES: Node[] = [
  { id: 'brief', label: 'Brief produit', x: 40, y: 250, kind: 'io' },
  { id: 'orchestrator', label: 'Orchestrateur', x: 200, y: 250, kind: 'agent', agent: 'orchestrator', color: AGENT_COLOR.orchestrator },
  // source nodes (top lane)
  { id: 'src_plm', label: 'PLM', x: 360, y: 40, kind: 'source' },
  { id: 'src_std', label: 'Normes', x: 360, y: 110, kind: 'source' },
  { id: 'src_erp', label: 'ERP', x: 360, y: 180, kind: 'source' },
  { id: 'src_dt', label: 'Digital Twin', x: 360, y: 430, kind: 'source' },
  { id: 'src_cad', label: 'CAD', x: 360, y: 500, kind: 'source' },
  { id: 'src_mes', label: 'MES / IoT', x: 360, y: 360, kind: 'source' },
  // agent chain
  { id: 'retrieval', label: 'Récupération', x: 400, y: 250, kind: 'agent', agent: 'retrieval', color: AGENT_COLOR.retrieval },
  { id: 'generation', label: 'Génération', x: 560, y: 250, kind: 'agent', agent: 'generation', color: AGENT_COLOR.generation },
  { id: 'simulation', label: 'Simulation', x: 720, y: 250, kind: 'agent', agent: 'simulation', color: AGENT_COLOR.simulation },
  { id: 'dfx', label: 'DFx ×5', x: 880, y: 250, kind: 'agent', agent: 'dfx', color: AGENT_COLOR.dfx },
  { id: 'doc', label: 'Documentation', x: 1010, y: 250, kind: 'agent', agent: 'doc', color: AGENT_COLOR.doc },
  { id: 'gate', label: 'Gate Review', x: 1010, y: 430, kind: 'io' },
];

const EDGES: Edge[] = [
  { from: 'brief', to: 'orchestrator' },
  { from: 'orchestrator', to: 'retrieval', flowsWith: 'orchestrator' },
  { from: 'src_plm', to: 'retrieval', flowsWith: 'retrieval' },
  { from: 'src_std', to: 'retrieval', flowsWith: 'retrieval' },
  { from: 'src_erp', to: 'retrieval', flowsWith: 'retrieval' },
  { from: 'retrieval', to: 'generation', flowsWith: 'retrieval' },
  { from: 'src_erp', to: 'generation', flowsWith: 'generation' },
  { from: 'src_cad', to: 'generation', flowsWith: 'generation' },
  { from: 'generation', to: 'simulation', flowsWith: 'generation' },
  { from: 'src_cad', to: 'simulation', flowsWith: 'simulation' },
  { from: 'src_dt', to: 'simulation', flowsWith: 'simulation' },
  { from: 'src_mes', to: 'simulation', flowsWith: 'simulation' },
  { from: 'simulation', to: 'dfx', flowsWith: 'simulation' },
  { from: 'dfx', to: 'doc', flowsWith: 'dfx' },
  { from: 'doc', to: 'gate', flowsWith: 'doc' },
];

const NODE_W = 130;
const NODE_H = 48;
const SRC_W = 96;
const SRC_H = 34;

function anchor(n: Node, side: 'in' | 'out') {
  const w = n.kind === 'source' ? SRC_W : NODE_W;
  const h = n.kind === 'source' ? SRC_H : NODE_H;
  return { x: n.x + (side === 'out' ? w : 0), y: n.y + h / 2 };
}

export default function WorkflowChain() {
  const lang = useLangStore((s) => s.lang);
  const tk = useThemeTokens();
  const navigate = useNavigate();
  const scenario = useAppState((s) => s.scenario);
  const agents = useAppState((s) => s.agents);
  const brief = useAppState((s) => s.brief);
  const [, force] = useState(0);

  // --- backend / RAG custom fields ---
  const online = useBackendStore((s) => s.online);
  const customFields = useBackendStore((s) => s.customFields);
  const fieldsSource = useBackendStore((s) => s.fieldsSource);
  const ragLoading = useBackendStore((s) => s.loading);
  const projectCreated = useRef(false);
  const fieldsFetched = useRef(false);

  // light re-render tick so edge animation reflects status promptly
  useEffect(() => {
    const id = setInterval(() => force((x) => x + 1), 400);
    return () => clearInterval(id);
  }, []);

  // Probe the backend and create a project for this run (once). Falls back silently.
  useEffect(() => {
    if (!scenario) return;
    let alive = true;
    (async () => {
      const up = await pingBackend();
      if (!alive) return;
      const bs = useBackendStore.getState();
      bs.setOnline(up);
      if (up && !projectCreated.current) {
        projectCreated.current = true;
        try {
          const sid = /^S[1-6]$/.test(scenario) ? scenario : null;
          const proj = await createProject(sid, useAppState.getState().brief);
          if (alive) useBackendStore.getState().setProjectId(proj.id);
        } catch {
          /* keep offline fallback */
        }
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario]);

  async function populateFields() {
    const bs = useBackendStore.getState();
    bs.setLoading(true);
    try {
      if (bs.online && bs.projectId) {
        const { customFields: cf } = await retrieveFields(bs.projectId);
        bs.setFields(cf, 'backend');
      } else {
        const app = useAppState.getState();
        bs.setFields(offlineCustomFields(app.brief, app.scenario), 'offline');
      }
    } catch {
      const app = useAppState.getState();
      bs.setFields(offlineCustomFields(app.brief, app.scenario), 'offline');
    } finally {
      useBackendStore.getState().setLoading(false);
    }
  }

  // Auto-populate custom fields once the Retrieval agent completes.
  useEffect(() => {
    if (agents.retrieval.status === 'done' && !fieldsFetched.current) {
      fieldsFetched.current = true;
      populateFields();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agents.retrieval.status]);

  if (!scenario) return <Navigate to="/e1" replace />;

  const byId = (id: string) => NODES.find((n) => n.id === id)!;
  const statusOf = (n: Node): AgentStatus | 'static' => (n.agent ? agents[n.agent].status : 'static');

  function replay() {
    if (isOrchestrationComplete()) useAppState.getState().resetAgents();
    fieldsFetched.current = false;
    runOrchestration(() => {}, { autonomous: true }); // graph replay never gates
  }

  return (
    <div className="mx-auto max-w-app px-4 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-screen font-semibold">
            {lang === 'fr' ? "Chaîne d'orchestration des agents" : 'Agent orchestration chain'}
          </h1>
          <p className="text-caption text-text-muted">
            {lang === 'fr'
              ? 'Graphe de flux type n8n — chaque nœud est un agent ou un connecteur Layer 3 (simulé). Les arêtes s’animent pendant l’exécution.'
              : 'n8n-style flow graph — each node is an agent or a (simulated) Layer 3 connector. Edges animate during execution.'}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={replay} className="btn-ghost">
            ↻ {lang === 'fr' ? 'Rejouer' : 'Replay'}
          </button>
          <button onClick={() => navigate('/e4')} className="btn-primary">
            {lang === 'fr' ? 'Concepts →' : 'Concepts →'}
          </button>
        </div>
      </div>

      <div className="card mt-4 overflow-x-auto p-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="min-w-[1000px]" style={{ width: '100%' }}>
          <defs>
            <pattern id="grid" width="22" height="22" patternUnits="userSpaceOnUse">
              <path d="M22 0H0V22" fill="none" stroke={tk.border} strokeWidth="1" />
            </pattern>
          </defs>
          <rect x="0" y="0" width={W} height={H} fill="url(#grid)" rx="8" />

          {/* edges */}
          {EDGES.map((e, i) => {
            const a = anchor(byId(e.from), 'out');
            const b = anchor(byId(e.to), 'in');
            const dx = Math.max(40, Math.abs(b.x - a.x) * 0.5);
            const d = `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
            const flowing = e.flowsWith ? agents[e.flowsWith].status === 'running' : false;
            const completed = e.flowsWith ? agents[e.flowsWith].status === 'done' : false;
            const color = completed ? tk.borderStrong : flowing ? '#3B82F6' : tk.border;
            return (
              <g key={i}>
                <path d={d} fill="none" stroke={color} strokeWidth={flowing ? 2.2 : 1.6} />
                {flowing && (
                  <path
                    d={d}
                    fill="none"
                    stroke="#60A5FA"
                    strokeWidth="2.4"
                    strokeDasharray="6 10"
                    className="animate-dash-flow"
                  />
                )}
              </g>
            );
          })}

          {/* nodes */}
          {NODES.map((n) => {
            const st = statusOf(n);
            const w = n.kind === 'source' ? SRC_W : NODE_W;
            const h = n.kind === 'source' ? SRC_H : NODE_H;
            const running = st === 'running';
            const doneN = st === 'done';
            const stroke = n.color ?? (n.kind === 'io' ? '#3B82F6' : tk.borderStrong);
            const clickable = n.kind === 'agent';
            return (
              <g
                key={n.id}
                transform={`translate(${n.x},${n.y})`}
                style={{ cursor: clickable ? 'pointer' : 'default' }}
                onClick={() => clickable && navigate(`/e3/${n.agent}`)}
              >
                <rect
                  width={w}
                  height={h}
                  rx="8"
                  fill={tk.surfaceOverlay}
                  stroke={stroke}
                  strokeWidth={running ? 2.4 : 1.4}
                  opacity={n.kind === 'source' ? 0.95 : 1}
                />
                {running && <rect width={w} height={h} rx="8" fill="none" stroke={stroke} strokeWidth="2.4" className="animate-pulse" />}
                {n.kind === 'agent' && (
                  <circle cx={12} cy={h / 2} r={4} fill={doneN ? '#22C55E' : running ? '#3B82F6' : '#5E6B7A'} />
                )}
                <text
                  x={n.kind === 'agent' ? 24 : w / 2}
                  y={h / 2 + 1}
                  textAnchor={n.kind === 'agent' ? 'start' : 'middle'}
                  dominantBaseline="middle"
                  fill={tk.textPrimary}
                  fontSize={n.kind === 'source' ? 10 : 12}
                  fontWeight={600}
                >
                  {n.kind === 'agent' && n.agent ? pick(AGENT_CONFIG[n.agent].label, lang) : n.label}
                </text>
                {n.kind === 'agent' && n.agent && (
                  <text x={24} y={h - 7} fill={tk.textSecondary} fontSize="9">
                    HITL L{brief.agentLevels[n.agent] as HITLLevel} · {st}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-caption text-text-muted">
        <LegendDot color="#3B82F6" label={lang === 'fr' ? 'flux actif' : 'active flow'} />
        <LegendDot color="#22C55E" label={lang === 'fr' ? 'terminé' : 'done'} />
        <LegendDot color="#5E6B7A" label={lang === 'fr' ? 'en attente' : 'idle'} />
        <span className="ml-auto">
          {lang === 'fr' ? 'Cliquez un agent pour ouvrir son sous-écran.' : 'Click an agent to open its sub-screen.'}
        </span>
      </div>

      {/* Custom fields populated by the Retrieval agent from the RAG knowledge base */}
      <div className="card mt-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Database size={15} className="text-text-secondary" />
          <h2 className="text-section font-semibold">
            {lang === 'fr' ? 'Champs custom (RAG)' : 'Custom fields (RAG)'}
          </h2>
          {fieldsSource && (
            <span
              className={`pill ${
                fieldsSource === 'backend'
                  ? 'bg-emerald-500/15 text-status-pass'
                  : 'bg-amber-500/15 text-status-warning'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  fieldsSource === 'backend' ? 'bg-status-pass' : 'bg-status-warning'
                }`}
              />
              {fieldsSource === 'backend'
                ? lang === 'fr' ? 'Backend connecté' : 'Backend connected'
                : lang === 'fr' ? 'Hors-ligne (simulé)' : 'Offline (simulated)'}
            </span>
          )}
          <span className="text-caption text-text-muted">
            {online === false
              ? lang === 'fr' ? 'API indisponible — repli local' : 'API down — local fallback'
              : online === true
                ? lang === 'fr' ? 'Source : base de connaissances' : 'Source: knowledge base'
                : ''}
          </span>
          <button
            onClick={() => {
              fieldsFetched.current = true;
              populateFields();
            }}
            disabled={ragLoading}
            className="btn-ghost ml-auto gap-1.5 px-2.5 py-1.5 text-caption"
          >
            <RefreshCw size={13} className={ragLoading ? 'animate-spin' : ''} />
            {lang === 'fr' ? 'Interroger le RAG' : 'Query the RAG'}
          </button>
        </div>

        {customFields.length === 0 ? (
          <p className="mt-3 text-body text-text-muted">
            {lang === 'fr'
              ? "Lancez la chaîne (ou « Interroger le RAG ») : l'agent Récupération renseigne ces champs depuis la base de connaissances."
              : 'Run the chain (or "Query the RAG"): the Retrieval agent fills these fields from the knowledge base.'}
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {customFields.map((f) => (
              <div key={f.key} className="card-overlay p-3">
                <div className="text-caption uppercase tracking-wide text-text-muted">{f.label}</div>
                <div className="mt-0.5 text-section font-semibold tabular-nums text-text-primary">
                  {renderFieldValue(f.value)}
                  {f.unit ? <span className="ml-1 text-caption font-normal text-text-secondary">{f.unit}</span> : null}
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-caption text-text-muted">
                  <span className="truncate">{f.source}</span>
                  {typeof f.confidence === 'number' && (
                    <span className="ml-auto shrink-0 text-text-secondary">
                      {lang === 'fr' ? 'conf.' : 'conf.'} {Math.round(f.confidence * 100)}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function renderFieldValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(' · ');
  if (value === null || value === undefined) return '—';
  return String(value);
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
