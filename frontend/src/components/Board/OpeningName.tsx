interface OpeningNameProps {
  eco: string | null;
  name: string | null;
}

export default function OpeningName({ eco, name }: OpeningNameProps) {
  if (!eco && !name) {
    return (
      <div
        className="h-7 flex items-center px-1 text-xs"
        style={{ color: 'var(--text-muted)' }}
      >
        Opening
      </div>
    );
  }

  return (
    <div className="h-7 flex items-center gap-2 px-1">
      {eco && (
        <span
          className="text-xs font-bold px-1.5 py-0.5 rounded"
          style={{
            backgroundColor: 'var(--bg-tertiary)',
            color: 'var(--accent-green)',
          }}
        >
          {eco}
        </span>
      )}
      <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
        {name}
      </span>
    </div>
  );
}
