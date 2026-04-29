import type { DfxSummary, Project, Run, Variant } from './types';

export const MOCK_PROJECT: Project = {
  id: 'proj-1',
  user_id: 'user-1',
  title: 'Ergonomic Desk Chair',
  logo_url: 'https://via.placeholder.com/128x128?text=EDC',
  description: 'Minimal office chair with a lightweight frame and modular seat shell.',
  product_type: 'furniture',
  brief:
    'Create a comfortable office chair with a clean silhouette, metal legs, foam seating, and manufacturable modular parts.',
  materials: ['Aluminum', 'EVA foam', 'Technical fabric'],
  constraints: {
    height_cm: 85,
    width_cm: 65,
    depth_cm: 65,
    max_weight_kg: 80,
    fabrication_method: 'injection_molding',
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const MOCK_RUNS: Run[] = [
  {
    id: 'run-1',
    run_id: 'run_20250112_001',
    project_id: 'proj-1',
    status: 'completed',
    started_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    finished_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    duration_ms: 180000,
    parameters: {
      guidance_scale: 7.5,
      seed: 42,
      steps: 20,
      preset_material: 'metal_and_fabric',
    },
    created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  },
  {
    id: 'run-2',
    run_id: 'run_20250112_002',
    project_id: 'proj-1',
    status: 'completed',
    started_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    finished_at: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    duration_ms: 180000,
    parameters: {
      guidance_scale: 7.5,
      seed: 123,
      steps: 20,
      preset_material: 'plastic_and_metal',
    },
    created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
  },
  {
    id: 'run-3',
    run_id: 'run_20250112_003',
    project_id: 'proj-2',
    status: 'processing',
    started_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    duration_ms: undefined,
    parameters: {
      guidance_scale: 8.0,
      seed: 999,
      steps: 25,
      preset_material: 'wood_and_metal',
    },
    created_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
  },
];

export const MOCK_VARIANTS: Variant[] = [
  {
    id: 'var-1',
    run_id: 'run_20250112_001',
    thumbnail_url: 'https://via.placeholder.com/400x300?text=Chair+Design+1',
    image_url: 'https://via.placeholder.com/800x600?text=Chair+Design+1',
    stl_url: '/models/chair-1.stl',
    step_url: '/models/chair-1.step',
    metrics: {
      mass: 4.2,
      safety_factor: 2.5,
      fabricability_score: 0.85,
      sustainability_score: 0.72,
    },
    score: 8.5,
    dfx_analysis: 'Fabricable design with strong structural performance.',
    created_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
  },
  {
    id: 'var-2',
    run_id: 'run_20250112_002',
    thumbnail_url: 'https://via.placeholder.com/400x300?text=Chair+Design+2',
    image_url: 'https://via.placeholder.com/800x600?text=Chair+Design+2',
    stl_url: '/models/chair-2.stl',
    step_url: '/models/chair-2.step',
    metrics: {
      mass: 3.8,
      safety_factor: 2.8,
      fabricability_score: 0.92,
      sustainability_score: 0.78,
    },
    score: 9.1,
    dfx_analysis: 'Better mass optimization and easier manufacturing.',
    created_at: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
  },
];

export const MOCK_DFX_SUMMARY: DfxSummary = {
  variant_id: 'var-1',
  summary:
    'The chair concept balances manufacturability, assembly, and sustainability. The geometry uses simple parting lines, the fasteners are easy to access, and the material choices support modular repair.',
  fabricability_score: 0.85,
  assemblability_score: 0.88,
  sustainability_score: 0.72,
  recommendations: [
    'Add internal ribs to improve stiffness.',
    'Use recycled content for the base where possible.',
    'Reduce visible fasteners from four to two.',
  ],
  created_at: new Date().toISOString(),
};

export const MOCK_PROJECTS: Project[] = [
  MOCK_PROJECT,
  {
    id: 'proj-2',
    user_id: 'user-1',
    title: 'Connected Desk Lamp',
    logo_url: 'https://via.placeholder.com/128x128?text=CDL',
    description: 'IoT desk lamp with app controls and efficient RGB lighting.',
    product_type: 'electronics',
    brief: 'Design a desk lamp with RGB LEDs, Wi-Fi control, and voice assistant compatibility.',
    materials: ['Aluminum', 'ABS plastic', 'Glass'],
    constraints: {
      height_cm: 40,
      power_consumption_w: 15,
      battery_life_hours: 8,
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];
