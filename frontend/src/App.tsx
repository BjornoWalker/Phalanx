import { useState } from 'react';
import { ActiveTabProvider } from './contexts/ActiveTabContext';
import ErrorBoundary from './components/ErrorBoundary';
import AnalysisTab from './tabs/AnalysisTab';
import ReviewTab from './tabs/ReviewTab';
import CoachTab from './tabs/CoachTab';
import PuzzlesTab from './tabs/PuzzlesTab';
import SettingsTab from './tabs/SettingsTab';

type Tab = 'analysis' | 'review' | 'coach' | 'puzzles' | 'settings';

interface TabDef {
  id: Tab;
  label: string;
  icon: string;
}

const TABS: TabDef[] = [
  { id: 'analysis', label: 'Analysis', icon: '♟' },
  { id: 'review', label: 'Review', icon: '🔍' },
  { id: 'coach', label: 'Coach', icon: '🎓' },
  { id: 'puzzles', label: 'Puzzles', icon: '🧩' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
];

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('analysis');

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <nav
        className="flex flex-col w-16 shrink-0"
        style={{
          backgroundColor: 'var(--bg-tertiary)',
          borderRight: '1px solid var(--border-color)',
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex flex-col items-center justify-center py-4 px-1 cursor-pointer
              transition-colors duration-150 relative
              ${activeTab === tab.id ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}
            `}
            style={{
              backgroundColor: activeTab === tab.id ? 'var(--bg-secondary)' : 'transparent',
            }}
            title={tab.label}
          >
            {activeTab === tab.id && (
              <div
                className="absolute left-0 top-1 bottom-1 w-0.5 rounded-r"
                style={{ backgroundColor: 'var(--accent-green)' }}
              />
            )}
            <span className="text-xl">{tab.icon}</span>
            <span className="text-[10px] mt-1">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Main Content — all tabs stay mounted, hidden via CSS for state persistence */}
      <ActiveTabProvider value={activeTab}>
        <main className="flex-1 overflow-hidden relative">
          {/* Tabs use visibility+absolute instead of display:none to keep layout dimensions
              (react-chessboard crashes with "Square width not found" in display:none containers) */}
          {TABS.map((tab) => (
            <div
              key={tab.id}
              className="absolute inset-0"
              style={{
                visibility: activeTab === tab.id ? 'visible' : 'hidden',
                opacity: activeTab === tab.id ? 1 : 0,
                pointerEvents: activeTab === tab.id ? 'auto' : 'none',
                zIndex: activeTab === tab.id ? 1 : 0,
              }}
            >
              <ErrorBoundary>
                {tab.id === 'analysis' && <AnalysisTab />}
                {tab.id === 'review' && <ReviewTab />}
                {tab.id === 'coach' && <CoachTab />}
                {tab.id === 'puzzles' && <PuzzlesTab />}
                {tab.id === 'settings' && <SettingsTab />}
              </ErrorBoundary>
            </div>
          ))}
        </main>
      </ActiveTabProvider>
    </div>
  );
}

export default App;
