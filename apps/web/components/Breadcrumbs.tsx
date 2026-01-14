"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Breadcrumbs() {
  const pathname = usePathname() || "/";
  // Example paths we handle:
  // /projects
  // /projects/:id
  // /projects/:id/generate|results|dfx
  const parts = pathname.split("/").filter(Boolean);

  const items: Array<{ href: string; label: string }> = [];

  if (parts.length === 0) {
    return null;
  }

  // Always start with Projets when under /projects
  if (parts[0] === "projects") {
    items.push({ href: "/projects", label: "Projets" });

    if (parts[1]) {
      const pid = parts[1];
      items.push({ href: `/projects/${pid}`, label: `Projet ${pid.slice(0, 8)}` });
    }

    if (parts[2]) {
      const section = parts[2];
      const label =
        section === "generate"
          ? "Générer"
          : section === "results"
          ? "Résultats"
          : section === "dfx"
          ? "DfX"
          : section;
      items.push({ href: pathname, label });
    }
  }

  if (items.length === 0) return null;

  return (
    <nav aria-label="Fil d'ariane" className="mb-4 text-sm text-slate-600">
      <ol className="flex items-center gap-2 flex-wrap">
        {items.map((it, idx) => (
          <li key={it.href} className="flex items-center gap-2">
            {idx > 0 && <span className="text-slate-400">/</span>}
            {idx < items.length - 1 ? (
              <Link href={it.href} className="hover:underline">
                {it.label}
              </Link>
            ) : (
              <span className="font-semibold text-slate-900">{it.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
