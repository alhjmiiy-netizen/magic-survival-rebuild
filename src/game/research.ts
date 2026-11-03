// Persistent research (Altar) state: ranks, unspent points and the gold wallet.
// Saved to localStorage on every change; loaded on app start and applied at run start.
import { PlayerStats } from '../types/game';
import { INITIAL_RESEARCH_ATTRIBUTES } from '../components/UpgradeModal';

export const RESEARCH_KEY = 'ms_research_v1';
export interface ResearchSave { v: 1; points: number; ranks: Record<string, number>; gold: number }

const defaults = (): ResearchSave => ({
  v: 1, points: 3, gold: 0,
  ranks: Object.fromEntries(INITIAL_RESEARCH_ATTRIBUTES.map((a) => [a.id, a.rank])),
});

export function loadResearch(): ResearchSave {
  const d = defaults();
  try {
    const raw = localStorage.getItem(RESEARCH_KEY);
    if (!raw) return d;
    const r = JSON.parse(raw) as Partial<ResearchSave>;
    // migrate/merge: keep known ids, clamp to maxRank, new attributes get their default
    const ranks = { ...d.ranks };
    for (const a of INITIAL_RESEARCH_ATTRIBUTES) {
      const n = Number(r.ranks?.[a.id]);
      if (Number.isFinite(n)) ranks[a.id] = Math.max(0, Math.min(a.maxRank, Math.floor(n)));
    }
    const points = Number(r.points), gold = Number(r.gold);
    return { v: 1, ranks, points: Number.isFinite(points) && points >= 0 ? Math.floor(points) : d.points, gold: Number.isFinite(gold) && gold >= 0 ? gold : 0 };
  } catch { return d; }
}

export function saveResearch(s: ResearchSave) {
  try { localStorage.setItem(RESEARCH_KEY, JSON.stringify(s)); } catch { /* storage full/blocked */ }
}

export function saveGold(gold: number) {
  const s = loadResearch();
  if (s.gold !== gold) saveResearch({ ...s, gold: Math.max(0, gold) });
}

/** Apply `n` ranks (may be negative) of research `id` to stats in place. */
export function applyRankDelta(st: PlayerStats, id: string, n: number) {
  if (!n) return;
  switch (id) {
    case 'might': st.spellPower += 5 * n; break;
    case 'vitality': st.maxHp += 50 * n; st.hp = Math.max(1, Math.min(st.maxHp, st.hp + 50 * n)); break;
    case 'haste': st.cooldownReduction = Math.max(0, Math.min(60, st.cooldownReduction + 3 * n)); break;
    case 'snipe': st.critChance += 2.5 * n; break;
    case 'agility': st.speed += 0.15 * n; break;
    case 'explorer': st.pickupRadius += 25 * n; break;
    case 'saturation': st.maxMana += 40 * n; st.mana = Math.max(0, Math.min(st.maxMana, st.mana + 40 * n)); break;
  }
}

/** At run start: apply purchased ranks (relative to the starting defaults) and the saved gold wallet. */
export function applyResearch(st: PlayerStats, s: ResearchSave = loadResearch()) {
  const d = defaults();
  for (const id of Object.keys(s.ranks)) applyRankDelta(st, id, s.ranks[id] - (d.ranks[id] ?? 0));
  st.gold = s.gold;
  return st;
}
