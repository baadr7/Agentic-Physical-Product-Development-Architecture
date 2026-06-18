import { useEffect, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useLangStore } from '@/i18n';
import { useAppState } from '@/store/appState';
import { runOrchestration, isOrchestrationComplete, submitGateDecision } from '@/engine/orchestration';
import { AGENT_CONFIG, pick } from '@/config/hitlMatrix';
import AgentCard, { AGENT_COLOR } from '@/components/AgentCard';
import ConnectorStrip, { type ConnectorKey } from '@/components/ConnectorStrip';
import GanttTimeline from '@/components/GanttTimeline';
import ADTTimeline from '@/components/ADTTimeline';
import { Check, PencilLine, FastForward } from 'lucide-react';
import type { AgentId, HITLLevel } from '@/types';
import type { OrchestratorPlan } from '@/llm/contracts';

const GRID: AgentId[] = ['orchestrator', 'retrieval', 'generation', 'simulation', 'dfx', 'doc'];

export default function E3Dashboard() {
  const lang = useLangStore((s) => s.lang);
  const fr = lang === 'fr';
  const navigate = useNavigate();
  const scenario = useAppState((s) => s.scenario);
  const brief = useAppState((s) => s.brief);
  const agents = useAppState((s) => s.agents);
  const concepts = useAppState((s) => s.concepts);
  const adt = useAppState((s) => s.adt);
  const runMode = useAppState((s) => s.runMode);
  const setRunMode = useAppState((s) => s.setRunMode);
  const reviewAgent = useAppState((s) => s.reviewAgent);
  const [activeConnectors, setActiveConnectors] = useState<ConnectorKey[]>([]);
  const [adjustText, setAdjustText] = useState('');
  // derived from reactive store state so it stays correct across navigation
  const done = GRID.every((a) => agents[a].status === 'done') && !reviewAgent;

  // What the paused agent reports having done (shown in the review gate).
  function agentSummary(agent: AgentId): string {
    switch (agent) {
      case 'orchestrator': {
        const plan = agents.orchestrator.output as OrchestratorPlan | undefined;
        const n = plan?.plan.length ?? 0;
        return fr
          ? `Plan d'exécution séquencé en ${n} étapes. Risque clé : ${plan?.key_risk ?? '—'}`
          : `Sequenced execution plan with ${n} steps. Key risk: ${plan?.key_risk ?? '—'}`;
      }
      case 'retrieval': {
        const n = (agents.retrieval.output as unknown[] | undefined)?.length ?? 0;
        return fr
          ? `${n} sources interrogées (PLM, ERP, normes, Digital Twin…) ; contexte structuré prêt.`
          : `${n} sources queried (PLM, ERP, standards, Digital Twin…); structured context ready.`;
      }
      case 'generation': {
        const ids = concepts.map((c) => c.id).join(', ');
        const mats = concepts.map((c) => c.materialProcess).join(' · ');
        return fr
          ? `${concepts.length} concepts générés (${ids}) pour « ${brief.name} » : ${mats}.`
          : `${concepts.length} concepts generated (${ids}) for “${brief.name}”: ${mats}.`;
      }
      case 'simulation':
        return fr
          ? `Comportement simulé (Bs) comparé aux attentes (Be) pour ${concepts.length} concepts.`
          : `Simulated behaviour (Bs) compared to expected (Be) across ${concepts.length} concepts.`;
      case 'dfx':
        return fr
          ? `Scores DFM/DFA/DFR/DFC/DFS attribués à ${concepts.length} concepts (déterministes).`
          : `DFM/DFA/DFR/DFC/DFS scores assigned to ${concepts.length} concepts (deterministic).`;
      case 'doc':
        return fr
          ? `Thread numérique mis à jour — ${adt.length} entrées ADT ; rapport gate review prêt.`
          : `Digital thread updated — ${adt.length} ADT entries; gate-review report ready.`;
    }
  }

  function chooseMode(mode: 'autonomous' | 'supervised') {
    setRunMode(mode);
    // switching to autonomous while paused resumes the run immediately
    if (mode === 'autonomous' && useAppState.getState().reviewAgent) submitGateDecision({ type: 'approve' });
  }

  function approve() {
    submitGateDecision({ type: 'approve' });
  }
  function requestAdjust() {
    const note = adjustText.trim();
    if (!note) return;
    submitGateDecision({ type: 'adjust', note });
    setAdjustText('');
  }
  function approveRest() {
    setRunMode('autonomous');
    submitGateDecision({ type: 'approve' });
  }

  useEffect(() => {
    if (!scenario) return;
    if (isOrchestrationComplete()) return; // already finished — don't restart on remount
    let alive = true;
    // runOrchestration no-ops if a run is already in flight (e.g. on remount mid-gate).
    runOrchestration((keys) => alive && setActiveConnectors(keys));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario]);

  if (!scenario) return <Navigate to="/e1" replace />;

  const plan = agents.orchestrator.output as OrchestratorPlan | undefined;

  return (
    <div className="mx-auto max-w-app px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-screen font-semibold">
          {fr ? 'Tableau de bord multi-agents' : 'Multi-agent dashboard'}
        </h1>
        <div className="flex items-center gap-2">
          {/* execution mode toggle */}
          <div className="flex items-center rounded-lg border border-border bg-surface p-0.5" title={fr ? "Mode d'exécution des agents" : 'Agent execution mode'}>
            <ModeBtn active={runMode === 'supervised'} onClick={() => chooseMode('supervised')}>
              {fr ? 'Supervisé (pas à pas)' : 'Supervised (step-by-step)'}
            </ModeBtn>
            <ModeBtn active={runMode === 'autonomous'} onClick={() => chooseMode('autonomous')}>
              {fr ? 'Autonome' : 'Autonomous'}
            </ModeBtn>
          </div>
          {done && (
            <button onClick={() => navigate('/e4')} className="btn-primary">
              {fr ? 'Voir les concepts générés →' : 'View generated concepts →'}
            </button>
          )}
        </div>
      </div>

      <div className="mt-4">
        <ConnectorStrip active={activeConnectors} />
      </div>

      {/* HITL review gate — the paused agent reports its work for approval */}
      {reviewAgent && (
        <div className="card-overlay mt-4 border-l-2 border-l-human p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full" style={{ backgroundColor: AGENT_COLOR[reviewAgent] }} />
            <span className="text-section font-semibold">
              {pick(AGENT_CONFIG[reviewAgent].label, lang)} — {fr ? 'en attente de votre revue' : 'awaiting your review'}
            </span>
            <span className="pill bg-human/15 text-human">{fr ? 'HITL' : 'HITL'} L{brief.agentLevels[reviewAgent] as HITLLevel}</span>
          </div>
          <p className="mt-2 text-body text-text-secondary">{agentSummary(reviewAgent)}</p>

          <textarea
            value={adjustText}
            onChange={(e) => setAdjustText(e.target.value)}
            rows={2}
            placeholder={fr ? 'Optionnel : décrivez un ajustement à transmettre à l’agent…' : 'Optional: describe an adjustment for the agent…'}
            className="input mt-3 resize-none text-caption"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button onClick={approve} className="btn-primary">
              <Check size={14} />
              {fr ? 'Approuver & continuer' : 'Approve & continue'}
            </button>
            <button onClick={requestAdjust} disabled={!adjustText.trim()} className="btn-ghost">
              <PencilLine size={14} />
              {fr ? 'Demander un ajustement' : 'Request adjustment'}
            </button>
            <button onClick={approveRest} className="btn-ghost ml-auto" title={fr ? 'Approuver et laisser les agents finir sans interruption' : 'Approve and let the agents finish without interruption'}>
              <FastForward size={14} />
              {fr ? 'Continuer sans interruption' : 'Continue without interruption'}
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {GRID.map((a) => (
              <AgentCard
                key={a}
                agent={a}
                runtime={agents[a]}
                level={brief.agentLevels[a] as HITLLevel}
                onOpen={() => navigate(`/e3/${a}`)}
                review={reviewAgent === a}
              />
            ))}
          </div>

          <div className="mt-4">
            <GanttTimeline agents={agents} />
          </div>

          {plan && (
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              <InfoCard title={lang === 'fr' ? 'Commentaire HITL' : 'HITL comment'} text={plan.hitl_comment} />
              <InfoCard title={lang === 'fr' ? 'Risque clé' : 'Key risk'} text={plan.key_risk} accent="warning" />
              <InfoCard
                title={lang === 'fr' ? 'Note durabilité' : 'Sustainability note'}
                text={plan.sustainability_note}
                accent="dfs"
              />
            </div>
          )}
        </div>

        <ADTTimeline maxHeight="38rem" />
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button onClick={() => navigate('/workflow')} className="btn-ghost">
          {lang === 'fr' ? 'Voir la chaîne d’orchestration →' : 'View orchestration chain →'}
        </button>
      </div>
    </div>
  );
}

function ModeBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-2.5 py-1 text-caption font-medium transition-colors ${
        active ? 'bg-human text-white' : 'text-text-secondary hover:text-text-primary'
      }`}
    >
      {children}
    </button>
  );
}

function InfoCard({ title, text, accent }: { title: string; text: string; accent?: 'warning' | 'dfs' }) {
  const color = accent === 'warning' ? 'text-status-warning' : accent === 'dfs' ? 'text-dfs' : 'text-text-secondary';
  return (
    <div className="card p-3">
      <div className={`text-caption font-semibold uppercase tracking-wide ${color}`}>{title}</div>
      <p className="mt-1 text-body text-text-secondary">{text}</p>
    </div>
  );
}
