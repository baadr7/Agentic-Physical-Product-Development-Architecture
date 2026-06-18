// Text-to-image generation via Pollinations.ai — keyless and offline-free.
// The prompt is encoded directly into a GET URL that returns a freshly generated
// image, so the studio renders *exactly* what the prompt describes (no parametric
// stand-in). Drop the URL into an <img src> and the image generates on request.
// Docs: https://pollinations.ai
import type { Concept, Lang } from '@/types';

export interface ImageOptions {
  width?: number;
  height?: number;
  seed?: number;
  /** Pollinations model id. 'flux' = best quality, 'turbo' = faster. */
  model?: string;
}

const ENDPOINT = 'https://image.pollinations.ai/prompt/';

/**
 * Build the Pollinations image URL for a prompt. Each distinct `seed` yields a
 * different image for the same prompt, which is how iterations stay distinct.
 */
export function pollinationsUrl(prompt: string, opts: ImageOptions = {}): string {
  const { width = 768, height = 768, seed, model = 'flux' } = opts;
  const params = new URLSearchParams({
    width: String(width),
    height: String(height),
    model,
    nologo: 'true',
  });
  if (seed !== undefined) params.set('seed', String(seed));
  return `${ENDPOINT}${encodeURIComponent(prompt.trim())}?${params.toString()}`;
}

/** A random seed so repeated generations of the same prompt differ. */
export function randomSeed(): number {
  return Math.floor(Math.random() * 1_000_000);
}

// How each manufacturing process should *look* in the render, so the image
// reflects the concept's actual structure rather than a generic valve.
const PROCESS_LOOK: Record<Concept['fbs']['structure']['process'], { fr: string; en: string }> = {
  casting: {
    fr: 'corps moulé par coulée, texture de fonderie, finition métal brut légèrement granuleuse',
    en: 'cast body, foundry surface texture, slightly grainy as-cast metal finish',
  },
  cnc: {
    fr: 'corps usiné CNC, surfaces fraisées de précision, finition métal brossé net',
    en: 'CNC-machined body, precision-milled surfaces, clean brushed-metal finish',
  },
  hybrid: {
    fr: "corps hybride avec insert en acier inox visible, finition métal brossé bi-matière",
    en: 'hybrid body with a visible stainless-steel insert, two-material brushed-metal finish',
  },
};

/** Pull a pressure class (e.g. "PN16") from the concept's functional requirements. */
function pressureClass(concept: Concept): string | null {
  for (const r of concept.fbs.function?.requirements ?? []) {
    const m = r.match(/PN\s?\d+/i);
    if (m) return m[0].replace(/\s+/g, '').toUpperCase();
  }
  return null;
}

/**
 * A detailed starting prompt built from the generated concept and the product
 * being designed — every spec (product, material, process, geometry, mass) so the
 * generated image is specific to *this* concept. Valve concepts (curated DN100
 * set) get valve-specific detail; generated concepts describe a generic part for
 * the actual product. Fully editable.
 */
export function defaultPromptFromSpec(concept: Concept, productName: string | undefined, lang: Lang = 'fr'): string {
  const s = concept.fbs.structure;
  const look = PROCESS_LOOK[s.process];
  const product = (productName && productName.trim()) || concept.name;
  const isValve = s.bore_mm > 0;

  if (isValve) {
    const pn = pressureClass(concept);
    const rating = `DN${s.bore_mm}${pn ? ` ${pn}` : ''}`;
    if (lang === 'en') {
      return [
        `Photorealistic industrial product render of concept "${concept.name}", a ${rating} butterfly valve body`,
        `material ${s.material}`,
        look.en,
        `${s.wall_mm} mm wall thickness`,
        `${s.flanges} bolted flanges`,
        `${s.length_mm} mm face-to-face length`,
        `${s.bore_mm} mm bore with a central butterfly disc and a top actuator stem`,
        `approx. ${concept.mass_kg} kg`,
        'isometric three-quarter view, neutral studio background, soft studio lighting, sharp focus, high detail, engineering product shot',
      ].join(', ');
    }
    return [
      `Rendu produit industriel photoréaliste du concept « ${concept.name} », un corps de vanne papillon ${rating}`,
      `matériau ${s.material}`,
      look.fr,
      `paroi de ${s.wall_mm} mm`,
      `brides ${s.flanges}`,
      `longueur ${s.length_mm} mm`,
      `alésage ${s.bore_mm} mm avec papillon central et tige d'actionneur en haut`,
      `masse ≈ ${concept.mass_kg} kg`,
      'vue isométrique trois-quarts, fond studio neutre, éclairage doux, mise au point nette, haute définition, photo produit technique',
    ].join(', ');
  }

  // Generic product (generated concept set).
  if (lang === 'en') {
    return [
      `Photorealistic industrial product render of ${product}`,
      `concept "${concept.name}"`,
      `material ${s.material}`,
      look.en,
      `${s.wall_mm} mm wall thickness`,
      `approx. ${s.length_mm} mm characteristic size`,
      `approx. ${concept.mass_kg} kg`,
      'isometric three-quarter view, neutral studio background, soft studio lighting, sharp focus, high detail, engineering product shot',
    ].join(', ');
  }
  return [
    `Rendu produit industriel photoréaliste de ${product}`,
    `concept « ${concept.name} »`,
    `matériau ${s.material}`,
    look.fr,
    `paroi de ${s.wall_mm} mm`,
    `taille caractéristique ≈ ${s.length_mm} mm`,
    `masse ≈ ${concept.mass_kg} kg`,
    'vue isométrique trois-quarts, fond studio neutre, éclairage doux, mise au point nette, haute définition, photo produit technique',
  ].join(', ');
}
