# 08 — Design System: Commercial Industrial Grade

Target aesthetic: Siemens Xcelerator / PTC Windchill / Autodesk Fusion. Dense
information display without clutter, strong typographic hierarchy, data-oriented
layouts, consistent color coding mapped to the framework's conceptual structure.
Every screen must read as deployable software, not an academic mockup.

## Color tokens (Tailwind config)

```js
colors: {
  // Surface — cool dark-neutral industrial
  surface:   { DEFAULT: '#0F1419', raised: '#161C23', overlay: '#1E2630' },
  border:    { DEFAULT: '#2A3441', strong: '#3D4A5C' },
  text:      { primary: '#E6EBF0', secondary: '#9AA7B5', muted: '#5E6B7A' },

  // Conceptual mapping (keep consistent EVERYWHERE)
  fbs: {
    function:  '#3B82F6',   // F — blue
    behaviour: '#22C55E',   // B — green
    structure: '#8B5CF6',   // S — violet
  },
  agent: {
    orchestrator: '#F59E0B',
    retrieval:    '#06B6D4',
    generation:   '#EC4899',
    simulation:   '#6366F1',
    documentation:'#84CC16',
  },
  dfs:    '#10B981',        // sustainability accent — emerald, everywhere DFS appears
  human:  '#3B82F6',        // human actions/roles — blue
  ai:     '#9AA7B5',        // agent descriptions — grey
  status: { pass: '#22C55E', redesign: '#EF4444', warning: '#F59E0B',
            simulated: '#64748B', running: '#3B82F6' },
}
```

### Theming (dark + light)

Two industrial themes ship: the default **dark** (above) and a **light** variant.
The theme-dependent tokens — `surface{,.raised,.overlay}`, `border{,.strong}`,
`text.{primary,secondary,muted}` — are backed by CSS variables (space-separated
RGB channels) defined per theme in `src/index.css` and swapped via a
`data-theme="dark|light"` attribute on `<html>`. Tailwind references them as
`rgb(var(--token) / <alpha-value>)`, so every component that uses these tokens
adapts with **no code change**.

The conceptual accent colors (FBS, agent, DFS emerald, human blue, status) are
identical on both themes. Canvas / inline-SVG consumers that can't read CSS
variables (Chart.js radars, the n8n-style workflow graph, the parametric valve
drawing) pull the same palette from `THEME_TOKENS` in `src/theme/index.ts` via
the `useThemeTokens()` hook — keep that map in sync with the CSS variables.

State lives in `useThemeStore` (Zustand, persisted to `localStorage` under
`apda-theme`); a small boot script in `index.html` applies the saved theme before
first paint to avoid a flash. Toggle via the Sun/Moon button in the header.

## Typography

- UI font: **Inter** (or IBM Plex Sans). Mono for payloads/IDs: **JetBrains Mono**.
- Scale: 11px captions/badges · 13px body/dense tables · 15px section titles ·
  20px screen titles. Tabular numerals (`font-variant-numeric: tabular-nums`) on
  all metrics.

## Core components

| Component | Spec |
|---|---|
| `AgentCard` | Name, layer badge, HITL badge (L1–L5 pill), status dot (idle grey / running pulsing blue / done green), 3-line monospace log, mm:ss chronometer |
| `HITLSelector` | 5 segmented buttons; disabled outside the allowed range; on change shows two text zones (agent = grey, human = blue highlighted) |
| `RadarDFx` | Chart.js radar, 5 axes DFM/DFA/DFR/DFC/DFS; DFS axis label in emerald |
| `GaugeDFx` | Horizontal bar gauge animating 0→value in 600 ms; threshold tick at 70 |
| `ConnectorStrip` | 8 icons (PLM, STD, CAD, MES, ERP, DT, FBS, HITL); pulse animation on trigger; "Connexion simulée" tag |
| `PayloadViewer` | Collapsible JSON block, JetBrains Mono, syntax-highlighted, copy button, source + timestamp header |
| `ADTTimeline` | Vertical timestamped thread; agent-colored dots; filter by agent/event; export button |
| `SimBadge` | "Simulé" grey badge vs "Connecté" green — on every Layer 3 element |
| `HumanRoleBanner` | Full-width banner on E6 and agent sub-screens: role title + message per HITL level |
| `ConceptSVG` | Parametric inline SVG of the valve body; wall thickness, flange count, bore visually parameterized per concept; redraw for A-v2 |

## Layout

- Desktop tool: max-width 1600px, min supported 1280px.
- E1/E2: multi-column forms. E3: card grid + persistent connector strip + Gantt.
- Persistent header: app name, PDP phase banner (L0, simulated), scenario chip,
  API status (Mode démo / DeepSeek connecté), "? Glossaire" fixed button.

## Motion

- Gauges: 600 ms ease-out fill.
- Connector icons: 300 ms pulse + ring on trigger.
- Agent status: log lines type in; running cards show subtle progress shimmer.
- Feedback loop: amber pulse on Simulation card; A-v2 card 400 ms fade-in.
- Respect `prefers-reduced-motion`.
