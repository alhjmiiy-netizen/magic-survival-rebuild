import React, { useState } from 'react';
import { X, RotateCcw, Plus, Circle, Check } from 'lucide-react';
import { ResearchIcon } from './ResearchIcon';
import { PlayerStats } from '../types/game';
import { sound } from '../audio/soundEngine';
import { loadResearch, saveResearch, applyRankDelta } from '../game/research';

interface UpgradeModalProps {
  stats: PlayerStats;
  onUpdateStats: (newStats: PlayerStats) => void;
  onClose: () => void;
}

export interface ResearchAttribute {
  id: string;
  name: string;
  description: string;
  rank: number;
  maxRank: number;
  statKey: string;
  bonusPerRank: number;
  bonusUnit: string;
}

export const INITIAL_RESEARCH_ATTRIBUTES: ResearchAttribute[] = [
  // Row 1
  { id: 'growth', name: 'Growth', description: 'Increases EXP gained from all defeated enemies and mana orbs.', rank: 1, maxRank: 5, statKey: 'expMultiplier', bonusPerRank: 4, bonusUnit: '%' },
  { id: 'vitality', name: 'Vitality', description: 'Increases maximum Health capacity across all characters.', rank: 1, maxRank: 5, statKey: 'maxHp', bonusPerRank: 50, bonusUnit: ' HP' },
  { id: 'bloodthirst', name: 'Regeneration', description: 'Restores health continuously every 5 seconds.', rank: 1, maxRank: 5, statKey: 'hpRegen', bonusPerRank: 3, bonusUnit: ' HP/s' },
  { id: 'might', name: 'Might', description: 'Increases base spell attack damage and explosion potency.', rank: 5, maxRank: 6, statKey: 'spellPower', bonusPerRank: 5, bonusUnit: '%' },
  { id: 'snipe', name: 'Snipe', description: 'Increases critical strike chance on all magic projectiles.', rank: 1, maxRank: 5, statKey: 'critChance', bonusPerRank: 2.5, bonusUnit: '%' },

  // Row 2
  { id: 'resistance', name: 'Resistance', description: 'Reduces all incoming demonic physical and touch damage.', rank: 2, maxRank: 4, statKey: 'damageReduction', bonusPerRank: 4, bonusUnit: '%' },
  { id: 'agility', name: 'Agility', description: 'Increases base character movement and sprint speed.', rank: 1, maxRank: 4, statKey: 'speed', bonusPerRank: 0.15, bonusUnit: ' spd' },
  { id: 'haste', name: 'Haste', description: 'Reduces cooldown interval across all equipped spells.', rank: 0, maxRank: 4, statKey: 'cooldownReduction', bonusPerRank: 3, bonusUnit: '%' },
  { id: 'recovery', name: 'Recovery', description: 'Amplifies health orb healing amount and pickup vitality.', rank: 1, maxRank: 4, statKey: 'healingAmp', bonusPerRank: 10, bonusUnit: '%' },
  { id: 'explorer', name: 'Explorer', description: 'Expands attraction radius for mana orbs, crystals, and gold.', rank: 3, maxRank: 4, statKey: 'pickupRadius', bonusPerRank: 25, bonusUnit: ' px' },

  // Row 3
  { id: 'saturation', name: 'Saturation', description: 'Increases maximum Mana pool and natural mana regeneration.', rank: 3, maxRank: 4, statKey: 'maxMana', bonusPerRank: 40, bonusUnit: ' MP' },
  { id: 'expansion', name: 'Expansion', description: 'Enlarges the area of effect (AoE) radius of all spells.', rank: 2, maxRank: 4, statKey: 'spellArea', bonusPerRank: 5, bonusUnit: '%' },
  { id: 'transmutation', name: 'Transmutation', description: 'Grants extra free magic upgrade rerolls on level-up.', rank: 2, maxRank: 3, statKey: 'rerollCount', bonusPerRank: 1, bonusUnit: ' Reroll' },
  { id: 'arcana', name: 'Arcana', description: 'Increases grimoire choices and spell assimilation slots.', rank: 0, maxRank: 5, statKey: 'spellSlots', bonusPerRank: 1, bonusUnit: ' Slot' },

  // Row 4
  { id: 'evasion', name: 'Evasion', description: 'Grants a chance to completely phase through enemy attacks.', rank: 1, maxRank: 3, statKey: 'evasion', bonusPerRank: 3, bonusUnit: '%' },
  { id: 'penetration', name: 'Penetration', description: 'Increases piercing count on missiles and beam magics.', rank: 3, maxRank: 5, statKey: 'pierce', bonusPerRank: 1, bonusUnit: ' Pierce' },
  { id: 'origin', name: 'Origin Essence', description: 'Increases value of collected blue mana crystals.', rank: 3, maxRank: 4, statKey: 'crystalValue', bonusPerRank: 15, bonusUnit: '%' },
  { id: 'bounty', name: 'Bounty', description: 'Increases gold coins dropped by defeated demons and bosses.', rank: 1, maxRank: 5, statKey: 'goldGain', bonusPerRank: 10, bonusUnit: '%' },

  // Row 5
  { id: 'fortune', name: 'Fortune', description: 'Increases treasure chest spawn rate and rare relic rolls.', rank: 1, maxRank: 5, statKey: 'luck', bonusPerRank: 5, bonusUnit: '%' },
  { id: 'rebirth', name: 'Rebirth', description: 'Grants an automatic resurrection upon taking fatal damage.', rank: 1, maxRank: 5, statKey: 'reviveCount', bonusPerRank: 1, bonusUnit: ' Revive' },
  { id: 'curse_ward', name: 'Curse Ward', description: 'Reduces duration of crowd control and hazard slowdown.', rank: 1, maxRank: 5, statKey: 'tenacity', bonusPerRank: 8, bonusUnit: '%' },
  { id: 'fusion_mastery', name: 'Fusion Mastery', description: 'Amplifies damage and area of all combined combo magics.', rank: 3, maxRank: 6, statKey: 'fusionPower', bonusPerRank: 10, bonusUnit: '%' },
];

export const UpgradeModal: React.FC<UpgradeModalProps> = ({ stats, onUpdateStats, onClose }) => {
  // Persisted: loaded from localStorage on every mount, saved synchronously on every change.
  const [saved] = useState(loadResearch);
  const [researchPoints, setResearchPoints] = useState<number>(saved.points);
  const [attributes, setAttributes] = useState<ResearchAttribute[]>(() =>
    INITIAL_RESEARCH_ATTRIBUTES.map((a) => ({ ...a, rank: saved.ranks[a.id] ?? a.rank }))
  );
  const [selectedId, setSelectedId] = useState<string>('might');
  const [isPurchasing, setIsPurchasing] = useState(false);

  const selectedAttr = attributes.find((a) => a.id === selectedId) || attributes[0];

  const commit = (attrs: ResearchAttribute[], points: number, gold: number) => {
    setAttributes(attrs);
    setResearchPoints(points);
    saveResearch({ v: 1, points, gold, ranks: Object.fromEntries(attrs.map((a) => [a.id, a.rank])) });
  };

  const handleEnhance = () => {
    if (researchPoints <= 0 || selectedAttr.rank >= selectedAttr.maxRank) return;
    sound.playLevelUp();
    const next = attributes.map((a) => (a.id === selectedAttr.id ? { ...a, rank: a.rank + 1 } : a));
    commit(next, researchPoints - 1, stats.gold);
    const updated = { ...stats };
    applyRankDelta(updated, selectedAttr.id, 1);
    onUpdateStats(updated);
  };

  const handleReset = () => {
    sound.playItemUse();
    const updated = { ...stats };
    let totalSpent = 0;
    attributes.forEach((a) => { totalSpent += a.rank; applyRankDelta(updated, a.id, -a.rank); });
    commit(attributes.map((a) => ({ ...a, rank: 0 })), researchPoints + totalSpent, stats.gold);
    onUpdateStats(updated);
  };

  const handleBuyPoint = () => {
    const cost = 1000;
    if (stats.gold >= cost) {
      sound.playLevelUp();
      commit(attributes, researchPoints + 1, stats.gold - cost);
      onUpdateStats({ ...stats, gold: stats.gold - cost });
    }
  };

  return (
    <div data-modal="research" className="fixed inset-0 z-50 flex items-center justify-center bg-black select-none font-sans animate-in fade-in duration-200">
      {/* Container: Matches Screenshot_20261102_164046_Magic Survival */}
      <div className="relative w-full max-w-lg md:max-w-xl h-full max-h-[96vh] bg-black text-white flex flex-col justify-between overflow-hidden px-4 py-4 sm:px-6">
        
        {/* 1. Top Header: Research Points Token, Title "Research", Close X */}
        <div className="flex items-center justify-between relative z-10 pt-2 pb-1">
          {/* Left: Research Points Pill */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full border-2 border-white/80 flex items-center justify-center font-cinzel font-bold text-lg text-white shadow-[0_0_12px_rgba(255,255,255,0.4)]">
              {researchPoints}
            </div>
            <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-amber-400">
              <Circle className="w-3.5 h-3.5 fill-amber-400" />
              <span>{stats.gold.toLocaleString()}</span>
            </div>
          </div>

          {/* Center: Title "Research" in iconic brush typography */}
          <div className="text-center absolute left-1/2 -translate-x-1/2">
            <h2 className="text-2xl sm:text-3xl font-black font-cinzel tracking-wider text-white drop-shadow-[0_2px_10px_rgba(255,255,255,0.2)]">
              Research
            </h2>
          </div>

          {/* Right: Close X */}
          <button
            onClick={() => {
              sound.playItemUse();
              onClose();
            }}
            className="p-1.5 text-stone-300 hover:text-white transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-7 h-7 stroke-[2.5]" />
          </button>
        </div>

        {/* Subheading: "Select Research" */}
        <div className="text-center my-1">
          <span className="text-xs font-cinzel tracking-[0.25em] text-stone-400 uppercase font-semibold">
            Select Research
          </span>
        </div>

        {/* 2. 5-Column Grid of 22 Pale Gold Linocut Research Icons */}
        <div className="flex-1 overflow-y-auto py-2 my-auto">
          <div className="grid grid-cols-5 gap-y-4 gap-x-2 sm:gap-x-4 max-w-md mx-auto items-center justify-items-center">
            {attributes.map((attr) => {
              const isSelected = attr.id === selectedId;
              const isMaxed = attr.rank >= attr.maxRank;

              return (
                <button
                  key={attr.id}
                  data-research={attr.id}
                  data-rank={attr.rank}
                  onClick={() => {
                    sound.playItemUse();
                    setSelectedId(attr.id);
                  }}
                  className={`relative flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-200 cursor-pointer group ${
                    isSelected
                      ? 'bg-stone-900/90 border border-amber-400/80 shadow-[0_0_16px_rgba(251,191,36,0.35)] scale-110'
                      : 'hover:bg-stone-900/40 border border-transparent'
                  }`}
                  title={`${attr.name} (${attr.rank}/${attr.maxRank})`}
                >
                  {/* Pale Gold Icon */}
                  <div className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center transition-transform group-hover:scale-105">
                    <ResearchIcon
                      id={attr.id}
                      className="w-9 h-9 sm:w-10 sm:h-10"
                      color={isSelected ? '#fef08a' : isMaxed ? '#fde047' : '#eab308'}
                    />
                  </div>

                  {/* Dot Matrix Level Pips below each icon (e.g. •••••○) matching screenshot */}
                  <div className="flex items-center gap-0.5 mt-1.5">
                    {Array.from({ length: attr.maxRank }).map((_, i) => (
                      <span
                        key={i}
                        className={`inline-block rounded-full transition-all ${
                          i < attr.rank
                            ? 'w-1.5 h-1.5 bg-[#fde047] shadow-[0_0_4px_#fde047]'
                            : 'w-1.5 h-1.5 border border-stone-600 bg-transparent'
                        }`}
                      />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Selected Attribute Details & Upgrade Inspector */}
        <div className="bg-[#0b0e14] border border-stone-800 rounded-xl p-3 sm:p-4 my-2 text-stone-200 shadow-xl">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <h3 className="font-cinzel font-bold text-base sm:text-lg text-[#fef08a]">
                {selectedAttr.name}
              </h3>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-stone-900 border border-stone-700 text-stone-300">
                Rank {selectedAttr.rank} / {selectedAttr.maxRank}
              </span>
            </div>

            {/* Current & Next Rank readout */}
            <div className="text-xs font-mono font-bold text-emerald-400">
              +{selectedAttr.rank * selectedAttr.bonusPerRank}{selectedAttr.bonusUnit}
              {selectedAttr.rank < selectedAttr.maxRank && (
                <span className="text-stone-400 font-normal">
                  {' '}→ +{(selectedAttr.rank + 1) * selectedAttr.bonusPerRank}{selectedAttr.bonusUnit}
                </span>
              )}
            </div>
          </div>

          <p className="text-xs text-stone-400 font-sans leading-relaxed mb-3">
            {selectedAttr.description}
          </p>

          {/* Action Row */}
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-stone-800">
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-white text-xs font-cinzel transition-colors cursor-pointer border border-stone-700"
              title="Reset all Research Points for free"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Points</span>
            </button>

            <button
              onClick={handleEnhance}
              disabled={researchPoints <= 0 || selectedAttr.rank >= selectedAttr.maxRank}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg font-cinzel font-bold text-xs tracking-wider transition-all shadow-lg cursor-pointer ${
                selectedAttr.rank >= selectedAttr.maxRank
                  ? 'bg-stone-800 text-stone-500 cursor-not-allowed'
                  : researchPoints > 0
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 active:scale-95 text-stone-950 font-black'
                  : 'bg-stone-900 border border-stone-700 text-stone-400 cursor-not-allowed'
              }`}
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>
                {selectedAttr.rank >= selectedAttr.maxRank
                  ? 'MAX RANK'
                  : `Enhance (1 Point)`}
              </span>
            </button>
          </div>
        </div>

        {/* 4. Bottom Giant Neon Green Button: "Purchase Research Points" */}
        <div className="pb-2 pt-1">
          <button
            onClick={() => {
              handleBuyPoint();
            }}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 via-green-500 to-emerald-600 hover:brightness-110 active:scale-[0.99] text-stone-950 font-black font-cinzel text-base tracking-widest flex items-center justify-center gap-2.5 shadow-[0_0_30px_rgba(34,197,94,0.35)] transition-all cursor-pointer"
          >
            <span>Purchase Research Points</span>
            <span className="text-xs bg-emerald-950/70 text-emerald-300 font-mono font-bold px-2.5 py-0.5 rounded-full border border-emerald-400/40">
              1,000 Gold
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
