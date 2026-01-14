"use client";

import React, { useEffect, useRef, useState } from 'react';

// Enabled via env flag; default disabled to avoid SSR issues if three isn't available
function parseEnvBoolean(value: string | undefined, defaultValue = false) {
  if (value == null) return defaultValue;
  const normalized = value.trim().toLowerCase();

  if (['1', 'true', 'yes', 'y', 'on', 'enabled'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off', 'disabled', ''].includes(normalized)) return false;

  return defaultValue;
}

const ENABLE_GLTF = parseEnvBoolean(process.env.NEXT_PUBLIC_ENABLE_GLTF_VIEWER, false);

interface GltfViewerProps {
  url: string;
  width?: number;
  height?: number;
  autoRotate?: boolean;
}

export default function GltfViewer({ url, width = 600, height = 400, autoRotate = true }: GltfViewerProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!ENABLE_GLTF) return; // respect flag
    if (!url) return;
    let disposed = false;
    let animationId: number | null = null;
    async function init() {
      try {
        const THREE = await import('three');
        const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
        const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');

        if (disposed) return;
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xffffff);
        const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
        camera.position.set(2, 2, 2);

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(window.devicePixelRatio || 1);
        mountRef.current?.appendChild(renderer.domElement);

        const ambient = new THREE.AmbientLight(0xffffff, 0.8);
        scene.add(ambient);
        const dir = new THREE.DirectionalLight(0xffffff, 0.6);
        dir.position.set(5, 10, 7);
        scene.add(dir);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.autoRotate = autoRotate;
        controls.autoRotateSpeed = 1.2;

        const loader = new GLTFLoader();
        loader.load(url, (gltf) => {
          scene.add(gltf.scene);
          // Fit camera to object bounding box
          try {
            const box = new THREE.Box3().setFromObject(gltf.scene);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const fov = camera.fov * (Math.PI / 180);
            let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
            cameraZ *= 1.4; // add margin
            camera.position.z = cameraZ;
            camera.lookAt(center);
            controls.target.copy(center);
            controls.update();
          } catch (_) {}
        }, undefined, () => {
          setFailed(true);
        });

        function animate() {
          if (disposed) return;
            animationId = requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
        }
        animate();

        const handleResize = () => {
          if (!mountRef.current) return;
          const w = width;
          const h = height;
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        };
        window.addEventListener('resize', handleResize);

        return () => {
          disposed = true;
          window.removeEventListener('resize', handleResize);
          if (animationId) cancelAnimationFrame(animationId);
          try { controls.dispose(); } catch (_) {}
          try { renderer.dispose(); } catch (_) {}
          if (mountRef.current) {
            while (mountRef.current.firstChild) {
              mountRef.current.removeChild(mountRef.current.firstChild);
            }
          }
        };
      } catch (e) {
        console.warn('GLTF viewer init failed:', e);
        setFailed(true);
      }
    }
    const cleanupPromise = init();
    return () => { disposed = true; (async () => { await cleanupPromise; })(); };
  }, [url, width, height, autoRotate]);

  if (!url) return null;
  if (!ENABLE_GLTF) {
    return <div style={{ width, height }} className="flex items-center justify-center text-xs text-slate-500 border rounded bg-white">Aperçu glTF désactivé.</div>;
  }
  if (failed) {
    return <div style={{ width, height }} className="flex items-center justify-center text-xs text-red-600 border rounded bg-white">Échec chargement glTF.</div>;
  }
  return <div ref={mountRef} style={{ width, height }} className="border rounded bg-white overflow-hidden" />;
}
