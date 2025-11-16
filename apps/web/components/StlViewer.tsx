"use client";

import dynamic from 'next/dynamic';
import React from 'react';

// react-stl-viewer uses WebGL; load only on client
const ReactStlViewer = dynamic(() => import('react-stl-viewer').then(m => m.StlViewer || (m as any).default), { ssr: false });

export function StlPreview({ url, width = 400, height = 300 }: { url: string; width?: number; height?: number }){
  if (!url) return null;
  return (
    <div style={{ width, height }} className="border rounded bg-white">
      {/* @ts-expect-error dynamic import type */}
      <ReactStlViewer url={url} shadows rotate modelProps={{ color: '#9ca3af' }} />
    </div>
  );
}

export default StlPreview;
