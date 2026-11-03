import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine, RadarData, RunSummary } from './game/GameEngine';
import {
  INITIAL_PLAYER_STATS,
  BOSS_TEST_PLAYER_STATS,
  BOSS_TEST_ENEMIES_LEFT,
  INITIAL_BELT_ITEMS,
  INITIAL_QUESTS,
  INITIAL_EQUIPMENT,
} from './game/constants';
import {
  PlayerStats,
  Spell,
  QuickBeltItem,
  GameQuest,
  Enemy,
  EquipmentItem,
  CharacterHero,
  ArenaRealm,
} from './types/game';
import { HEROES_LIST } from './game/characters';
import { ARENAS_LIST } from './game/arenas';
import { MainMenu } from './components/MainMenu';
import { HUD } from './components/HUD';
import { LevelUpModal, StartSpellModal } from './components/LevelUpModal';
import type { UpgradeChoice } from './game/spells';
import { InventoryModal } from './components/InventoryModal';
import { SkillsModal } from './components/SkillsModal';
import { UpgradeModal } from './components/UpgradeModal';
import { applyResearch, loadResearch, saveGold } from './game/research';
import { SettingsModal } from './components/SettingsModal';
import { GameOverModal } from './components/GameOverModal';
import { StoryModal } from './components/StoryModal';
import { CharacterSelectModal } from './components/CharacterSelectModal';
import { ArenaSelectModal } from './components/ArenaSelectModal';
import { ComboModal } from './components/ComboModal';
import { EncyclopediaModal } from './components/EncyclopediaModal';
import { ResearchLetterModal } from './components/ResearchLetterModal';
import { PWAInstallButton } from './components/PWAInstallButton';
import { sound } from './audio/soundEngine';
import { Play, RotateCcw, BookMarked, User, MapPin, Sparkles, Home, LogOut, BookOpen } from 'lucide-react';

function applyHeroBonuses(e: GameEngine, from: CharacterHero | null, to: CharacterHero) {
  const st = e.stats;
  const d = (k: 'bonusHp' | 'bonusMana' | 'bonusPower' | 'bonusSpeed') => to[k] - (from ? from[k] : 0);
  st.maxHp = Math.max(50, st.maxHp + d('bonusHp')); st.hp = st.maxHp;
  st.maxMana = Math.max(0, st.maxMana + d('bonusMana')); st.mana = st.maxMana;
  st.spellPower += d('bonusPower');
  st.speed = Math.max(1, st.speed + d('bonusSpeed'));
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  // View state: Home Page Main Menu vs Active Gameplay
  const [gameView, setGameView] = useState<'MAIN_MENU' | 'PLAYING'>('MAIN_MENU');
  const [startAtWave8, setStartAtWave8] = useState<boolean>(true);

  // Character & Arena selection
  const [currentHero, setCurrentHero] = useState<CharacterHero>(HEROES_LIST[0]);
  const heroRef = useRef<CharacterHero>(HEROES_LIST[0]);
  const [currentArena, setCurrentArena] = useState<ArenaRealm>(ARENAS_LIST[0]);

  // Game state
  const [stats, setStats] = useState<PlayerStats>(() => ({ ...INITIAL_PLAYER_STATS, gold: loadResearch().gold }));
  const [spells, setSpells] = useState<Spell[]>([]);
  const [pickingSpell, setPickingSpell] = useState(false);
  const [upgradeChoices, setUpgradeChoices] = useState<UpgradeChoice[]>([]);
  const [fastCasting, setFastCasting] = useState(0);
  const [beltItems, setBeltItems] = useState<QuickBeltItem[]>(INITIAL_BELT_ITEMS);
  const [quests, setQuests] = useState<GameQuest[]>(INITIAL_QUESTS);
  const [equipment] = useState<EquipmentItem[]>(INITIAL_EQUIPMENT);

  const [wave, setWave] = useState(1);
  const [enemiesRemaining, setEnemiesRemaining] = useState(40);
  const [timeStr, setTimeStr] = useState('00:00');
  const [radarData, setRadarData] = useState<RadarData | null>(null);
  const [currentBoss, setCurrentBoss] = useState<Enemy | null>(null);
  const [weatherBanner, setWeatherBanner] = useState<string | null>('Glacial Frost Descends');

  // Modals
  const [isPaused, setIsPaused] = useState(false);
  const [levelUpLevel, setLevelUpLevel] = useState<number | null>(null);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [isSkillsOpen, setIsSkillsOpen] = useState(false);
  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isStoryOpen, setIsStoryOpen] = useState(false);
  const [isCharacterSelectOpen, setIsCharacterSelectOpen] = useState(false);
  const [isArenaSelectOpen, setIsArenaSelectOpen] = useState(false);
  const [isComboOpen, setIsComboOpen] = useState(false);
  const [isEncyclopediaOpen, setIsEncyclopediaOpen] = useState(false);
  const [researchLetterData, setResearchLetterData] = useState<{
    time: string;
    wave: number;
    demons: number;
  } | null>(null);
  const [gameOverData, setGameOverData] = useState<{ victory: boolean; summary: RunSummary } | null>(null);

  // Settings state
  const [showDamageNumbers, setShowDamageNumbers] = useState(true);
  const [enableScreenShake, setEnableScreenShake] = useState(true);
  const [autoAim, setAutoAim] = useState(true);

  // Initialize and run the GameEngine
  const initializeEngine = useCallback(() => {
    if (!canvasRef.current || gameView !== 'PLAYING') return;
    if (engineRef.current) {
      engineRef.current.destroy();
    }

    const startWave = startAtWave8 ? 8 : 1;
    if (startWave === 1) {
      setWave(1);
      setEnemiesRemaining(40);
      setTimeStr('00:00');
    } else {
      setWave(8);
      setEnemiesRemaining(BOSS_TEST_ENEMIES_LEFT);
      setTimeStr('08:00');
    }

    const engine = new GameEngine(
      canvasRef.current,
      startWave === 8 ? BOSS_TEST_PLAYER_STATS : INITIAL_PLAYER_STATS,
      [],
      {
        onStatsUpdate: (newStats) => setStats(newStats),
        onQuestUpdate: (updater) => setQuests(updater),
        onWaveUpdate: (w, left, t) => {
          setWave(w);
          setEnemiesRemaining(left);
          setTimeStr(t);
        },
        onLevelUp: (newLevel) => {
          setUpgradeChoices(engine.getUpgradeChoices(4));
          setLevelUpLevel(newLevel);
        },
        onSpellsUpdate: (sp) => {
          setSpells(sp);
          setFastCasting(engine.fastCasting);
        },
        onGameOver: (victory, summary) => {
          setGameOverData({ victory, summary });
        },
        onBossState: (boss) => {
          setCurrentBoss(boss);
        },
        onRadarUpdate: (data) => {
          setRadarData(data);
        },
        onWeatherChange: (title) => {
          setWeatherBanner(title);
          setTimeout(() => setWeatherBanner(null), 4000);
        },
        onSurvivalMilestone: (time, waveReached, demons) => {
          setResearchLetterData({ time, wave: waveReached, demons });
        },
      },
      startWave
    );

    engine.currentHero = heroRef.current;
    applyResearch(engine.stats); // persistent Altar research + saved gold wallet
    applyHeroBonuses(engine, null, heroRef.current);
    setStats({ ...engine.stats });
    engine.currentArena = currentArena;
    engine.showDamageNumbers = showDamageNumbers;
    engine.enableScreenShake = enableScreenShake;
    engine.autoAim = autoAim;

    engine.start();
    engine.pause(); // nothing runs until the starting magic is picked
    setSpells([]);
    setFastCasting(0);
    setPickingSpell(true);
    engineRef.current = engine;
    (window as unknown as { __engine?: GameEngine }).__engine = engine;
  }, [gameView, startAtWave8, currentArena, showDamageNumbers, enableScreenShake, autoAim]);

  useEffect(() => {
    if (gameView === 'PLAYING') {
      initializeEngine();
    }
    return () => {
      engineRef.current?.destroy();
    };
  }, [gameView, initializeEngine]);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const key = e.key.toLowerCase();
      if (key === 'p' || key === 'escape') {
        if (
          levelUpLevel !== null ||
          isInventoryOpen ||
          isSkillsOpen ||
          isUpgradeOpen ||
          isSettingsOpen ||
          isStoryOpen ||
          isCharacterSelectOpen ||
          isArenaSelectOpen ||
          isComboOpen
        ) {
          setLevelUpLevel(null);
          setIsInventoryOpen(false);
          setIsSkillsOpen(false);
          setIsUpgradeOpen(false);
          setIsSettingsOpen(false);
          setIsStoryOpen(false);
          setIsCharacterSelectOpen(false);
          setIsArenaSelectOpen(false);
          setIsComboOpen(false);
          engineRef.current?.resume();
          setIsPaused(false);
        } else if (gameView === 'PLAYING') {
          togglePause();
        }
      } else if (key === '1') {
        useBeltItem('soul_shard');
      } else if (key === '2') {
        useBeltItem('mana_elixir');
      } else if (key === '3') {
        useBeltItem('vitality_emerald');
      } else if (key === '4') {
        useBeltItem('fire_rune');
      } else if (key === '5') {
        useBeltItem('ancient_grimoire');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    gameView,
    levelUpLevel,
    isInventoryOpen,
    isSkillsOpen,
    isUpgradeOpen,
    isSettingsOpen,
    isStoryOpen,
    isCharacterSelectOpen,
    isArenaSelectOpen,
    isComboOpen,
  ]);

  const togglePause = () => {
    if (isPaused) {
      engineRef.current?.resume();
      setIsPaused(false);
    } else {
      engineRef.current?.pause();
      setIsPaused(true);
    }
  };

  const returnToMainMenu = () => {
    sound.playItemUse();
    engineRef.current?.destroy();
    engineRef.current = null;
    setIsPaused(false);
    setLevelUpLevel(null);
    setGameOverData(null);
    setGameView('MAIN_MENU');
  };

  const useBeltItem = (itemId: string) => {
    const item = beltItems.find((b) => b.id === itemId);
    if (!item || item.count <= 0) return;

    setBeltItems((prev) =>
      prev.map((b) => (b.id === itemId ? { ...b, count: b.count - 1 } : b))
    );
    engineRef.current?.useBeltItem(itemId);
  };

  const getCooldowns = useCallback(() => {
    const out: Record<string, number> = {};
    const e = engineRef.current;
    if (!e) return out;
    const fc = Math.pow(0.9, e.fastCasting);
    for (const sp of e.spells) out[sp.id] = sp.cooldown > 0 ? Math.min(1, sp.currentCooldown / (sp.cooldown * fc)) : 0;
    return out;
  }, []);

  const handleSelectUpgrade = (upgradeId: string) => {
    setLevelUpLevel(null);
    engineRef.current?.applyUpgrade(upgradeId);
    engineRef.current?.resume();
  };

  const handlePickStartSpell = (spellId: string) => {
    const e = engineRef.current;
    if (!e) return;
    e.learnSpell(spellId, startAtWave8 ? 5 : 1);
    setPickingSpell(false);
    e.resume();
    setTimeout(() => setWeatherBanner(null), 3500);
  };
  (window as unknown as { __pickSpell?: (id: string) => void }).__pickSpell = handlePickStartSpell;

  const handleSelectHero = (hero: CharacterHero) => {
    const prev = heroRef.current;
    heroRef.current = hero;
    setCurrentHero(hero);
    const e = engineRef.current;
    if (e && gameView === 'PLAYING') {
      // live switch mid-run: swap bonus deltas, keep level/xp progress
      e.currentHero = hero;
      applyHeroBonuses(e, prev, hero);
      setStats({ ...e.stats });
    }
    setIsCharacterSelectOpen(false);
    if (gameView === 'PLAYING') {
      engineRef.current?.resume();
    }
  };

  const handleSelectArena = (arena: ArenaRealm) => {
    setCurrentArena(arena);
    if (engineRef.current) {
      engineRef.current.currentArena = arena;
      engineRef.current.weatherSystem.forceWeather(arena.primaryWeather);
    }
    setWeatherBanner(`Realm Entered: ${arena.name}`);
    setTimeout(() => setWeatherBanner(null), 3500);
    setIsArenaSelectOpen(false);
    if (gameView === 'PLAYING') {
      engineRef.current?.resume();
    }
  };

  useEffect(() => { saveGold(stats.gold); }, [stats.gold]);

  const handleRestart = () => {
    setGameOverData(null);
    setIsPaused(false);
    setLevelUpLevel(null);
    setStats({ ...INITIAL_PLAYER_STATS, gold: loadResearch().gold });
    setSpells([]);
    setBeltItems(INITIAL_BELT_ITEMS);
    setQuests(INITIAL_QUESTS);
    initializeEngine();
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black select-none font-sans">
      {/* 1. Main Menu / Home Page View */}
      {gameView === 'MAIN_MENU' && (
        <MainMenu
          currentHero={currentHero}
          currentArena={currentArena}
          stats={stats}
          onStartGame={(startWave8) => {
            setStartAtWave8(startWave8);
            setGameView('PLAYING');
          }}
          onOpenCharacters={() => setIsCharacterSelectOpen(true)}
          onOpenArenas={() => setIsArenaSelectOpen(true)}
          onOpenCombos={() => setIsComboOpen(true)}
          onOpenUpgrades={() => setIsUpgradeOpen(true)}
          onOpenStory={() => setIsStoryOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenEncyclopedia={() => setIsEncyclopediaOpen(true)}
          onQuickSwitchHero={(h) => handleSelectHero(h)}
        />
      )}

      {/* 2. Active Gameplay Battlefield View */}
      {gameView === 'PLAYING' && (
        <>
          {/* Main Game 2D Canvas (Pristine procedural battlefield, 3D Isometric POV, zero overlapping ghost UI) */}
          <canvas ref={canvasRef} className="block w-full h-full cursor-crosshair" />

          {/* Dynamic Weather Transition & Realm Banner */}
          {weatherBanner && (
            <div className="absolute top-[60%] left-1/2 -translate-x-1/2 z-30 pointer-events-none animate-in fade-in duration-300">
              <div className="flex items-center gap-2.5 bg-slate-950/90 border border-sky-400/60 px-5 py-2 rounded-full shadow-[0_0_25px_rgba(56,189,248,0.4)] backdrop-blur-md">
                <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
                <span className="text-xs font-cinzel font-bold tracking-widest text-sky-200 uppercase">
                  ✦ {weatherBanner}
                </span>
              </div>
            </div>
          )}

          {/* Boss Alert Warning Banner */}
          {currentBoss && !gameOverData && (
            <div className="absolute top-[32%] left-1/2 -translate-x-1/2 z-20 pointer-events-none animate-pulse">
              <div className="flex items-center gap-2 bg-red-950/90 border border-red-500/80 px-3 py-1 rounded-full shadow-[0_0_20px_rgba(239,68,68,0.5)] scale-90">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                <span className="text-xs font-cinzel font-black tracking-widest text-red-200 uppercase">
                  Boss Encounter: Void Colossus Titan
                </span>
              </div>
            </div>
          )}

          {/* Top In-Game Quick Bar: Home, Story, Hero, Realm, Combos */}
          <div className="absolute top-4 left-1/2 translate-x-32 hidden xl:flex items-center gap-2 z-20 pointer-events-auto">
            <button
              onClick={returnToMainMenu}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950/90 gold-border text-amber-300 hover:text-white text-xs font-cinzel font-bold shadow-lg cursor-pointer hover:bg-slate-900 transition-colors"
              title="Return to Main Menu"
            >
              <Home className="w-3.5 h-3.5 text-amber-400" />
              <span>Menu</span>
            </button>

            <button
              onClick={() => {
                engineRef.current?.pause();
                setIsStoryOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950/90 gold-border text-slate-300 hover:text-white text-xs font-cinzel font-bold shadow-lg cursor-pointer hover:bg-slate-900 transition-colors"
              title="Campaign Story & Chronicles"
            >
              <BookMarked className="w-3.5 h-3.5 text-amber-400" />
              <span>Story</span>
            </button>

            <button
              onClick={() => {
                engineRef.current?.pause();
                setIsCharacterSelectOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950/90 gold-border text-sky-300 hover:text-white text-xs font-cinzel font-bold shadow-lg cursor-pointer hover:bg-slate-900 transition-colors"
              title="Switch Archmage Hero"
            >
              <User className="w-3.5 h-3.5 text-sky-400" />
              <span>{currentHero.name}</span>
            </button>

            <button
              onClick={() => {
                engineRef.current?.pause();
                setIsArenaSelectOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950/90 gold-border text-emerald-300 hover:text-white text-xs font-cinzel font-bold shadow-lg cursor-pointer hover:bg-slate-900 transition-colors"
              title="Switch Battleground Realm"
            >
              <MapPin className="w-3.5 h-3.5 text-emerald-400" />
              <span>{currentArena.name}</span>
            </button>

            <button
              onClick={() => {
                engineRef.current?.pause();
                setIsComboOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950/90 gold-border text-purple-300 hover:text-white text-xs font-cinzel font-bold shadow-lg cursor-pointer hover:bg-slate-900 transition-colors"
              title="Combo Magic & Spell Fusions"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>Fusions</span>
            </button>

            <button
              onClick={() => {
                engineRef.current?.pause();
                setIsEncyclopediaOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950/90 gold-border text-amber-300 hover:text-white text-xs font-cinzel font-bold shadow-lg cursor-pointer hover:bg-slate-900 transition-colors"
              title="Magic Survival Grimoire & Encyclopedia"
            >
              <BookOpen className="w-3.5 h-3.5 text-amber-400" />
              <span>Grimoire</span>
            </button>
          </div>

          {/* Main HUD Overlay (Clear layout, ZERO overlaps) */}
          <HUD
            hero={currentHero}
            stats={stats}
            spells={spells}
            beltItems={beltItems}
            quests={quests}
            wave={wave}
            enemiesRemaining={enemiesRemaining}
            timeStr={timeStr}
            radarData={radarData}
            onPause={togglePause}
            onOpenInventory={() => {
              engineRef.current?.pause();
              setIsInventoryOpen(true);
            }}
            onOpenSkills={() => {
              engineRef.current?.pause();
              setIsSkillsOpen(true);
            }}
            onOpenUpgrades={() => {
              engineRef.current?.pause();
              setIsUpgradeOpen(true);
            }}
            onOpenSettings={() => {
              engineRef.current?.pause();
              setIsSettingsOpen(true);
            }}
            onUseBeltItem={useBeltItem}
            fastCasting={fastCasting}
            onTriggerDash={() => engineRef.current?.triggerDash()}
            onJoystickMove={(vx, vy) => engineRef.current?.setJoystickVector(vx, vy)}
            getCooldowns={getCooldowns}
          />

          {/* Pause Menu Overlay */}
          {isPaused &&
            !isInventoryOpen &&
            !isSkillsOpen &&
            !isUpgradeOpen &&
            !isSettingsOpen &&
            !isStoryOpen &&
            !isCharacterSelectOpen &&
            !isArenaSelectOpen &&
            !isComboOpen &&
            !isEncyclopediaOpen &&
            !researchLetterData &&
            !gameOverData &&
            levelUpLevel === null && (
              <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
                <div className="p-8 rounded-2xl bg-slate-950/95 gold-border text-center shadow-2xl flex flex-col items-center max-w-sm w-full mx-4">
                  <h2 className="text-2xl font-black font-cinzel tracking-widest gold-gradient-text mb-1">
                    Battle Paused
                  </h2>
                  <p className="text-xs text-slate-400 font-sans mb-5">
                    The cosmic void pauses its descent
                  </p>

                  <div className="space-y-2.5 w-full">
                    <button
                      onClick={togglePause}
                      className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold font-cinzel text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-lg"
                    >
                      <Play className="w-4 h-4 fill-slate-950" />
                      Resume Battle
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setIsStoryOpen(true)}
                        className="py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 border border-slate-700 font-cinzel text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <BookMarked className="w-3.5 h-3.5" />
                        Story Lore
                      </button>
                      <button
                        onClick={() => setIsComboOpen(true)}
                        className="py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-purple-300 border border-slate-700 font-cinzel text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Fusions
                      </button>
                      <button
                        onClick={() => setIsCharacterSelectOpen(true)}
                        className="py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-sky-300 border border-slate-700 font-cinzel text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <User className="w-3.5 h-3.5" />
                        Hero
                      </button>
                      <button
                        onClick={() => setIsArenaSelectOpen(true)}
                        className="py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-emerald-300 border border-slate-700 font-cinzel text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        Realm
                      </button>
                    </div>

                    <PWAInstallButton variant="compact" />

                    <button
                      onClick={() => setIsSettingsOpen(true)}
                      className="w-full py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-cinzel text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
                    >
                      Settings & Audio
                    </button>

                    <button
                      onClick={handleRestart}
                      className="w-full py-2 rounded-xl bg-slate-900/60 hover:bg-rose-950/60 text-rose-300 border border-rose-900/40 font-cinzel text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Restart Run
                    </button>

                    <button
                      onClick={returnToMainMenu}
                      className="w-full py-2 rounded-xl bg-slate-900/40 hover:bg-slate-900 text-slate-400 hover:text-white border border-slate-800 font-cinzel text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Quit to Main Menu
                    </button>
                  </div>
                </div>
              </div>
            )}
        </>
      )}

      {/* 3. Global Modals (Accessible from both MainMenu and Gameplay) */}
      {/* Level Up Modal */}
      {gameView === 'PLAYING' && pickingSpell && (
        <StartSpellModal bossTest={startAtWave8} onPick={handlePickStartSpell} />
      )}
      {levelUpLevel !== null && (
        <LevelUpModal level={levelUpLevel} choices={upgradeChoices} onSelectUpgrade={handleSelectUpgrade} />
      )}

      {/* Freestanding Character Selection Stage */}
      {isCharacterSelectOpen && (
        <CharacterSelectModal
          currentHero={currentHero}
          gold={stats.gold}
          crystals={stats.crystals}
          onSelectHero={handleSelectHero}
          onClose={() => {
            setIsCharacterSelectOpen(false);
            if (gameView === 'PLAYING' && !isPaused) engineRef.current?.resume();
          }}
        />
      )}

      {/* Arena Realm Selection Modal */}
      {isArenaSelectOpen && (
        <ArenaSelectModal
          currentArena={currentArena}
          onSelectArena={handleSelectArena}
          onClose={() => {
            setIsArenaSelectOpen(false);
            if (gameView === 'PLAYING' && !isPaused) engineRef.current?.resume();
          }}
        />
      )}

      {/* Story & Campaign Modal */}
      {isStoryOpen && (
        <StoryModal
          currentWave={wave}
          onClose={() => {
            setIsStoryOpen(false);
            if (gameView === 'PLAYING' && !isPaused) engineRef.current?.resume();
          }}
        />
      )}

      {/* Combo Magic / Fusions Modal */}
      {isComboOpen && (
        <ComboModal
          spells={spells}
          gold={stats.gold}
          crystals={stats.crystals}
          onClose={() => {
            setIsComboOpen(false);
            if (gameView === 'PLAYING' && !isPaused) engineRef.current?.resume();
          }}
        />
      )}

      {/* Magic Survival Grimoire & Encyclopedia Modal */}
      {isEncyclopediaOpen && (
        <EncyclopediaModal
          gold={stats.gold}
          crystals={stats.crystals}
          onClose={() => {
            setIsEncyclopediaOpen(false);
            if (gameView === 'PLAYING' && !isPaused) engineRef.current?.resume();
          }}
        />
      )}

      {/* Classified Laboratory Research Dispatch Letter (Story Milestone Demanded) */}
      {researchLetterData && (
        <ResearchLetterModal
          survivalTime={researchLetterData.time}
          waveReached={researchLetterData.wave}
          demonsSlain={researchLetterData.demons}
          onProceed={() => {
            // Reward player for surviving the experimental demands
            setStats((prev) => ({
              ...prev,
              gold: prev.gold + 500,
              crystals: prev.crystals + 25,
            }));
            setResearchLetterData(null);
            if (engineRef.current && !isPaused) {
              engineRef.current.resume();
            }
          }}
          onClose={() => {
            setResearchLetterData(null);
            if (engineRef.current && !isPaused) {
              engineRef.current.resume();
            }
          }}
        />
      )}

      {/* Inventory Modal */}
      {isInventoryOpen && (
        <InventoryModal
          stats={stats}
          equipment={equipment}
          onClose={() => {
            setIsInventoryOpen(false);
            if (gameView === 'PLAYING' && !isPaused) engineRef.current?.resume();
          }}
        />
      )}

      {/* Skills & Evolution Modal */}
      {isSkillsOpen && (
        <SkillsModal
          spells={spells}
          onClose={() => {
            setIsSkillsOpen(false);
            if (gameView === 'PLAYING' && !isPaused) engineRef.current?.resume();
          }}
        />
      )}

      {/* Permanent Upgrade / Talents Modal */}
      {isUpgradeOpen && (
        <UpgradeModal
          stats={stats}
          onUpdateStats={(newStats) => {
            setStats(newStats);
            if (engineRef.current) engineRef.current.stats = { ...newStats };
          }}
          onClose={() => {
            setIsUpgradeOpen(false);
            if (gameView === 'PLAYING' && !isPaused) engineRef.current?.resume();
          }}
        />
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <SettingsModal
          showDamageNumbers={showDamageNumbers}
          enableScreenShake={enableScreenShake}
          autoAim={autoAim}
          onToggleDamageNumbers={(v) => {
            setShowDamageNumbers(v);
            if (engineRef.current) engineRef.current.showDamageNumbers = v;
          }}
          onToggleScreenShake={(v) => {
            setEnableScreenShake(v);
            if (engineRef.current) engineRef.current.enableScreenShake = v;
          }}
          onToggleAutoAim={(v) => {
            setAutoAim(v);
            if (engineRef.current) engineRef.current.autoAim = v;
          }}
          onClose={() => {
            setIsSettingsOpen(false);
            if (gameView === 'PLAYING' && !isPaused) engineRef.current?.resume();
          }}
        />
      )}

      {/* Game Over / Victory Modal */}
      {gameOverData && (
        <GameOverModal
          victory={gameOverData.victory}
          summary={gameOverData.summary}
          onRestart={handleRestart}
          onHome={returnToMainMenu}
        />
      )}
    </div>
  );
}
