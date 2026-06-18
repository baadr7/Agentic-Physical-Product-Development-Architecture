// Central icon mapping (lucide-react) for a consistent, professional icon set.
import {
  Plane,
  Factory,
  Leaf,
  Rocket,
  Car,
  SlidersHorizontal,
  Network,
  Search,
  Boxes,
  FlaskConical,
  Gauge,
  FileText,
  Database,
  Server,
  Box,
  HardDrive,
  Cpu,
  Workflow,
  GitBranch,
  type LucideIcon,
} from 'lucide-react';
import type { AgentId, Scenario } from '@/types';
import type { ConnectorKey } from './ConnectorStrip';

export const SCENARIO_ICON: Record<Scenario['icon'], LucideIcon> = {
  aerospace: Plane,
  industrial: Factory,
  sustainable: Leaf,
  startup: Rocket,
  automotive: Car,
  custom: SlidersHorizontal,
};

export const AGENT_ICON: Record<AgentId, LucideIcon> = {
  orchestrator: Network,
  retrieval: Search,
  generation: Boxes,
  simulation: FlaskConical,
  dfx: Gauge,
  doc: FileText,
};

export const CONNECTOR_ICON: Record<ConnectorKey, LucideIcon> = {
  PLM: Database,
  STD: FileText,
  CAD: Box,
  MES: Server,
  ERP: HardDrive,
  DT: Cpu,
  FBS: GitBranch,
  HITL: Workflow,
};
