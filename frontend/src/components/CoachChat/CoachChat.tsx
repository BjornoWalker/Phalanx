import { useEffect, useRef } from 'react';
import CoachAvatar from './CoachAvatar';

export interface CoachMessage {
  id: number;
  type: 'coach' | 'system';
  text: string;
  classification?: string;
  isStreaming?: boolean;
}

interface CoachChatProps {
  messages: CoachMessage[];
  avatarId?: string;
}

const CLASSIFICATION_COLORS: Record<string, string> = {
  brilliant: '#1abc9c',
  great: '#5682d1',
  best: '#81b64c',
  good: '#81b64c',
  mistake: '#e5b80b',
  miss: '#e67e22',
  blunder: '#ca2c2c',
};

export default function CoachChat({ messages, avatarId = 'robot' }: CoachChatProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div
      className="flex-1 overflow-y-auto p-3 space-y-3"
      style={{ backgroundColor: 'var(--bg-tertiary)' }}
    >
      {messages.length === 0 && (
        <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>
          Play a move to get coaching feedback
        </p>
      )}

      {messages.map((msg) => (
        <div key={msg.id} className="flex gap-2">
          {msg.type === 'coach' && (
            <div className="mt-1">
              <CoachAvatar avatarId={avatarId} size="sm" />
            </div>
          )}
          <div
            className={`
              rounded-lg px-3 py-2 text-sm max-w-[280px]
              ${msg.type === 'system' ? 'mx-auto text-center' : ''}
            `}
            style={{
              backgroundColor:
                msg.type === 'system' ? 'transparent' : 'var(--bg-secondary)',
              color:
                msg.type === 'system'
                  ? 'var(--text-muted)'
                  : 'var(--text-primary)',
            }}
          >
            {msg.classification && (
              <div className="mb-1.5">
                <span
                  className="inline-block text-xs font-bold px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: CLASSIFICATION_COLORS[msg.classification] || '#666',
                    color: 'white',
                  }}
                >
                  {msg.classification}
                </span>
              </div>
            )}
            <span>
              {msg.text}
              {msg.isStreaming && (
                <span className="animate-pulse ml-1" style={{ color: 'var(--text-muted)' }}>
                  ...
                </span>
              )}
            </span>
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
