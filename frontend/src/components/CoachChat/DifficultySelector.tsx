interface Tier {
  name: string;
  rating: number;
}

const TIERS: Tier[] = [
  { name: 'New to Chess', rating: 200 },
  { name: 'Beginner', rating: 400 },
  { name: 'Novice', rating: 800 },
  { name: 'Intermediate', rating: 900 },
  { name: 'Intermediate II', rating: 1200 },
  { name: 'Advanced', rating: 1600 },
  { name: 'Expert', rating: 2000 },
];

interface DifficultySelectorProps {
  selected: string;
  onSelect: (tier: string) => void;
}

export default function DifficultySelector({
  selected,
  onSelect,
}: DifficultySelectorProps) {
  return (
    <div className="flex flex-col gap-1">
      {TIERS.map((tier) => {
        const isSelected = selected === tier.name;
        return (
          <button
            key={tier.name}
            onClick={() => onSelect(tier.name)}
            className="flex items-center justify-between px-4 py-3 rounded-lg text-sm cursor-pointer transition-all"
            style={{
              backgroundColor: isSelected ? 'var(--bg-tertiary)' : 'transparent',
              border: isSelected
                ? '2px solid var(--accent-green)'
                : '2px solid transparent',
              color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
          >
            <span className="font-medium">{tier.name}</span>
            <span
              className="text-xs font-mono"
              style={{ color: 'var(--text-muted)' }}
            >
              ({tier.rating})
            </span>
          </button>
        );
      })}
    </div>
  );
}
