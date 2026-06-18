// Drives the running APDA app (http://localhost:5174) with headless Edge and saves
// screenshots of every screen to /tmp/apda_shots for the report. Throwaway helper.
const puppeteer = require('puppeteer-core');
const path = require('node:path');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = process.env.SHOTS_DIR || 'C:\\Users\\ADAMEL~1\\AppData\\Local\\Temp\\claude\\apda_shots';
const BASE = 'http://localhost:5174';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const fs = require('node:fs');
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--window-size=1440,1000'],
    defaultViewport: { width: 1440, height: 1000, deviceScaleFactor: 1.5 },
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);

  const shot = async (name, fullPage = true) => {
    await sleep(500);
    await page.screenshot({ path: path.join(OUT, name), fullPage });
    console.log('shot', name);
  };
  const waitText = async (txt, timeout = 20000) => {
    await page.waitForFunction((t) => document.body && document.body.innerText.includes(t), { timeout }, txt);
  };
  const clickText = async (re) => {
    const ok = await page.evaluate((src) => {
      const rx = new RegExp(src, 'i');
      const el = [...document.querySelectorAll('button,a')].find((b) => rx.test(b.textContent || ''));
      if (el) { el.click(); return true; }
      return false;
    }, re);
    if (!ok) console.log('  (button not found:', re, ')');
    return ok;
  };
  const goto = async (p) => {
    await page.evaluate((path) => { history.pushState({}, '', path); dispatchEvent(new PopStateEvent('popstate')); }, p);
    await sleep(900);
  };

  try {
    // E1 — scenario selection
    await page.goto(BASE + '/', { waitUntil: 'networkidle2' });
    await waitText('Choix du scénario');
    await shot('01_e1_scenarios.png');

    // pick S2 (DN100 valve — the reference scenario) to reveal config
    await clickText('Industriel défaut');
    await waitText('Priorités DFx');
    await shot('02_e1_config.png');

    // E2 — constraints
    await goto('/e2');
    await waitText('contraintes techniques');
    await shot('03_e2_constraints.png');

    // E3 — supervised run, paused at the first review gate
    await goto('/e3');
    await waitText('en attente de votre revue', 20000);
    await shot('04_e3_gate.png');

    // finish the rest autonomously
    await clickText('Continuer sans interruption');
    await waitText('Voir les concepts', 30000);
    await sleep(800);
    await shot('05_e3_done.png');

    // Agent sub-screen (generation)
    await goto('/e3/generation');
    await waitText('Sorties');
    await shot('06_agent_subscreen.png');

    // Workflow chain + RAG custom fields
    await goto('/workflow');
    await waitText('orchestration');
    await clickText('Interroger le RAG');
    await sleep(2500);
    await shot('07_workflow_rag.png');

    // E4 — concepts
    await goto('/e4');
    await waitText('Concepts générés');
    await shot('08_e4_concepts.png');

    // E5 — concept detail + image studio
    await goto('/e5/A');
    await waitText("Studio d'image");
    await shot('09_e5_detail.png');

    // generate an image, wait for it to load + be archived
    await clickText("Générer l'image");
    try {
      await page.waitForFunction(() => {
        const imgs = [...document.querySelectorAll('img')].filter((i) => i.src && i.src.includes('pollinations'));
        return imgs.some((i) => i.naturalWidth > 50);
      }, { timeout: 35000 });
    } catch (e) { console.log('  image load wait timed out'); }
    await sleep(1500);
    await shot('10_image_studio.png');

    // E6 — selection
    await goto('/e6');
    await waitText('Sélection HITL');
    await shot('11_e6_selection.png');

    // select #1 -> E7 gate review (auto-saves)
    await clickText('Sélectionner #1');
    await waitText('Gate Review');
    await sleep(3500); // let auto-save complete
    await shot('12_e7_gate.png');

    // E8 — glossary
    await goto('/e8');
    await sleep(800);
    await shot('13_e8_glossary.png');

    console.log('DONE');
  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    await browser.close();
  }
})();
