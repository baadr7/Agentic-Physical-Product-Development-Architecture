import type { Scenario } from '@/types';
import { SCENARIO_ICON } from './icons';

export default function ScenarioIcon({ icon, className = '', size = 20 }: { icon: Scenario['icon']; className?: string; size?: number }) {
  const Ic = SCENARIO_ICON[icon];
  return <Ic className={className} size={size} strokeWidth={1.7} />;
}
