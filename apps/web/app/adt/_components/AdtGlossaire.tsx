'use client';

import { useState } from 'react';
import { GLOSSARY } from '~/lib/adt/config';

const LAYER_COLORS: Record<string, { bg: string; text: string }> = {
  'Framework': { bg: 'rgba(99,102,241,0.15)',  text: '#818cf8' },
  'Layer 1':   { bg: 'rgba(245,158,11,0.15)',  text: '#f59e0b' },
  'Layer 2':   { bg: 'rgba(6,182,212,0.15)',   text: '#06b6d4' },
  'Layer 3':   { bg: 'rgba(16,185,129,0.15)',  text: '#10b981' },
  'Layer 4':   { bg: 'rgba(139,92,246,0.15)',  text: '#a78bfa' },
};

function layerStyle(layer: string) {
  return LAYER_COLORS[layer] ?? { bg: 'rgba(100,116,139,0.15)', text: '#94a3b8' };
}

export default function AdtGlossaire() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = query.trim()
    ? GLOSSARY.filter(t =>
        t.term.toLowerCase().includes(query.toLowerCase()) ||
        t.definition.toLowerCase().includes(query.toLowerCase())
      )
    : GLOSSARY;

  return (
    <>
      {/* Floating button */}
      <button
        id="adt-glossaire-btn"
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 1000,
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
          fontWeight: 800,
          color: '#fff',
          boxShadow: '0 4px 16px rgba(99,102,241,0.5)',
          transition: 'transform .2s, box-shadow .2s',
        }}
        onMouseEnter={e => { (e.target as HTMLElement).style.transform = 'scale(1.1)'; }}
        onMouseLeave={e => { (e.target as HTMLElement).style.transform = 'scale(1)'; }}
        title="Glossaire APDA"
      >
        ?
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 2000,
            background: 'rgba(6,9,23,0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
            animation: 'adt-fade-in .2s ease',
          }}
          onClick={() => setOpen(false)}
        >
          <div
            style={{
              background: 'rgba(13,20,45,0.97)',
              border: '1px solid rgba(99,102,241,0.3)',
              borderRadius: 20,
              width: '100%',
              maxWidth: 760,
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 24px 64px rgba(0,0,0,0.6), 0 0 40px rgba(99,102,241,0.15)',
              overflow: 'hidden',
              animation: 'adt-card-in .3s cubic-bezier(.16,1,.3,1)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid rgba(99,102,241,0.15)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#6366f1', marginBottom: 4 }}>E8 — GLOSSAIRE APDA</div>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.02em' }}>
                    Terminologie du framework
                  </h2>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'rgba(100,116,139,0.2)', border: '1px solid rgba(100,116,139,0.3)',
                    cursor: 'pointer', color: '#94a3b8', fontSize: 16,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >×</button>
              </div>
              <input
                className="adt-input"
                placeholder="Rechercher un terme…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                autoFocus
              />
            </div>

            {/* Terms list */}
            <div style={{ overflowY: 'auto', padding: '12px 24px 24px', flexGrow: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: '#475569', marginBottom: 12 }}>
                {filtered.length} terme{filtered.length !== 1 ? 's' : ''}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {filtered.map(t => {
                  const ls = layerStyle(t.layer);
                  return (
                    <div
                      key={t.term}
                      style={{
                        padding: '14px 16px',
                        borderRadius: 12,
                        border: '1px solid rgba(100,116,139,0.12)',
                        background: 'rgba(15,23,42,0.5)',
                        transition: 'background .15s',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.07)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(15,23,42,0.5)'; }}
                    >
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>{t.term}</span>
                        <span style={{
                          fontSize: 9, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
                          padding: '2px 8px', borderRadius: 4,
                          background: ls.bg, color: ls.text,
                        }}>
                          {t.layer}
                        </span>
                      </div>
                      <p style={{ fontSize: 13, color: '#94a3b8', margin: 0, lineHeight: 1.6, marginBottom: 6 }}>
                        {t.definition}
                      </p>
                      <p style={{ fontSize: 11, color: '#475569', margin: 0, fontStyle: 'italic', lineHeight: 1.5 }}>
                        ↳ {t.example}
                      </p>
                    </div>
                  );
                })}
                {filtered.length === 0 && (
                  <div style={{ textAlign: 'center', color: '#475569', padding: '32px 0', fontSize: 13 }}>
                    Aucun terme correspondant
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
