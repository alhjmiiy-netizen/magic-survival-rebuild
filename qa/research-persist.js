// Regression: Altar research ranks, points and gold persist across close/reopen, run start, reload; effects apply in run.
// usage: node research-persist.js <url> <shotdir> <tag>
const { chromium } = require('/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core');
const [,, url, dir, tag] = process.argv; const out = { tag }; let fail = 0;
const ok = (name, cond, info) => { out[name] = { pass: !!cond, info }; if (!cond) fail++; };
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/ungoogled-chromium/chrome', headless: true, args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const openAltar = async () => { const n = p.locator('[data-nav="research"]'); if (await n.count()) await n.tap(); else await p.locator('button:has-text("Altar")').first().tap(); await p.waitForSelector('text=Select Research'); await p.waitForTimeout(300); };
  const ranks = () => p.$$eval('button[title*="/"]', bs => Object.fromEntries(bs.map(x => x.title.match(/^(.*) \((\d+)\/(\d+)\)$/)).filter(Boolean).map(m => [m[1], +m[2]])));
  const header = () => p.evaluate(() => { const t = document.body.innerText; return { gold: (t.match(/Research[\s\S]*?([\d,]+)\s*\n/) || [])[0] }; });
  const closeAltar = async () => { await p.locator('text=Select Research').locator('xpath=ancestor::div[contains(@class,"fixed")]').locator('button').filter({ has: p.locator('svg.lucide-x') }).first().tap(); await p.waitForTimeout(300); };
  const startRun = async () => { const s = p.locator('[data-action="start"]'); if (await s.count()) { await s.tap(); await p.locator('[data-mode="regions"]').tap(); } else await p.locator('button:has-text("Fresh"), button:has-text("Begin"), button:has-text("Start")').first().tap();
    await p.waitForSelector('[data-modal="startspell"]', { timeout: 15000 }); await p.locator('[data-modal="startspell"] [data-choice]').first().tap(); await p.waitForTimeout(1200); return p.evaluate(() => ({ ...__engine.stats })); };
  await p.goto(url, { waitUntil: 'networkidle' }); await p.evaluate(() => localStorage.clear()); await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(800);
  const base = await startRun(); // baseline run stats with no research
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(800);
  // grant gold the normal way: gold is earned in a run; use the debug engine to add 2500 then quit by reload
  await startRun(); await p.evaluate(() => { __engine.stats.gold += 2500; __engine.callbacks?.onStatsUpdate?.({ ...__engine.stats }); });
  await p.waitForTimeout(600); const goldAfterRun = await p.evaluate(() => __engine.stats.gold);
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(800);
  const walletAfterReload = await p.evaluate(() => JSON.parse(localStorage.getItem('ms_research_v1') || '{"gold":0}').gold);
  await openAltar(); const r0 = await ranks(); const t0 = await p.innerText('[data-modal="research"], body');
  await p.locator('button:has-text("Purchase Research Points")').tap(); await p.waitForTimeout(200);
  for (const id of ['vitality', 'vitality', 'might', 'haste']) { await p.locator(`button[title^="${id === 'vitality' ? 'Vitality' : id === 'might' ? 'Might' : 'Haste'} ("]`).tap(); const eb = p.locator('button:has-text("Enhance")'); if (await eb.isEnabled()) await eb.tap(); else out.enhanceDisabled = (out.enhanceDisabled || 0) + 1; await p.waitForTimeout(150); }
  const r1 = await ranks(); await p.screenshot({ path: `${dir}/research-${tag}-1-bought.png` });
  await closeAltar(); await openAltar(); const r2 = await ranks(); await p.screenshot({ path: `${dir}/research-${tag}-2-reopen.png` });
  ok('reopen', JSON.stringify(r1) === JSON.stringify(r2), { r0, r1, r2 });
  await closeAltar(); const walletAfterBuy = await p.evaluate(() => JSON.parse(localStorage.getItem('ms_research_v1')).gold); const run = await startRun();
  ok('effects_in_run', run.maxHp - base.maxHp === 100 && run.spellPower - base.spellPower === 5 && run.cooldownReduction - base.cooldownReduction === 3, { base: [base.maxHp, base.spellPower, base.cooldownReduction], run: [run.maxHp, run.spellPower, run.cooldownReduction] });
  ok('gold_spent_persists', goldAfterRun > 0 && walletAfterBuy === walletAfterReload - 1000 && run.gold >= walletAfterBuy, { walletAfterBuy, goldAfterRun, walletAfterReload, runGold: run.gold });
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(800); await openAltar(); const r3 = await ranks(); await p.screenshot({ path: `${dir}/research-${tag}-3-reload.png` });
  ok('reload', JSON.stringify(r1) === JSON.stringify(r3), { r3 });
  ok('bought_changed', r1.Vitality === r0.Vitality + 2 && r1.Might === Math.min(6, r0.Might + 1), {});
  out.save = await p.evaluate(() => localStorage.getItem('ms_research_v1')); out.errors = errs;
  console.log(JSON.stringify(out, null, 1)); console.log(fail ? `FAIL (${fail})` : 'PASS'); await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
