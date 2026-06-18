import { useLangStore } from '@/i18n';
import { ROLE_TITLE, LEVEL_PRINCIPLE, pick } from '@/config/hitlMatrix';
import type { HITLLevel } from '@/types';

/** Full-width banner (E6 / agent sub-screens): role title + principle for a level. */
export default function HumanRoleBanner({
  level,
  message,
}: {
  level: HITLLevel;
  message?: string;
}) {
  const lang = useLangStore((s) => s.lang);
  return (
    <div className="card-overlay flex items-center gap-3 border-l-2 border-l-human p-3">
      <span className="pill bg-human/15 text-human">L{level}</span>
      <div>
        <div className="text-body font-semibold text-text-primary">
          {pick(ROLE_TITLE[level], lang)}
        </div>
        <div className="text-caption text-text-secondary">
          {message ?? pick(LEVEL_PRINCIPLE[level], lang)}
        </div>
      </div>
    </div>
  );
}
