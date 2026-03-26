import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

export interface Settings {
  board_theme: string;
  piece_set: string;
  coaching_mode: 'template' | 'llm';
  llm_model: string;
  difficulty: string;
  show_best_move: boolean;
  dark_mode: boolean;
  analysis_depth: number;
  multipv: number;
  coach_avatar: string;
  coach_verbosity: 'short' | 'medium' | 'long';
  blunder_alerts: boolean;
  blunder_threshold: number;
  engine_choice: 'stockfish' | 'lc0' | 'both';
}

const DEFAULT_SETTINGS: Settings = {
  board_theme: 'green',
  piece_set: 'default',
  coaching_mode: 'template',
  llm_model: 'llama3.1:8b',
  difficulty: 'Intermediate',
  show_best_move: true,
  dark_mode: true,
  analysis_depth: 20,
  multipv: 3,
  coach_avatar: 'robot',
  coach_verbosity: 'medium',
  blunder_alerts: true,
  blunder_threshold: 150,
  engine_choice: 'stockfish',
};

interface SettingsContextType {
  settings: Settings;
  updateSettings: (partial: Partial<Settings>) => void;
  isLoaded: boolean;
}

const SettingsContext = createContext<SettingsContextType>({
  settings: DEFAULT_SETTINGS,
  updateSettings: () => {},
  isLoaded: false,
});

export function useSettings() {
  return useContext(SettingsContext);
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load on mount
  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
        setSettings({ ...DEFAULT_SETTINGS, ...data });
        setIsLoaded(true);
      })
      .catch(() => setIsLoaded(true));
  }, []);

  // Apply dark/light theme to document
  useEffect(() => {
    document.documentElement.setAttribute(
      'data-theme',
      settings.dark_mode ? 'dark' : 'light'
    );
  }, [settings.dark_mode]);

  const updateSettings = useCallback(
    (partial: Partial<Settings>) => {
      const updated = { ...settings, ...partial };
      setSettings(updated);

      // Persist to backend
      fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      }).catch(console.error);
    },
    [settings]
  );

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, isLoaded }}>
      {children}
    </SettingsContext.Provider>
  );
}
