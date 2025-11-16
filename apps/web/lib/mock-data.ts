/**
 * Mock data for development
 */

import { Project, Run, Variant, DfxSummary } from './types';

export const MOCK_PROJECT: Project = {
  id: 'proj-1',
  user_id: 'user-1',
  title: 'Chaise Minimaliste',
  logo_url: 'https://via.placeholder.com/128x128?text=CM',
  description: 'Chaise de bureau ergonomique avec design minimaliste',
  product_type: 'furniture',
  brief:
    'Créer une chaise de bureau confortable et esthétique avec pieds en métal et assise en mousse.',
  materials: ['Métal', 'Mousse EVA', 'Tissu'],
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
    started_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 min ago
    finished_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(), // 2 min ago
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
    project_id: 'proj-1',
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
    dfx_analysis: 'Design fabricable, bonne performance structurelle.',
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
    dfx_analysis: 'Meilleure optimisation de masse, très fabricable.',
    created_at: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
  },
];

export const MOCK_DFX_SUMMARY: DfxSummary = {
  variant_id: 'var-1',
  summary: `Cette conception de chaise minimaliste présente une excellente combinaison de facteurs DfX :

1. **Fabricabilité**: Le design utilise des formes simples et des angles rasants, 
   ce qui rend la production par injection plastique très efficace.

2. **Assemblabilité**: Tous les composants se clipsent facilement. Les jointures
   sont simples et nécessitent peu d'outils spécialisés.

3. **Durabilité**: Les matériaux sélectionnés (mousse EVA + tissu technique) offrent
   une longévité de 5-7 ans en utilisation continue.

4. **Recyclabilité**: 100% des composants sont recyclables séparément.

Recommandations : Ajouter des renforts internes pour améliorer le facteur de 
sécurité structural de 2.5 à 3.0+.`,
  fabricability_score: 0.85,
  assemblability_score: 0.88,
  sustainability_score: 0.72,
  recommendations: [
    'Ajouter des renforts internes pour meilleure rigidité',
    'Utiliser des matériaux recyclés pour la base',
    'Réduire le nombre de vis à 2 (actuellement 4)',
  ],
  created_at: new Date().toISOString(),
};

export const MOCK_PROJECTS: Project[] = [
  MOCK_PROJECT,
  {
    id: 'proj-2',
    user_id: 'user-1',
    title: 'Lampe Connectée',
    logo_url: 'https://via.placeholder.com/128x128?text=LC',
    description: 'Lampe de bureau IoT avec contrôle via app mobile',
    product_type: 'electronics',
    brief: 'Lampe de bureau avec LED RGB, compatible Wi-Fi et voice control.',
    materials: ['Aluminium', 'Plastique ABS', 'Verre'],
    constraints: {
      height_cm: 40,
      power_consumption_w: 15,
      battery_life_hours: 8,
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];
