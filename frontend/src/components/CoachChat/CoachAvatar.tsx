export const COACH_AVATARS: Record<string, { emoji: string; label: string; desc: string }> = {
  robot: { emoji: '🤖', label: 'Robot', desc: 'Precise & data-driven' },
  teacher: { emoji: '👨‍🏫', label: 'Teacher', desc: 'Patient & encouraging' },
  wizard: { emoji: '🧙', label: 'Wizard', desc: 'Asks you to think first' },
  brain: { emoji: '🧠', label: 'Brain', desc: 'Compares candidate moves' },
  owl: { emoji: '🦉', label: 'Owl', desc: 'Teaches principles & patterns' },
};

interface CoachAvatarProps {
  avatarId: string;
  size?: 'sm' | 'md';
}

export default function CoachAvatar({ avatarId, size = 'md' }: CoachAvatarProps) {
  const avatar = COACH_AVATARS[avatarId] || COACH_AVATARS.robot;
  const sizeClass = size === 'sm' ? 'w-8 h-8 text-base' : 'w-10 h-10 text-xl';

  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center shrink-0`}
      style={{ backgroundColor: 'var(--accent-green)' }}
      title={avatar.label}
    >
      {avatar.emoji}
    </div>
  );
}
