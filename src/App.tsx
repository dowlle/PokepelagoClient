import React from 'react';
import { GameProvider, useGame } from './context/GameContext';
import { DexGrid } from './components/DexGrid';
import { GlobalGuessInput } from './components/GlobalGuessInput';
import { SettingsPanel } from './components/SettingsPanel';
import { SettingsModal } from './components/SettingsModal';
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
import { DebugPanel } from './components/DebugPanel';
import { TourOverlay } from './components/TourOverlay';
import { TourPrompt } from './components/TourPrompt';
import { useTour } from './hooks/useTour';
import type { TourMode } from './hooks/useTour';
import { TwitchProvider } from './context/TwitchContext';

const isOverlayMode = new URLSearchParams(window.location.search).has('overlay');

const GameContent: React.FC = () => {
  const {
    allPokemon, checkedIds, isLoading, isConnected,
    uiSettings, goal, gameMode, isPokemonGuessable,
    STARTER_OFFSET, MILESTONE_OFFSET,
    startingLocationsEnabled, gameStarted, connectionKey,
    pokemonLoadError, retryPokemonLoad,
    releasedIds,
  } = useGame();

  const [adventureOverlayDismissed, setAdventureOverlayDismissed] = React.useState(false);
  // Reset on every new connection (covers both disconnect→reconnect and game-switching).
  React.useEffect(() => {
    setAdventureOverlayDismissed(false);
  }, [connectionKey]);
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  const [isLogOpen, setIsLogOpen] = React.useState(false);
  const [twitchIntegration, setTwitchIntegration] = React.useState(() => localStorage.getItem('pokepelago_twitch_integration') === 'true');
  const [isSettingsModalOpen, setSettingsModalOpen] = React.useState(false);
  const [sidebarTab, setSidebarTab] = React.useState<'tracker' | 'settings' | 'twitch'>(() => {
    const defaultTab = localStorage.getItem('pokepelago_defaultTab') as 'tracker' | 'settings' | 'twitch';
    if (defaultTab && (defaultTab === 'tracker' || defaultTab === 'settings' || defaultTab === 'twitch')) {
      localStorage.removeItem('pokepelago_defaultTab');
      return defaultTab;
    }
    return 'tracker';
  });
  React.useEffect(() => {
    const handler = () => {
      const enabled = localStorage.getItem('pokepelago_twitch_integration') === 'true';
      setTwitchIntegration(enabled);
      if (!enabled) setSidebarTab(prev => prev === 'twitch' ? 'tracker' : prev);
    };
    window.addEventListener('pokepelago_twitch_integration_changed', handler);
    return () => window.removeEventListener('pokepelago_twitch_integration_changed', handler);
  }, []);
  const [mobilePanel, setMobilePanel] = React.useState<'log' | 'tracker' | 'settings' | 'twitch' | null>(null);
  const [isDebugVisible, setIsDebugVisible] = React.useState(false);
  const tour = useTour();

  // Listen for tour restart from settings
  React.useEffect(() => {
    const handler = () => tour.start((gameMode as TourMode) ?? 'archipelago');
    window.addEventListener('pokepelago_tour_restart', handler);
    return () => window.removeEventListener('pokepelago_tour_restart', handler);
  }, [tour, gameMode]);

  // Tour panel switching callback
  const handleTourSwitchPanel = React.useCallback((panel: 'settings' | 'tracker' | null) => {
    if (!panel) return;
    // Desktop: switch sidebar tab and ensure sidebar is open
    setSidebarTab(panel);
    setIsSidebarOpen(true);
    // Mobile: open bottom sheet
    setMobilePanel(panel);
  }, []);

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


  // Expose debug toggle to window for GlobalGuessInput to call (dev/beta only)
  React.useEffect(() => {
    if (!import.meta.env.DEV && !__IS_BETA__) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).toggleDebug = () => setIsDebugVisible(prev => {
      const next = !prev;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).isDebugVisible = next;
      return next;
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).isDebugVisible = isDebugVisible;
  }, [isDebugVisible]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center text-white themed-bg" style={{ backgroundColor: 'var(--pp-bg-base)' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-green-500 rounded-full animate-spin border-t-transparent"></div>
          <span className="text-gray-400">Loading Pokédex...</span>
        </div>
      </div>
    );
  }

  if (pokemonLoadError) {
    return (
      <div className="flex h-screen items-center justify-center text-white p-8 themed-bg" style={{ backgroundColor: 'var(--pp-bg-base)' }}>
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

  if (!gameMode) {
    return <SplashScreen />;
  }

  return (
    <div className="h-screen flex flex-col text-white font-sans overflow-hidden themed-bg" style={{ backgroundColor: 'var(--pp-bg-base)' }}>
      <div className="relative shrink-0">
        <GlobalGuessInput />
        <TourPrompt
          visible={tour.shouldShowPrompt}
          onStart={tour.start}
          onDismiss={tour.dismissPrompt}
          gameMode={(gameMode as TourMode) ?? 'archipelago'}
        />
      </div>

      {/* Toolbar - hidden on mobile (merged into DexGrid filter bar), visible on md+ */}
      <div className="z-20 shrink-0 hidden md:block themed-header" style={{ backgroundColor: 'var(--pp-bg-surface)', borderBottom: '1px solid var(--pp-border)' }}>
        <div className={`${uiSettings.widescreen ? 'max-w-none px-8' : 'max-w-screen-xl'} mx-auto flex items-center justify-between px-2 py-1 sm:px-4 sm:py-2`}>
          <div className="flex items-center gap-3">
            {/* Log sidebar toggle (desktop only) */}
            <button
              onClick={() => {
                const next = !isLogOpen;
                setIsLogOpen(next);
              }}
              data-tour="log-toggle"
              className={`hidden md:block p-1.5 rounded transition-all ${isLogOpen ? 'bg-blue-600 text-white' : 'hover:bg-gray-800 text-gray-400'}`}
              title={isLogOpen ? "Hide Log" : "Show Log"}
            >
              {isLogOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
            </button>

            {/* Connection status */}
            <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded ${isConnected ? 'bg-green-900/30 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
              {isConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
              {isConnected ? 'Connected' : 'Offline'}
            </div>

            <span className="hidden md:inline text-xs text-gray-500">
              Guessable: <span className="text-orange-400 font-bold">{allPokemon.filter(p => !checkedIds.has(p.id) && isPokemonGuessable(p.id).canGuess).length}</span>
            </span>

            {goal && (
              <span className="text-xs text-gray-500 bg-blue-900/20 px-2 py-1 rounded border border-blue-800/30">
                <span className="hidden md:inline">Goal: </span>
                <span className="text-blue-400 font-bold">
                  {goal.type === 'any_pokemon' ? `${guessedPokemonCount}/${goal.amount}` :
                    goal.type === 'region_completion' ? `${goal.region}` :
                      goal.type === 'percentage' ? `${Math.round((guessedPokemonCount / allPokemon.length) * 100)}%/${goal.amount}%` :
                        goal.type === 'all_legendaries' ? `Legendaries` : '?'}
                </span>
                <span className="hidden md:inline text-blue-400 font-bold">
                  {goal.type === 'any_pokemon' ? ` Pokémon` :
                    goal.type === 'region_completion' ? ` — Catch All` :
                      goal.type === 'percentage' ? ` Pokémon` :
                        goal.type === 'all_legendaries' ? ` — Catch All` : ''}
                </span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSettingsModalOpen(true)}
              className="hidden md:block p-1.5 rounded transition-all hover:bg-gray-800 text-gray-400"
              title="Settings"
              data-tour="settings-gear"
            >
              <Settings size={16} />
            </button>
            <button
              onClick={() => {
                const next = !isSidebarOpen;
                setIsSidebarOpen(next);
              }}
              className={`hidden md:block p-1.5 rounded transition-all ${isSidebarOpen ? 'bg-blue-600 text-white' : 'hover:bg-gray-800 text-gray-400'}`}
              title={isSidebarOpen ? "Hide Sidebar" : "Show Sidebar"}
            >
              {isSidebarOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Sidebar - Log (desktop only) */}
        <aside
          className={`
            hidden md:flex flex-col backdrop-blur-md transition-[width,transform] duration-300
            relative
            ${isLogOpen ? 'w-80' : 'w-0 overflow-hidden border-none'}
          `}
          style={{ backgroundColor: 'var(--pp-sidebar-bg)', borderRight: isLogOpen ? '1px solid var(--pp-border)' : 'none' }}
        >
          <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: '1px solid var(--pp-border)' }}>
            <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--pp-text-secondary)' }}>
              <MessageSquare size={14} />
              Log
            </span>
          </div>
          <div className="flex-1 overflow-hidden">
            <ArchipelagoLog />
          </div>
        </aside>

        {/* Main Content */}
        <main className={`flex-1 overflow-y-auto [scrollbar-gutter:stable] pb-20 md:pb-16 ${uiSettings.widescreen ? 'px-6' : 'px-1 sm:px-4'}`}>
          <div className={`${uiSettings.widescreen ? 'max-w-none' : 'max-w-screen-xl'} mx-auto pt-2 md:pt-6`}>
            <DexGrid />
          </div>
        </main>

        {/* Right Sidebar - Tracker / Settings / Twitch (desktop only) */}
        <aside
          className={`
            hidden md:flex flex-col backdrop-blur-md transition-[width,transform] duration-300
            relative
            ${isSidebarOpen ? 'w-80' : 'w-0 overflow-hidden border-none'}
          `}
          style={{ backgroundColor: 'var(--pp-sidebar-bg)', borderLeft: isSidebarOpen ? '1px solid var(--pp-border)' : 'none' }}
        >
          {/* Tabs */}
          <div className="flex shrink-0" style={{ borderBottom: '1px solid var(--pp-border)' }}>
            <button
              onClick={() => setSidebarTab('tracker')}
              data-tour="tracker-tab"
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 ${sidebarTab === 'tracker' ? 'text-blue-400 bg-blue-900/20 border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <LayoutGrid size={14} />
              Tracker
            </button>
            <button
              onClick={() => setSidebarTab('settings')}
              data-tour="settings-tab"
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
              <SettingsPanel isOpen={true} onClose={() => setIsSidebarOpen(false)} isEmbedded onOpenModal={() => setSettingsModalOpen(true)} />
            )}
          </div>
        </aside>

        {/* Debug Controls - dev/beta only */}
        {(import.meta.env.DEV || __IS_BETA__) && isDebugVisible && (
          <DebugPanel isLogOpen={isLogOpen} isSidebarOpen={isSidebarOpen} />
        )}
      </div>

      {/* Mobile bottom sheet backdrop */}
      {mobilePanel && (
        <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={() => setMobilePanel(null)} />
      )}

      {/* Mobile bottom sheet panel */}
      <div className={`
        fixed inset-x-0 bottom-20 z-40 md:hidden
        rounded-t-2xl
        transition-transform duration-300
        ${mobilePanel ? 'translate-y-0' : 'translate-y-full'}
        h-[85vh] flex flex-col
      `} style={{ backgroundColor: 'var(--pp-bg-surface)', borderTop: '1px solid var(--pp-border)' }}>
        <div className="flex justify-center py-2 shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-700" />
        </div>
        <div className="flex-1 overflow-hidden">
          {mobilePanel === 'log' ? (
            <ArchipelagoLog />
          ) : mobilePanel === 'tracker' ? (
            <div className="p-4 flex flex-col gap-3 overflow-y-auto h-full">
              <TypeStatus />
              <GateTracker />
            </div>
          ) : mobilePanel === 'twitch' && __TWITCH_ENABLED__ && twitchIntegration ? (
            <TwitchLeaderboard />
          ) : mobilePanel === 'settings' ? (
            <SettingsPanel isOpen={true} onClose={() => setMobilePanel(null)} isEmbedded onOpenModal={() => setSettingsModalOpen(true)} />
          ) : null}
        </div>
      </div>

      {/* Mobile status strip — sits above bottom nav */}
      <div className="fixed bottom-14 inset-x-0 z-50 md:hidden backdrop-blur-sm flex items-center justify-center gap-3 px-3 py-1" style={{ backgroundColor: 'var(--pp-sidebar-bg)', borderTop: '1px solid var(--pp-border)' }}>
        <div className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${isConnected ? 'bg-green-900/30 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
          {isConnected ? <Wifi size={10} /> : <WifiOff size={10} />}
          {isConnected ? 'Connected' : 'Offline'}
        </div>
        {goal && (
          <span className="text-[10px] text-gray-500 bg-blue-900/20 px-1.5 py-0.5 rounded border border-blue-800/30">
            <span className="text-blue-400 font-bold">
              {goal.type === 'any_pokemon' ? `${guessedPokemonCount}/${goal.amount}` :
                goal.type === 'region_completion' ? `${goal.region}` :
                  goal.type === 'percentage' ? `${Math.round((guessedPokemonCount / allPokemon.length) * 100)}%/${goal.amount}%` :
                    goal.type === 'all_legendaries' ? `Legendaries` : '?'}
            </span>
          </span>
        )}
      </div>

      {/* Mobile bottom nav bar */}
      <nav className="fixed bottom-0 inset-x-0 z-50 md:hidden flex h-14" style={{ backgroundColor: 'var(--pp-nav-bg)', borderTop: '1px solid var(--pp-border)' }}>
        <button
          onClick={() => setMobilePanel(prev => prev === 'log' ? null : 'log')}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${mobilePanel === 'log' ? 'text-blue-400' : 'text-gray-500'}`}
        >
          <MessageSquare size={18} />
          <span className="text-[10px] font-bold">Log</span>
        </button>
        <button
          onClick={() => setMobilePanel(prev => prev === 'tracker' ? null : 'tracker')}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${mobilePanel === 'tracker' ? 'text-blue-400' : 'text-gray-500'}`}
        >
          <LayoutGrid size={18} />
          <span className="text-[10px] font-bold">Tracker</span>
        </button>
        <button
          onClick={() => setMobilePanel(prev => prev === 'settings' ? null : 'settings')}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${mobilePanel === 'settings' ? 'text-blue-400' : 'text-gray-500'}`}
        >
          <Settings size={18} />
          <span className="text-[10px] font-bold">Settings</span>
        </button>
        {__TWITCH_ENABLED__ && twitchIntegration && (
          <button
            onClick={() => setMobilePanel(prev => prev === 'twitch' ? null : 'twitch')}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${mobilePanel === 'twitch' ? 'text-purple-400' : 'text-gray-500'}`}
          >
            <Tv size={18} />
            <span className="text-[10px] font-bold">Twitch</span>
          </button>
        )}
      </nav>

      <PokemonDetails />

      <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setSettingsModalOpen(false)} />

      {isConnected && gameMode === 'archipelago' && startingLocationsEnabled && !gameStarted && !adventureOverlayDismissed && (
        <StartGameOverlay onDismiss={() => setAdventureOverlayDismissed(true)} />
      )}

      <TourOverlay tour={tour} onSwitchPanel={handleTourSwitchPanel} onOpenSettingsModal={() => setSettingsModalOpen(true)} onCloseSettingsModal={() => setSettingsModalOpen(false)} />
    </div>
  );
};

const App: React.FC = () => {
  React.useEffect(() => {
    if (isOverlayMode) document.title = 'Poképelago Tracker';
    else if (__IS_BETA__) document.title = 'Poképelago (beta)';
  }, []);

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
