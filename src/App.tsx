import React from 'react';
import { GameProvider, useGame } from './context/GameContext';
import { DexGrid } from './components/DexGrid';
import { GlobalGuessInput } from './components/GlobalGuessInput';
import { SettingsPanel } from './components/SettingsPanel';
import { Settings, Wifi, WifiOff, PanelRightClose, PanelRightOpen, PanelLeftClose, PanelLeftOpen, MessageSquare, Tv, LayoutGrid } from 'lucide-react';
import { ArchipelagoLog } from './components/ArchipelagoLog';
import { PokemonDetails } from './components/PokemonDetails';
import { TypeStatus } from './components/TypeStatus';
import { GateTracker } from './components/GateTracker';
import { SplashScreen } from './components/SplashScreen';
import { StartGameOverlay } from './components/StartGameOverlay';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TwitchLeaderboard } from './components/TwitchLeaderboard';
import { OverlayView } from './components/OverlayView';
import { TwitchProvider } from './context/TwitchContext';
import { getCleanName } from './utils/pokemon';

const isOverlayMode = new URLSearchParams(window.location.search).has('overlay');

const POKEMON_TYPES = ['Normal', 'Fire', 'Water', 'Grass', 'Electric', 'Ice', 'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Fairy', 'Steel', 'Dark'];

const GameContent: React.FC = () => {
  const {
    allPokemon, unlockedIds, checkedIds, unlockPokemon, isLoading, isConnected,
    uiSettings, goal, gameMode, isPokemonGuessable,
    typeUnlocks,
    unlockType, lockType, clearAllTypes,
    setShuffleEndTime, setDerpyfiedIds, setReleasedIds, derpemonIndex, releasedIds, derpyfiedIds, setSpriteRefreshCounter, showToast,
    STARTER_OFFSET, MILESTONE_OFFSET,
    startingLocationsEnabled, gameStarted, connectionKey,
    pokemonLoadError, retryPokemonLoad,
  } = useGame();

  const [adventureOverlayDismissed, setAdventureOverlayDismissed] = React.useState(false);
  // Reset on every new connection (covers both disconnect→reconnect and game-switching).
  React.useEffect(() => {
    setAdventureOverlayDismissed(false);
  }, [connectionKey]);
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  const [isLogOpen, setIsLogOpen] = React.useState(false);
  const [twitchIntegration, setTwitchIntegration] = React.useState(() => localStorage.getItem('pokepelago_twitch_integration') === 'true');
  React.useEffect(() => {
    const handler = () => {
      const enabled = localStorage.getItem('pokepelago_twitch_integration') === 'true';
      setTwitchIntegration(enabled);
      if (!enabled) setSidebarTab(prev => prev === 'twitch' ? 'tracker' : prev);
    };
    window.addEventListener('pokepelago_twitch_integration_changed', handler);
    return () => window.removeEventListener('pokepelago_twitch_integration_changed', handler);
  }, []);
  const [sidebarTab, setSidebarTab] = React.useState<'tracker' | 'settings' | 'twitch'>(() => {
    const defaultTab = localStorage.getItem('pokepelago_defaultTab') as 'tracker' | 'settings' | 'twitch';
    if (defaultTab && (defaultTab === 'tracker' || defaultTab === 'settings' || defaultTab === 'twitch')) {
      localStorage.removeItem('pokepelago_defaultTab');
      return defaultTab;
    }
    return 'tracker';
  });
  const [isDebugVisible, setIsDebugVisible] = React.useState(false);
  const [debugType, setDebugType] = React.useState(POKEMON_TYPES[0]);

  // Only count Pokémon guess locations (IDs 1-1025).
  // Excludes Oak's Lab, Milestone, Type Milestone, and released (ran away) Pokémon.
  const guessedPokemonCount = React.useMemo(() =>
    Array.from(checkedIds).filter(id =>
      id >= 1 && id <= 1025 &&
      !(id >= STARTER_OFFSET && id < STARTER_OFFSET + 20) &&
      id < MILESTONE_OFFSET &&
      !releasedIds.has(id)
    ).length,
    [checkedIds, STARTER_OFFSET, MILESTONE_OFFSET, releasedIds]);

  // Set beta page title
  React.useEffect(() => {
    if (__IS_BETA__) document.title = 'Poképelago (beta)';
  }, []);

  // Expose debug toggle to window for GlobalGuessInput to call (dev/beta only)
  React.useEffect(() => {
    if (!import.meta.env.DEV && !__IS_BETA__) return;
    (window as any).toggleDebug = () => setIsDebugVisible(prev => {
      const next = !prev;
      (window as any).isDebugVisible = next;
      return next;
    });
    (window as any).isDebugVisible = isDebugVisible;
  }, [isDebugVisible]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950 text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-green-500 rounded-full animate-spin border-t-transparent"></div>
          <span className="text-gray-400">Loading Pokédex...</span>
        </div>
      </div>
    );
  }

  if (pokemonLoadError) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950 text-white p-8">
        <div className="flex flex-col items-center gap-6 max-w-md text-center">
          <div className="text-5xl">⚠️</div>
          <div>
            <h1 className="text-xl font-bold text-red-400 mb-2">Failed to load Pokédex</h1>
            <p className="text-gray-400 text-sm mb-4">
              Could not reach PokéAPI. Check your internet connection and try again.
              Your saved game data is safe.
            </p>
            <pre className="text-left text-[10px] text-red-300 bg-gray-900 border border-gray-800 rounded p-3 overflow-auto max-h-24">
              {pokemonLoadError}
            </pre>
          </div>
          <button
            onClick={retryPokemonLoad}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Debug: unlock random Pokemon
  const unlockRandom = () => {
    if (allPokemon.length === 0) return;
    const eligible = allPokemon.filter(p => !unlockedIds.has(p.id));
    if (eligible.length === 0) return;
    const pick = eligible[Math.floor(Math.random() * eligible.length)];
    unlockPokemon(pick.id);
  };

  const unlockBatch = () => {
    // Unlock 10 random pokemon
    const eligible = allPokemon.filter(p => !unlockedIds.has(p.id));
    const count = Math.min(10, eligible.length);
    const shuffled = [...eligible].sort(() => Math.random() - 0.5);
    shuffled.slice(0, count).forEach(p => unlockPokemon(p.id));
  };

  const unlockAll = () => {
    if (confirm('Unlock EVERY Pokemon? This might lag for a second.')) {
      allPokemon.forEach(p => unlockPokemon(p.id));
    }
  };

  const triggerDerpTrap = () => {
    const available = allPokemon.filter(p => !derpyfiedIds.has(p.id) && derpemonIndex[p.id]);
    if (available.length > 0) {
      const p = available[Math.floor(Math.random() * available.length)];
      setDerpyfiedIds(prev => new Set(prev).add(p.id));
      setSpriteRefreshCounter((c: number) => c + 1);

      if (checkedIds.has(p.id)) {
        showToast('trap', `${getCleanName(p.name)} turned derpy!`);
      } else {
        showToast('trap', `A Pokémon turned derpy!`);
      }
    }
  };

  const triggerReleaseTrap = () => {
    const valid = Array.from(checkedIds).filter(id => id !== 1 && id !== 4 && id !== 7 && !releasedIds.has(id));
    if (valid.length > 0) {
      const id = valid[Math.floor(Math.random() * valid.length)];
      setReleasedIds(prev => new Set(prev).add(id));
      showToast('trap', 'Oh no! A Pokémon ran away!');
    }
  };

  if (!gameMode) {
    return <SplashScreen />;
  }

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-white font-sans overflow-hidden">
      <GlobalGuessInput />

      {/* Toolbar - now relative in flex flow */}
      <div className="z-20 bg-gray-900 border-b border-gray-800 shrink-0">
        <div className={`${uiSettings.widescreen ? 'max-w-none px-8' : 'max-w-screen-xl'} mx-auto flex items-center justify-between px-4 py-2`}>
          <div className="flex items-center gap-3">
            {/* Log sidebar toggle */}
            <button
              onClick={() => {
                const next = !isLogOpen;
                setIsLogOpen(next);
                if (next && window.innerWidth < 768) setIsSidebarOpen(false);
              }}
              className={`p-1.5 rounded transition-all ${isLogOpen ? 'bg-blue-600 text-white' : 'hover:bg-gray-800 text-gray-400'}`}
              title={isLogOpen ? "Hide Log" : "Show Log"}
            >
              {isLogOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
            </button>

            {/* Connection status */}
            <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded ${isConnected ? 'bg-green-900/30 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
              {isConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
              {isConnected ? 'Connected' : 'Offline'}
            </div>

            <span className="text-xs text-gray-500">
              Guessable: <span className="text-orange-400 font-bold">{allPokemon.filter(p => !checkedIds.has(p.id) && isPokemonGuessable(p.id).canGuess).length}</span>
            </span>

            {goal && (
              <span className="text-xs text-gray-500 bg-blue-900/20 px-2 py-1 rounded border border-blue-800/30">
                Goal: <span className="text-blue-400 font-bold">
                  {goal.type === 'any_pokemon' ? `Catch ${goal.amount} Pokémon (${guessedPokemonCount}/${goal.amount})` :
                    goal.type === 'region_completion' ? `Catch all ${goal.region} Pokémon` :
                      goal.type === 'percentage' ? `Find ${goal.amount}% of Pokémon (${Math.round((guessedPokemonCount / allPokemon.length) * 100)}%)` :
                        goal.type === 'all_legendaries' ? `Catch All Legendaries` : 'Unknown'}
                </span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const next = !isSidebarOpen;
                setIsSidebarOpen(next);
                if (next && window.innerWidth < 768) setIsLogOpen(false);
              }}
              className={`p-1.5 rounded transition-all ${isSidebarOpen ? 'bg-blue-600 text-white' : 'hover:bg-gray-800 text-gray-400'}`}
              title={isSidebarOpen ? "Hide Sidebar" : "Show Sidebar"}
            >
              {isSidebarOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Left sidebar backdrop (mobile) */}
        {isLogOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-20 md:hidden"
            onClick={() => setIsLogOpen(false)}
          />
        )}

        {/* Left Sidebar - Log */}
        <aside
          className={`
            flex flex-col bg-gray-900/95 backdrop-blur-md transition-all duration-300 border-r border-gray-800
            fixed left-0 top-0 bottom-0 z-30 pt-20
            md:relative md:top-auto md:bottom-auto md:z-auto md:pt-0
            ${isLogOpen ? 'w-80' : 'w-0 -translate-x-full md:translate-x-0 overflow-hidden border-none'}
          `}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
              <MessageSquare size={14} />
              Log
            </span>
          </div>
          <div className="flex-1 overflow-hidden">
            <ArchipelagoLog />
          </div>
        </aside>

        {/* Main Content */}
        <main className={`flex-1 overflow-y-auto [scrollbar-gutter:stable] pb-16 ${uiSettings.widescreen ? 'px-6' : 'px-4'}`}>
          <div className={`${uiSettings.widescreen ? 'max-w-none' : 'max-w-screen-xl'} mx-auto pt-6`}>
            <DexGrid />
          </div>
        </main>

        {/* Right sidebar backdrop (mobile) */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-20 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Right Sidebar - Tracker / Settings / Twitch */}
        <aside
          className={`
            flex flex-col bg-gray-900/95 backdrop-blur-md transition-all duration-300 border-l border-gray-800
            fixed right-0 top-0 bottom-0 z-30 pt-20
            md:relative md:top-auto md:bottom-auto md:z-auto md:pt-0
            ${isSidebarOpen ? 'w-80' : 'w-0 translate-x-full md:translate-x-0 overflow-hidden border-none'}
          `}
        >
          {/* Tabs */}
          <div className="flex border-b border-gray-800 shrink-0">
            <button
              onClick={() => setSidebarTab('tracker')}
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 ${sidebarTab === 'tracker' ? 'text-blue-400 bg-blue-900/20 border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <LayoutGrid size={14} />
              Tracker
            </button>
            <button
              onClick={() => setSidebarTab('settings')}
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 ${sidebarTab === 'settings' ? 'text-blue-400 bg-blue-900/20 border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <Settings size={14} />
              Settings
            </button>
            {__TWITCH_ENABLED__ && twitchIntegration && (
            <button
              onClick={() => setSidebarTab('twitch')}
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 ${sidebarTab === 'twitch' ? 'text-purple-400 bg-purple-900/20 border-b-2 border-purple-500' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <Tv size={14} />
              Twitch
            </button>
            )}
          </div>

          <div className="flex-1 overflow-hidden">
            {sidebarTab === 'tracker' ? (
              <div className="p-4 flex flex-col gap-3 overflow-y-auto h-full">
                <TypeStatus />
                <GateTracker />
              </div>
            ) : sidebarTab === 'twitch' && __TWITCH_ENABLED__ && twitchIntegration ? (
              <TwitchLeaderboard />
            ) : (
              <SettingsPanel isOpen={true} onClose={() => setIsSidebarOpen(false)} isEmbedded />
            )}
          </div>
        </aside>

        {/* Debug Controls - dev/beta only */}
        {(import.meta.env.DEV || __IS_BETA__) && isDebugVisible && (
          <div className="absolute bottom-0 left-0 right-0 z-20 bg-gray-900/95 backdrop-blur-sm border-t border-gray-800 transition-all duration-300 hidden md:block" style={{ right: isSidebarOpen ? '320px' : '0', left: isLogOpen ? '320px' : '0' }}>
            <div className="max-w-screen-xl mx-auto flex flex-col gap-3 px-4 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs text-gray-500 uppercase tracking-wider font-bold shrink-0">Debug Controls</span>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => (window as any).runAutoComplete?.()} className="px-3 py-1 bg-green-900/50 hover:bg-green-900/80 text-green-200 rounded text-xs border border-green-700/50 whitespace-nowrap">Auto-Complete Start</button>
                  <button onClick={() => (window as any).stopAutoComplete?.()} className="px-3 py-1 bg-red-900/50 hover:bg-red-900/80 text-red-200 rounded text-xs border border-red-700/50 whitespace-nowrap">Auto-Complete Stop</button>
                  <button onClick={unlockRandom} className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs border border-gray-700 whitespace-nowrap">Unlock 1</button>
                  <button onClick={unlockBatch} className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs border border-gray-700 whitespace-nowrap">Unlock 10</button>
                  <button onClick={unlockAll} className="px-3 py-1 bg-red-900/50 hover:bg-red-900/80 text-red-200 rounded text-xs border border-red-700/50 whitespace-nowrap">Unlock ALL</button>
                  <div className="w-px h-4 bg-gray-700 mx-1"></div>
                  <button onClick={() => setShuffleEndTime(Date.now() + 30000)} className="px-3 py-1 bg-purple-900/50 hover:bg-purple-900/80 text-purple-200 rounded text-xs border border-purple-700/50 whitespace-nowrap">Shuffle Trap (30s)</button>
                  <button onClick={triggerDerpTrap} className="px-3 py-1 bg-purple-900/50 hover:bg-purple-900/80 text-purple-200 rounded text-xs border border-purple-700/50 whitespace-nowrap">Derp Trap</button>
                  <button onClick={triggerReleaseTrap} className="px-3 py-1 bg-purple-900/50 hover:bg-purple-900/80 text-purple-200 rounded text-xs border border-purple-700/50 whitespace-nowrap">Release Trap</button>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 items-center border-t border-gray-800 pt-2">                {/* Type Controls */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400 uppercase font-bold">Types:</span>
                  <select
                    value={debugType}
                    onChange={(e) => setDebugType(e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs outline-none focus:border-blue-500"
                  >
                    {POKEMON_TYPES.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => typeUnlocks.has(debugType) ? lockType(debugType) : unlockType(debugType)}
                    className={`px-3 py-1 rounded text-xs border transition-colors ${typeUnlocks.has(debugType) ? 'bg-green-900/30 text-green-400 border-green-700/50 hover:bg-green-900/50' : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700'}`}
                  >
                    {typeUnlocks.has(debugType) ? 'Unlocked' : 'Locked'}
                  </button>
                  <div className="h-4 w-px bg-gray-800 mx-1"></div>
                  <button onClick={() => POKEMON_TYPES.forEach(t => unlockType(t))} className="text-[10px] text-blue-400 hover:underline">All</button>
                  <button onClick={clearAllTypes} className="text-[10px] text-red-400 hover:underline">Clear</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <PokemonDetails />

      {isConnected && gameMode === 'archipelago' && startingLocationsEnabled && !gameStarted && !adventureOverlayDismissed && (
        <StartGameOverlay onDismiss={() => setAdventureOverlayDismissed(true)} />
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <GameProvider>
        <TwitchProvider>
          {isOverlayMode ? <OverlayView /> : <GameContent />}
        </TwitchProvider>
      </GameProvider>
    </ErrorBoundary>
  );
};

export default App;
