import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { useLangStore } from '@/i18n';
import { useAppState } from '@/store/appState';
import { AGENT_CONFIG, HITL_MATRIX, pick } from '@/config/hitlMatrix';
import { AGENT_SOURCES } from '@/config/connectorFixtures';
import HumanRoleBanner from '@/components/HumanRoleBanner';
import PayloadViewer from '@/components/PayloadViewer';
import { simulateRead, buildReadRequest } from '@/engine/simulatedConnector';
import type { AgentId, HITLLevel } from '@/types';
import type { OrchestratorPlan } from '@/llm/contracts';

const VALID: AgentId[] = ['orchestrator', 'retrieval', 'generation', 'simulation', 'dfx', 'doc'];

export default function AgentSubScreen() {
  const { agentId } = useParams<{ agentId: string }>();
  const lang = useLangStore((s) => s.lang);
  const navigate = useNavigate();
  const brief = useAppState((s) => s.brief);
  const agents = useAppState((s) => s.agents);
  const concepts = useAppState((s) => s.concepts);

  if (!agentId || !VALID.includes(agentId as AgentId)) return <Navigate to="/e3" replace />;
  const agent = agentId as AgentId;
  const level = brief.agentLevels[agent] as HITLLevel;
  const cell = HITL_MATRIX[agent][level];
  const sources = AGENT_SOURCES[agent] ?? [];

  return (
    <div className="mx-auto max-w-app px-4 py-6">
      <button onClick={() => navigate('/e3')} className="btn-ghost mb-3 text-caption">
        ← {lang === 'fr' ? 'Retour au tableau de bord' : 'Back to dashboard'}
      </button>
      <h1 className="text-screen font-semibold">{pick(AGENT_CONFIG[agent].label, lang)}</h1>

      <div className="mt-3">
        <HumanRoleBanner level={level} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr]">
        {/* sources / payloads */}
        <section>
          <h2 className="mb-2 text-section font-semibold">
            {lang === 'fr' ? 'Sources interrogées' : 'Queried sources'}
          </h2>
          {sources.length === 0 ? (
            <div className="card p-3 text-caption text-text-muted">
              {lang === 'fr' ? 'Aucune source externe — agent de coordination/calcul.' : 'No external source — coordination/compute agent.'}
            </div>
          ) : (
            <div className="space-y-2">
              {sources.map((s, i) => {
                const { request, response } = simulateRead(
                  buildReadRequest(s.connector, s.key, { product_family: brief.name || 'DN100' }),
                  s.key,
                );
                return (
                  <PayloadViewer
                    key={i}
                    title={`${s.connector} · ${s.key}`}
                    source={response.source}
                    timestamp={response.timestamp}
                    payload={{ request, response }}
                  />
                );
              })}
            </div>
          )}
        </section>

        {/* outputs + actions */}
        <section className="space-y-3">
          <h2 className="text-section font-semibold">{lang === 'fr' ? 'Sorties & actions' : 'Outputs & actions'}</h2>

          {agent === 'orchestrator' && Boolean(agents.orchestrator.output) && (
            <PayloadViewer
              title={lang === 'fr' ? 'Plan d’exécution' : 'Execution plan'}
              payload={(agents.orchestrator.output as OrchestratorPlan).plan}
              defaultOpen
            />
          )}
          {agent === 'generation' && concepts.length > 0 && (
            <PayloadViewer
              title={lang === 'fr' ? 'Concepts générés (FBS)' : 'Generated concepts (FBS)'}
              payload={concepts.map((c) => ({ id: c.id, scores: c.scores, structure: c.fbs.structure }))}
              defaultOpen
            />
          )}
          {agent === 'simulation' && concepts.length > 0 && (
            <PayloadViewer
              title="Bs vs Be"
              payload={concepts.map((c) => ({
                id: c.id,
                Be: c.fbs.behaviour.expected,
                Bs: c.fbs.behaviour.simulated,
              }))}
              defaultOpen
            />
          )}
          {agent === 'dfx' && concepts.length > 0 && (
            <PayloadViewer
              title={lang === 'fr' ? 'Scores DFx déterministes' : 'Deterministic DFx scores'}
              payload={concepts.map((c) => ({ id: c.id, ...c.scores }))}
              defaultOpen
            />
          )}

          {/* HITL-level action panel */}
          <div className="card-overlay p-3">
            <div className="text-caption font-semibold uppercase tracking-wide text-ai">
              {lang === 'fr' ? "Ce que fait l'agent (L" + level + ')' : 'What the agent does (L' + level + ')'}
            </div>
            <p className="text-body text-text-secondary">{pick(cell.agent, lang)}</p>
            <div className="mt-2 text-caption font-semibold uppercase tracking-wide text-human">
              {lang === 'fr' ? "Ce que doit faire l'humain" : 'What the human does'}
            </div>
            <p className="text-body text-text-primary">{pick(cell.human, lang)}</p>
            <button className="btn-primary mt-3 w-full" disabled={agents[agent].status !== 'done'}>
              {pick(cell.action, lang)}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
