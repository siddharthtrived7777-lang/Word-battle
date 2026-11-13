import React, { useState } from 'react';
import { Copy, Check, Share2, Play, Sliders } from 'lucide-react';
import { CategorySelection, GameSettings, Language, RoomState } from '../types/game';
import { CATEGORIES, getCategoryLabel } from '../data/wordPairs';
import { t } from '../data/i18n';
import { Avatar } from '../components/Avatar';
import { getSortedPlayers } from '../utils/gameLogic';

interface LobbyScreenProps {
  lang: Language;
  room: RoomState;
  myId: string;
  speakingIds: Record<string, boolean>;
  onUpdateSettings: (settings: GameSettings) => void;
  onStartGame: () => void;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  lang,
  room,
  myId,
  speakingIds,
  onUpdateSettings,
  onStartGame,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const players = getSortedPlayers(room.players);
  const isHost = room.hostId === myId;
  const canStart = players.length >= 3 && players.length <= 10;
  const canTwoImposters = players.length >= 5;

  const handleCopyCode = () => {
    navigator.clipboard?.writeText(room.code).then(() => {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1800);
    });
  };

  const handleShareLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${room.code}`;
    if (navigator.share) {
      navigator
        .share({
          title: 'Imposter Word',
          text: `Join my Imposter Word room: ${room.code}`,
          url,
        })
        .catch(() => {});
    } else {
      navigator.clipboard?.writeText(url).then(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 1800);
      });
    }
  };

  const updateCategory = (category: CategorySelection) => {
    if (!isHost) return;
    onUpdateSettings({ ...room.settings, category });
  };

  const updateRounds = (rounds: 3 | 4 | 5) => {
    if (!isHost) return;
    onUpdateSettings({ ...room.settings, rounds });
  };

  const updateImposters = (imposterCount: 1 | 2) => {
    if (!isHost) return;
    if (imposterCount === 2 && !canTwoImposters) return;
    onUpdateSettings({ ...room.settings, imposterCount });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-5 pb-28 space-y-5">
      {/* Room Code Banner */}
      <div className="bg-[#151C2C] border border-slate-800/80 rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-slate-400 mb-1">
            {t(lang, 'roomCode')}
          </p>
          <div className="font-mono-nums text-3xl sm:text-4xl font-bold tracking-[0.22em] text-amber-400">
            {room.code}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleCopyCode}
            className="flex-1 sm:flex-initial min-h-[46px] px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm font-semibold flex items-center justify-center gap-2 whitespace-nowrap transition-colors active:scale-[0.98]"
          >
            {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copiedCode ? t(lang, 'copied') : t(lang, 'copyCode')}</span>
          </button>

          <button
            type="button"
            onClick={handleShareLink}
            className="flex-1 sm:flex-initial min-h-[46px] px-4 rounded-2xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-sm font-semibold flex items-center justify-center gap-2 whitespace-nowrap transition-colors active:scale-[0.98]"
          >
            {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
            <span>{copiedLink ? t(lang, 'linkCopied') : t(lang, 'shareLink')}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Players List */}
        <div className="lg:col-span-6 bg-[#151C2C] border border-slate-800/80 rounded-3xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-bold text-white">
              {t(lang, 'playersCount')}
            </h2>
            <span className="font-mono-nums text-sm font-bold text-slate-300">
              {players.length} / 10
            </span>
          </div>

          <div className="space-y-2.5">
            {players.map((p) => {
              const isMe = p.id === myId;
              const isSpeaking = Boolean(speakingIds[p.id]);
              return (
                <div
                  key={p.id}
                  className={`flex items-center justify-between gap-3 p-3 rounded-2xl transition-colors ${
                    isMe ? 'bg-slate-800/70' : 'bg-[#0B0F17]/70'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar
                      name={p.name}
                      avatar={p.avatar}
                      size="md"
                      isHost={p.id === room.hostId}
                      isMuted={p.isMuted}
                      isSpeaking={isSpeaking}
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white truncate">
                        {p.name}
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-1.5">
                        {p.id === room.hostId && (
                          <span className="text-amber-400 font-medium">{t(lang, 'hostLabel')}</span>
                        )}
                        {p.id === room.hostId && isMe && <span aria-hidden="true">·</span>}
                        {isMe && <span>{t(lang, 'youLabel')}</span>}
                        {!isMe && p.id !== room.hostId && (
                          <span>{isSpeaking ? t(lang, 'speakingNow') : 'Voice ready'}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {p.score > 0 && (
                    <span className="font-mono-nums text-xs font-bold text-amber-300 shrink-0">
                      {p.score} {t(lang, 'pointsUnit')}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {players.length < 3 && (
            <p className="mt-4 text-xs text-amber-300/90 font-medium">
              {t(lang, 'minPlayersNotice')}
            </p>
          )}
        </div>

        {/* Host Settings + Start Action */}
        <div className="lg:col-span-6 space-y-5">
          <div className="bg-[#151C2C] border border-slate-800/80 rounded-3xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Sliders className="w-4 h-4 text-amber-400" />
              <h2 className="font-display text-lg font-bold text-white">
                {t(lang, 'gameSettings')}
              </h2>
            </div>

            {/* Category Selection */}
            <div className="mb-5">
              <span className="block text-xs font-semibold text-slate-400 mb-2">
                {t(lang, 'categoryLabel')}
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={!isHost}
                  onClick={() => updateCategory('random')}
                  className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold text-left truncate transition-colors ${
                    room.settings.category === 'random'
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-[#0B0F17] text-slate-300 hover:bg-slate-800 disabled:opacity-70'
                  }`}
                >
                  {getCategoryLabel('random', lang)}
                </button>
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    disabled={!isHost}
                    onClick={() => updateCategory(cat.id)}
                    className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold text-left truncate transition-colors ${
                      room.settings.category === cat.id
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-[#0B0F17] text-slate-300 hover:bg-slate-800 disabled:opacity-70'
                    }`}
                  >
                    {cat[lang]}
                  </button>
                ))}
              </div>
            </div>

            {/* Rounds & Imposters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="block text-xs font-semibold text-slate-400 mb-2">
                  {t(lang, 'roundsLabel')}
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {([3, 4, 5] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      disabled={!isHost}
                      onClick={() => updateRounds(r)}
                      className={`min-h-[44px] rounded-xl font-mono-nums text-sm font-bold transition-colors ${
                        room.settings.rounds === r
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-[#0B0F17] text-slate-300 hover:bg-slate-800 disabled:opacity-70'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="block text-xs font-semibold text-slate-400 mb-2">
                  {t(lang, 'impostersLabel')}
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {([1, 2] as const).map((count) => {
                    const locked = count === 2 && !canTwoImposters;
                    return (
                      <button
                        key={count}
                        type="button"
                        disabled={!isHost || locked}
                        onClick={() => updateImposters(count)}
                        className={`min-h-[44px] rounded-xl font-mono-nums text-sm font-bold transition-colors ${
                          room.settings.imposterCount === count && !locked
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-[#0B0F17] text-slate-300 hover:bg-slate-800 disabled:opacity-40'
                        }`}
                      >
                        {count}
                      </button>
                    );
                  })}
                </div>
                {!canTwoImposters && (
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    {t(lang, 'imposterMinPlayers')}
                  </p>
                )}
              </div>
            </div>
          </div>

          {isHost ? (
            <button
              type="button"
              disabled={!canStart}
              onClick={onStartGame}
              className="w-full min-h-[56px] px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-display font-bold text-base flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98]"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>{t(lang, 'startGame')}</span>
            </button>
          ) : (
            <div className="p-4 rounded-2xl bg-[#151C2C] border border-slate-800/80 text-center text-sm text-slate-400 font-medium">
              {t(lang, 'waitingForHost')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
