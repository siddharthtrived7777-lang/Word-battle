import React from 'react';
import { Crown, MicOff } from 'lucide-react';
import { PlayerAvatar } from '../types/game';

export const AVATAR_COLORS = [
  '#F59E0B', // amber
  '#10B981', // emerald
  '#3B82F6', // blue
  '#EC4899', // pink
  '#8B5CF6', // violet
  '#EF4444', // crimson
  '#14B8A6', // teal
  '#F97316', // orange
];

export const AVATAR_EMOJIS = [
  '🦊', '🐼', '🦁', '🐸', '🦉', '🐙', '🦄', '🐝',
  '🐯', '🐨', '🐧', '🦋', '🐢', '🐺', '🦝', '🐬',
];

export function getInitials(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return '?';
  const parts = cleaned.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase();
}

interface AvatarProps {
  name: string;
  avatar: PlayerAvatar;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isSpeaking?: boolean;
  isMuted?: boolean;
  isHost?: boolean;
  isActiveTurn?: boolean;
}

const SIZE_CLASSES: Record<'sm' | 'md' | 'lg' | 'xl', string> = {
  sm: 'w-9 h-9 text-sm',
  md: 'w-12 h-12 text-lg',
  lg: 'w-14 h-14 text-2xl',
  xl: 'w-20 h-20 text-3xl',
};

export const Avatar: React.FC<AvatarProps> = ({
  name,
  avatar,
  size = 'md',
  isSpeaking = false,
  isMuted = false,
  isHost = false,
  isActiveTurn = false,
}) => {
  const ringClass = isSpeaking
    ? 'speaking-glow ring-2 ring-emerald-400'
    : isActiveTurn
      ? 'ring-2 ring-amber-400 shadow-lg shadow-amber-500/20'
      : 'ring-1 ring-white/10';

  return (
    <div className="relative inline-flex shrink-0 items-center justify-center">
      <div
        className={`${SIZE_CLASSES[size]} ${ringClass} rounded-2xl flex items-center justify-center font-display font-bold text-slate-950 select-none transition-transform duration-150`}
        style={{
          backgroundColor: avatar.type === 'emoji' ? '#1E293B' : avatar.color,
        }}
        aria-label={name}
      >
        {avatar.type === 'emoji' ? (
          <span className="leading-none">{avatar.emoji || '🦊'}</span>
        ) : (
          <span className="tracking-tight text-slate-950">{getInitials(name)}</span>
        )}
      </div>

      {isHost && (
        <span
          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center shadow-md"
          title="Host"
        >
          <Crown className="w-3 h-3 stroke-[2.5]" />
        </span>
      )}

      {isMuted && (
        <span
          className="absolute -bottom-1 -right-1 w-5 h-5 rounded-lg bg-slate-800 border border-slate-700 text-rose-400 flex items-center justify-center shadow-sm"
          title="Muted"
        >
          <MicOff className="w-3 h-3" />
        </span>
      )}
    </div>
  );
};
