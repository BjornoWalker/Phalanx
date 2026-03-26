interface KeyboardShortcutsHelpProps {
  onClose: () => void;
}

const SHORTCUTS = [
  { key: '←', action: 'Previous move' },
  { key: '→', action: 'Next move' },
  { key: '⌘ ←', action: 'Go to start' },
  { key: '⌘ →', action: 'Go to end' },
  { key: 'Space', action: 'Flip board' },
  { key: 'Scroll', action: 'Navigate moves (on board)' },
  { key: 'Esc', action: 'Close dialog' },
  { key: '?', action: 'Show this help' },
];

export default function KeyboardShortcutsHelp({ onClose }: KeyboardShortcutsHelpProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="rounded-xl p-6 w-[320px]"
        style={{ backgroundColor: 'var(--bg-secondary)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-4">Keyboard Shortcuts</h3>
        <div className="space-y-2">
          {SHORTCUTS.map(({ key, action }) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {action}
              </span>
              <kbd
                className="px-2 py-0.5 rounded text-xs font-mono"
                style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                }}
              >
                {key}
              </kbd>
            </div>
          ))}
        </div>
        <button
          onClick={onClose}
          className="w-full mt-4 py-2 rounded-lg text-sm cursor-pointer"
          style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
