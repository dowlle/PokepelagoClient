import React from 'react';
import { GameProvider, useGame } from './context/GameContext';
import { DexGrid } from './components/DexGrid';
import { GlobalGuessInput } from './components/GlobalGuessInput';
import { SettingsPanel } from './components/SettingsPanel';
import { Settings, Wifi, WifiOff, PanelRightClose, PanelRightOpen, MessageSquare } from 'lucide-react';
import { ArchipelagoLog } from './components/ArchipelagoLog';
import { PokemonDetails } from './components/PokemonDetails';
import { TypeStatus } from './components/TypeStatus';
import { SplashScreen } from './components/SplashScreen';

const POKEMON_TYPES = ['Normal', 'Fire', 'Water', 'Grass', 'Electric', 'Ice', 'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Fairy', 'Steel', 'Dark'];

const GameContent: React.FC = () => {
  const {
    allPokemon, unlockedIds, checkedIds, unlockPokemon, isLoading, isConnected,
    uiSettings, goal, gameMode, isPokemonGuessable,
    typeUnlocks,
    unlockType, lockType, clearAllTypes
  } = useGame();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  const [sidebarTab, setSidebarTab] = React.useState<'log' | 'settings'>(() => {
    const defaultTab = localStorage.getItem('pokepelago_defaultTab') as 'log' | 'settings';
    if (defaultTab) {
      localStorage.removeItem('pokepelago_defaultTab');
      return defaultTab;
    }
    return 'log';
  });
  const [isDebugVisible, setIsDebugVisible] = React.useState(false);
  const [debugType, setDebugType] = React.useState(POKEMON_TYPES[0]);

  const guessedPokemonCount = React.useMemo(() =>
    Array.from(checkedIds).filter(id => id <= 1025).length,
    [checkedIds]);

  // Expose debug toggle to window for GlobalGuessInput to call
  React.useEffect(() => {
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
            {/* Connection status */}
            <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded ${isConnected ? 'bg-green-900/30 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
              {isConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
              {isConnected ? 'Connected' : 'Offline'}
            </div>

            <span className="text-xs text-gray-500">
              Guessable: <span className="text-orange-400 font-bold">{allPokemon.filter(p => !checkedIds.has(p.id) && isPokemonGuessable(p.id).canGuess).length}</span>
              {' · '}
              Checked: <span className="text-green-400 font-bold">{guessedPokemonCount}</span>
              {' / '}
              {allPokemon.length}
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
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={`p-1.5 rounded transition-all ${isSidebarOpen ? 'bg-blue-600 text-white' : 'hover:bg-gray-800 text-gray-400'}`}
              title={isSidebarOpen ? "Hide Sidebar" : "Show Sidebar"}
            >
              {isSidebarOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Main Content */}
        <main className={`flex-1 overflow-y-auto pb-16 ${uiSettings.widescreen ? 'px-6' : 'px-4'}`}>
          <div className={`${uiSettings.widescreen ? 'max-w-none' : 'max-w-screen-xl'} mx-auto pt-6`}>
            <DexGrid />
          </div>
        </main>

        {/* Sidebar */}
        <aside
          className={`
            border-l border-gray-800 bg-gray-900/40 backdrop-blur-md transition-all duration-300 flex flex-col
            ${isSidebarOpen ? 'w-80 translate-x-0' : 'w-0 translate-x-full overflow-hidden border-none'}
          `}
        >
          {/* Tabs */}
          <div className="flex border-b border-gray-800 shrink-0">
            <button
              onClick={() => setSidebarTab('log')}
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 ${sidebarTab === 'log' ? 'text-blue-400 bg-blue-900/20 border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <MessageSquare size={14} />
              Log
            </button>
            <button
              onClick={() => setSidebarTab('settings')}
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 ${sidebarTab === 'settings' ? 'text-blue-400 bg-blue-900/20 border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <Settings size={14} />
              Settings
            </button>
          </div>

          <div className="p-4 border-b border-gray-800 shrink-0">
            <TypeStatus />
          </div>

          <div className="flex-1 overflow-hidden">
            {sidebarTab === 'log' ? <ArchipelagoLog /> : (
              <SettingsPanel isOpen={true} onClose={() => setIsSidebarOpen(false)} isEmbedded />
            )}
          </div>
        </aside>

        {/* Debug Controls - inside Main/Sidebar container to be positioned at bottom of viewport */}
        {isDebugVisible && (
          <div className="absolute bottom-0 left-0 right-0 z-20 bg-gray-900/95 backdrop-blur-sm border-t border-gray-800 transition-all duration-300" style={{ right: isSidebarOpen ? '320px' : '0' }}>
            <div className="max-w-screen-xl mx-auto flex flex-col gap-2 px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 uppercase tracking-wider font-bold">Debug Controls</span>
                <div className="flex gap-2">
                  <button onClick={() => (window as any).runAutoComplete?.()} className="px-3 py-1 bg-green-900/50 hover:bg-green-900/80 text-green-200 rounded text-xs border border-green-700/50 whitespace-nowrap">Auto-Complete Start</button>
                  <button onClick={() => (window as any).stopAutoComplete?.()} className="px-3 py-1 bg-red-900/50 hover:bg-red-900/80 text-red-200 rounded text-xs border border-red-700/50 whitespace-nowrap">Auto-Complete Stop</button>
                  <button onClick={unlockRandom} className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs border border-gray-700 whitespace-nowrap">Unlock 1</button>
                  <button onClick={unlockBatch} className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs border border-gray-700 whitespace-nowrap">Unlock 10</button>
                  <button onClick={unlockAll} className="px-3 py-1 bg-red-900/50 hover:bg-red-900/80 text-red-200 rounded text-xs border border-red-700/50 whitespace-nowrap">Unlock ALL</button>
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
    </div>
  );
};

const App: React.FC = () => {
  return (
    <GameProvider>
      <GameContent />
    </GameProvider>
  );
};

export default App;
