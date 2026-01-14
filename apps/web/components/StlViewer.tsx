"use client";

import React, { useEffect, useState } from 'react';

// Some React 3D viewers are not React 19 compatible yet.
// We lazy-load react-stl-viewer only on client and only when enabled,
// otherwise we render a graceful fallback to avoid runtime crashes.
function parseEnvBoolean(value: string | undefined, defaultValue = false) {
  if (value == null) return defaultValue;
  const normalized = value.trim().toLowerCase();

  if (['1', 'true', 'yes', 'y', 'on', 'enabled'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off', 'disabled', ''].includes(normalized)) return false;

  return defaultValue;
}

const ENABLE_STL = parseEnvBoolean(process.env.NEXT_PUBLIC_ENABLE_STL_VIEWER, false);

class ViewerBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }>{
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch() {}
  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full w-full flex items-center justify-center text-xs text-red-600">
          Affichage STL indisponible — affichage image de remplacement.
        </div>
      );
    }
    return this.props.children;
  }
}

export function StlPreview({ url, width = 400, height = 300 }: { url: string; width?: number; height?: number }){
  const [Comp, setComp] = useState<null | React.ComponentType<any>>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!ENABLE_STL) return;
      try {
        const mod: any = await import('react-stl-viewer');
        const Viewer = mod.StlViewer || mod.default;
        if (active && Viewer) setComp(() => Viewer);
      } catch (e) {
        console.warn('STL viewer load failed, falling back to image:', e);
        if (active) setFailed(true);
      }
    }
    if (typeof window !== 'undefined') {
      load();
    }
    return () => { active = false };
  }, []);

  if (!url) return null;

  if (!ENABLE_STL) {
    return (
      <div style={{ width, height }} className="border rounded bg-white overflow-hidden flex items-center justify-center">
        <div className="text-xs text-slate-500 px-3 py-2">
          Aperçu 3D désactivé par configuration.
        </div>
      </div>
    );
  }

  if (failed) {
    return (
      <div style={{ width, height }} className="border rounded bg-white overflow-hidden flex items-center justify-center">
        <div className="text-xs text-red-600 px-3 py-2">
          Aperçu 3D indisponible (chargement du viewer échoué).
        </div>
      </div>
    );
  }

  // While the module is still loading, don't claim it's disabled.
  if (!Comp) {
    return (
      <div style={{ width, height }} className="border rounded bg-white overflow-hidden flex items-center justify-center">
        <div className="text-xs text-slate-500 px-3 py-2">
          Chargement de l’aperçu 3D…
        </div>
      </div>
    );
  }

  const ReactStl = Comp as any;
  return (
    <div style={{ width, height }} className="border rounded bg-white overflow-hidden">
      <ViewerBoundary>
        <ReactStl url={url} shadows rotate modelProps={{ color: '#9ca3af' }} />
      </ViewerBoundary>
    </div>
  );
}

export default StlPreview;
