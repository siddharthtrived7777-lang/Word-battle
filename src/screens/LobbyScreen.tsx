import React, { useState } from 'react';
import { Check, Share2, Play, Sliders, Users } from 'lucide-react';
import { CategorySelection, GameSettings, Language, RoomState } from '../types/game';
import { CATEGORIES, getCategoryLabel } from '../data/wordPairs';
import { t } from '../data/i18n';
import { getSortedPlayers } from '../utils/gameLogic';

interface LobbyScreenProps {
  lang: Language;
  room: RoomState;
  myId: string;
  onUpdateSettings: (settings: GameSettings) => void;
  onStartGame: () => void;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  lang,
  room,
  myId,
  onUpdateSettings,
  onStartGame,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);

  const players = getSortedPlayers(room.players);
  const isHost = room.hostId === myId;
  const canStart = players.length >= 2 && players.length <= 10;
  const canTwoImposters = players.length >= 5;

  const handleShareLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${room.code}`;
    if (navigator.share) {
      navigator
        .share({
          title: 'Word Battle',
          text: `Join my Word Battle room: ${room.code}`,
          url,
        })
        .catch(() => {});
    } else {
      navigator.clipboard?.writeText(url).then(() => {
        setCopiedLink(true);
        window.setTimeout(() => setCopiedLink(false), 1800);
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
    <div className="space-y-4">
      {/* Lobby Top Summary Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            {t(lang, 'roomLobbyTitle')}
          </h1>
          <div className="flex items-center gap-2 text-xs text-blue-100/80 mt-0.5">
            <Users className="w-3.5 h-3.5 text-sky-300" />
            <span className="font-mono-nums font-semibold">
              {players.length} / 10 {t(lang, 'playersCount')}
            </span>
            {players.length < 2 && (
              <>
                <span aria-hidden="true" className="text-blue-200/40">
                  ·
                </span>
                <span className="text-amber-200 font-medium">{t(lang, 'minPlayersNotice')}</span>
              </>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={handleShareLink}
          className="min-h-[42px] px-3.5 rounded-2xl bg-white/12 hover:bg-white/20 border border-blue-200/20 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors active:scale-[0.98]"
        >
          {copiedLink ? (
            <Check className="w-3.5 h-3.5 text-emerald-300" />
          ) : (
            <Share2 className="w-3.5 h-3.5 text-sky-200" />
          )}
          <span>{copiedLink ? t(lang, 'linkCopied') : t(lang, 'shareLink')}</span>
        </button>
      </div>

      {/* Host Settings Panel */}
      <div className="bg-[#0E246E]/55 border border-blue-200/18 rounded-2xl p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-sky-300" />
          <h2 className="font-display text-sm font-bold text-white uppercase tracking-wider">
            {t(lang, 'gameSettings')}
          </h2>
        </div>

        {/* Category Selection */}
        <div>
          <span className="block text-xs font-semibold text-blue-100/75 mb-2">
            {t(lang, 'categoryLabel')}
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <button
              type="button"
              disabled={!isHost}
              onClick={() => updateCategory('random')}
              className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-semibold text-left truncate transition-colors ${
                room.settings.category === 'random'
                  ? 'bg-white text-[#091A54] shadow-sm'
                  : 'bg-white/8 text-blue-100 hover:bg-white/15 disabled:opacity-75'
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
                className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-semibold text-left truncate transition-colors ${
                  room.settings.category === cat.id
                    ? 'bg-white text-[#091A54] shadow-sm'
                    : 'bg-white/8 text-blue-100 hover:bg-white/15 disabled:opacity-75'
                }`}
              >
                {cat[lang]}
              </button>
            ))}
          </div>
        </div>

        {/* Rounds & Imposters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <span className="block text-xs font-semibold text-blue-100/75 mb-2">
              {t(lang, 'roundsLabel')}
            </span>
            <div className="grid grid-cols-3 gap-2">
              {([3, 4, 5] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  disabled={!isHost}
                  onClick={() => updateRounds(r)}
                  className={`min-h-[42px] rounded-xl font-mono-nums text-sm font-bold transition-colors ${
                    room.settings.rounds === r
                      ? 'bg-white text-[#091A54] shadow-sm'
                      : 'bg-white/8 text-blue-100 hover:bg-white/15 disabled:opacity-75'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="block text-xs font-semibold text-blue-100/75 mb-2">
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
                    className={`min-h-[42px] rounded-xl font-mono-nums text-sm font-bold transition-colors ${
                      room.settings.imposterCount === count && !locked
                        ? 'bg-white text-[#091A54] shadow-sm'
                        : 'bg-white/8 text-blue-100 hover:bg-white/15 disabled:opacity-40'
                    }`}
                  >
                    {count}
                  </button>
                );
              })}
            </div>
            {!canTwoImposters && (
              <p className="text-[11px] text-blue-200/70 mt-1.5">
                {t(lang, 'imposterMinPlayers')}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Start Game CTA */}
      {isHost ? (
        <button
          type="button"
          disabled={!canStart}
          onClick={onStartGame}
          className="w-full min-h-[52px] px-6 rounded-2xl bg-emerald-400 hover:bg-emerald-300 disabled:bg-white/10 disabled:text-blue-200/50 text-[#07184A] font-display font-extrabold text-base flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-400/20 transition-all active:scale-[0.98]"
        >
          <Play className="w-5 h-5 fill-current" />
          <span>{t(lang, 'startGame')}</span>
        </button>
      ) : (
        <div className="p-3.5 rounded-2xl bg-[#0E246E]/55 border border-blue-200/15 text-center text-sm text-blue-100/85 font-medium">
          {t(lang, 'waitingForHost')}
        </div>
      )}
    </div>
  );
};
