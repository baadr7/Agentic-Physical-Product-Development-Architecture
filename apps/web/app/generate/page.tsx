"use client";
import { useState, useEffect } from "react";

type RunResponse = { run_id: string };
type Variant = { id: string; image_url?: string; asset_url?: string };

export default function GeneratePage() {
  const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
    "http://127.0.0.1:8000";

  const [prompt, setPrompt] = useState(
    "photo réaliste d'un clavier mécanique design sur fond blanc, lumière douce"
  );
  const [sizeCm, setSizeCm] = useState(5);
  const [projectId, setProjectId] = useState("project-1");
  const [runId, setRunId] = useState<string | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startRun() {
    setLoading(true);
    setError(null);
    setVariants([]);
    try {
      const body = {
        project_id: projectId,
        options: { prompt, size_cm: sizeCm },
      };
      const res = await fetch(`${API_BASE}/api/v1/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Run create failed: ${res.status}`);
      const json = (await res.json()) as RunResponse;
      setRunId(json.run_id);
    } catch (e: any) {
      setError(e.message || "Erreur lors de la création de run");
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!runId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/runs/${runId}/variants`);
        if (!res.ok) throw new Error(`Poll failed: ${res.status}`);
        const json = (await res.json()) as unknown;
        const list: Variant[] = Array.isArray(json)
          ? (json as Variant[])
          : ((json as any)?.variants as Variant[]) || [];
        if (!cancelled) {
          setVariants(list);
          // simple stop when we have at least one asset
          const hasAsset = list.some((v) => v.asset_url || v.image_url);
          if (!hasAsset) setTimeout(poll, 2000);
          else setLoading(false);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e.message || "Erreur lors du polling variants");
          setLoading(false);
        }
      }
    };
    poll();
    return () => {
      cancelled = true;
    };
  }, [runId]);

  return (
    <div style={{ maxWidth: 800, margin: "24px auto", padding: 16 }}>
      <h1>Génération d'images (Makerkit)</h1>
      <p>
        Saisissez un prompt en français (ex: clavier mécanique, bouteille de
        parfum design) et lancez la génération.
      </p>

      <div style={{ display: "grid", gap: 12 }}>
        <label>
          Prompt
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            style={{ width: "100%" }}
          />
        </label>
        <label>
          Taille (cm)
          <input
            type="number"
            value={sizeCm}
            onChange={(e) => setSizeCm(Number(e.target.value))}
            style={{ width: 120 }}
          />
        </label>
        <label>
          Project ID
          <input
            type="text"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            style={{ width: "100%" }}
          />
        </label>
        <button onClick={startRun} disabled={loading}>
          {loading ? "En cours..." : "Lancer la génération"}
        </button>
        {error && (
          <div style={{ color: "#b00020" }}>Erreur: {error}</div>
        )}
      </div>

      <h2 style={{ marginTop: 24 }}>Résultats</h2>
      {variants.length === 0 && <p>Aucun variant pour le moment.</p>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {variants.map((v) => {
          const src = v.image_url || v.asset_url;
          return (
            <div key={v.id} style={{ border: "1px solid #eee", padding: 8 }}>
              <p>Variant: {v.id}</p>
              {src ? (
                // Supports data URLs or http URLs
                <img src={src} alt={`variant ${v.id}`} style={{ width: "100%" }} />
              ) : (
                <p>Pas d'image disponible</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
