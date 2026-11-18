import React, { useState } from 'react';
import { ArrowLeft, BookOpen, LogIn, Play, RotateCcw, Spade, Users } from 'lucide-react';
import type { User } from 'firebase/auth';
import type { CardGameId, CardRoomClientState } from '../types/cardGames';
import type { Language } from '../types/game';
import { CARD_GAMES_INFO, CARD_GAME_ORDER } from '../data/cardGamesInfo';
import { t } from '../data/i18n';
import { isFirestoreConfigured } from '../firebase';
import { CardRulesModal } from '../components/cards/CardRulesModal';

interface PlayingCardsMenuScreenProps {
  lang: Language;
  playerName: string;
  initialJoinCode?: string;
  authReady: boolean;
  authUser: User | null;
  signingIn: boolean;
  onSignIn: () => Promise<void>;
  onCreateRoom: (selectedGame: CardGameId) => Promise<void>;
  onJoinRoom: (code: string) => Promise<void>;
  onBack: () => void;
  rejoinRoom: CardRoomClientState | null;
  onRejoin: (code: string) => Promise<void>;
  onDismissRejoin: () => void;
  errorMsg: string | null;
  loadingAction: 'create' | 'join' | 'rejoin' | null;
}

const TileCardVisual: React.FC<{ gameId: CardGameId }> = ({ gameId }) => {
  if (gameId === 'uno') {
    return (
      <div className="relative h-28 flex items-center justify-center select-none">
        <div className="w-16 h-24 rounded-xl bg-[#9E352B] border-2 border-[#FAF7F0] shadow-lg -rotate-12 -translate-x-4 flex items-center justify-center transition-transform duration-300 group-hover:-rotate-[16deg] group-hover:-translate-x-5">
          <span className="font-display font-black text-lg text-[#FAF7F0]">7</span>
        </div>
        <div className="w-16 h-24 rounded-xl bg-[#28577A] border-2 border-[#FAF7F0] shadow-lg rotate-6 translate-x-3 flex items-center justify-center transition-transform duration-300 group-hover:rotate-12 group-hover:translate-x-5">
          <span className="font-display font-black text-lg text-[#FAF7F0]">+2</span>
        </div>
      </div>
    );
  }
  if (gameId === 'satyo') {
    return (
      <div className="relative h-28 flex items-center justify-center select-none">
        <div className="w-16 h-24 rounded-xl bg-[#FAF7F0] border border-[#D9CEB8] shadow-lg -rotate-6 -translate-x-3 flex flex-col justify-between p-1.5 text-[#9F2929] transition-transform duration-300 group-hover:-rotate-12">
          <span className="font-mono-nums font-bold text-xs leading-none">7♥</span>
          <span className="self-center text-xl leading-none">♥</span>
          <span className="font-mono-nums font-bold text-xs leading-none self-end rotate-180">7♥</span>
        </div>
        <div className="w-16 h-24 rounded-xl bg-[#FAF7F0] border border-[#D9CEB8] shadow-lg rotate-6 translate-x-3 flex flex-col justify-between p-1.5 text-[#1E2220] transition-transform duration-300 group-hover:rotate-12">
          <span className="font-mono-nums font-bold text-xs leading-none">8♠</span>
          <span className="self-center text-xl leading-none">♠</span>
          <span className="font-mono-nums font-bold text-xs leading-none self-end rotate-180">8♠</span>
        </div>
      </div>
    );
  }
  if (gameId === 'mongoose') {
    return (
      <div className="relative h-28 flex items-center justify-center select-none">
        <div className="w-16 h-24 rounded-xl bg-[#1B3A2B] border border-[#C5A059]/60 shadow-md -translate-y-1 translate-x-2 rotate-6" />
        <div className="w-16 h-24 rounded-xl bg-[#FAF7F0] border border-[#C5A059] shadow-xl -rotate-3 -translate-x-2 flex flex-col justify-between p-1.5 text-[#9F2929] transition-transform duration-300 group-hover:-translate-y-1.5">
          <span className="font-mono-nums font-bold text-xs leading-none">K♦</span>
          <span className="self-center text-2xl leading-none">♦</span>
          <span className="font-mono-nums font-bold text-xs leading-none self-end rotate-180">K♦</span>
        </div>
      </div>
    );
  }
  // gadha_chor
  return (
    <div className="relative h-28 flex items-center justify-center select-none">
      <div className="w-16 h-24 rounded-xl bg-[#1B3A2B] border border-[#C5A059]/50 shadow-lg -rotate-12 -translate-x-4 flex items-center justify-center text-[#C5A059] text-sm transition-transform duration-300 group-hover:-rotate-[15deg]">
        ✦
      </div>
      <div className="w-16 h-24 rounded-xl bg-[#FAF7F0] border border-[#D9CEB8] shadow-xl rotate-6 translate-x-3 flex flex-col justify-between p-1.5 text-[#1E2220] transition-transform duration-300 group-hover:rotate-12 group-hover:-translate-y-1">
        <span className="font-mono-nums font-bold text-xs leading-none">Q♠</span>
        <span className="self-center text-2xl leading-none">♠</span>
        <span className="font-mono-nums font-bold text-xs leading-none self-end rotate-180">Q♠</span>
      </div>
    </div>
  );
};

export const PlayingCardsMenuScreen: React.FC<PlayingCardsMenuScreenProps> = ({
  lang,
  playerName,
  initialJoinCode = '',
  authReady,
  authUser,
  signingIn,
  onSignIn,
  onCreateRoom,
  onJoinRoom,
  onBack,
  rejoinRoom,
  onRejoin,
  onDismissRejoin,
  errorMsg,
  loadingAction,
}) => {
  const [joinCode, setJoinCode] = useState(initialJoinCode);
  const [rulesModalGame, setRulesModalGame] = useState<CardGameId | null>(null);
  const [creatingGame, setCreatingGame] = useState<CardGameId | null>(null);

  const firestoreEnabled = isFirestoreConfigured();
  const needsAuth = firestoreEnabled && !authUser;

  const handlePlayGame = async (gameId: CardGameId) => {
    setCreatingGame(gameId);
    try {
      await onCreateRoom(gameId);
    } finally {
      setCreatingGame(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8 space-y-6 text-[#FAF7F0]">
      {/* Lounge Header */}
      <div className="rounded-3xl bg-[#173326] border border-[#3B281E] shadow-2xl p-6 sm:p-8 relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-3 rounded-2xl border border-[#C5A059]/15"
        />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2.5 max-w-2xl">
            <button
              type="button"
              onClick={onBack}
              className="min-h-[38px] px-3 rounded-xl bg-[#12261C] hover:bg-[#1C3A2B] border border-[#C5A059]/25 text-xs font-semibold text-[#E6D7B7] inline-flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{t(lang, 'backToHub')}</span>
            </button>

            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[#12261C] border border-[#C5A059]/40 flex items-center justify-center shrink-0">
                <Spade className="w-5 h-5 text-[#C5A059]" />
              </div>
              <div>
                <h1 className="font-display text-2xl sm:text-4xl font-extrabold tracking-tight text-[#FAF7F0]">
                  {t(lang, 'pcTitle')}
                </h1>
                <p className="text-sm sm:text-base text-[#D9CEB8]">{t(lang, 'pcSubtitle')}</p>
              </div>
            </div>
          </div>

          {/* Join by Room Code */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onJoinRoom(joinCode);
            }}
            className="w-full lg:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 bg-[#12261C]/90 border border-[#C5A059]/25 rounded-2xl p-2.5"
          >
            <input
              type="text"
              maxLength={5}
              value={joinCode}
              onChange={(e) =>
                setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5))
              }
              placeholder={t(lang, 'pcJoinPlaceholder')}
              aria-label="Room code"
              className="h-11 sm:w-40 px-3.5 rounded-xl bg-[#0E1B14] border border-[#324D3E] text-center font-mono-nums text-base font-bold tracking-[0.2em] text-[#FAF7F0] placeholder:text-[#7E9286] placeholder:tracking-normal placeholder:font-sans placeholder:text-xs focus:outline-none focus:border-[#C5A059]"
            />
            <button
              type="submit"
              disabled={Boolean(loadingAction) || needsAuth || joinCode.trim().length !== 5}
              className="min-h-[44px] px-5 rounded-xl bg-[#C5A059] hover:bg-[#D2AE69] disabled:opacity-45 text-[#141816] font-display font-bold text-sm whitespace-nowrap transition-colors"
            >
              {loadingAction === 'join' ? 'Joining...' : t(lang, 'pcJoinRoom')}
            </button>
          </form>
        </div>

        {needsAuth && authReady && (
          <div className="relative z-10 mt-5 pt-4 border-t border-[#FAF7F0]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs sm:text-sm text-[#E6D7B7]">{t(lang, 'signInRequired')}</p>
            <button
              type="button"
              disabled={signingIn}
              onClick={onSignIn}
              className="min-h-[44px] px-5 rounded-xl bg-[#FAF7F0] hover:bg-[#EFE8DA] text-[#141816] font-display font-bold text-sm inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
            >
              <LogIn className="w-4 h-4" />
              <span>{signingIn ? t(lang, 'signingIn') : t(lang, 'signInWithGoogle')}</span>
            </button>
          </div>
        )}

        {!needsAuth && (
          <p className="relative z-10 mt-4 text-xs text-[#B6C5BC]">
            Playing as <strong className="text-[#FAF7F0]">{playerName.trim() || authUser?.displayName || 'Player'}</strong> · Create any table below to invite friends into one shared card room.
          </p>
        )}
      </div>

      {/* Rejoin Active Table Banner */}
      {rejoinRoom && (
        <div className="rounded-2xl bg-[#2A3B2B] border border-[#C5A059]/60 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="font-display font-bold text-sm text-[#FAF7F0]">
              {t(lang, 'pcRejoinTitle')} · {CARD_GAMES_INFO[rejoinRoom.selectedGame].name} ({rejoinRoom.code})
            </p>
            <p className="text-xs text-[#D9CEB8] mt-0.5">
              {Object.keys(rejoinRoom.players).length} players seated · Phase: {rejoinRoom.phase}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onDismissRejoin}
              className="min-h-[40px] px-3.5 rounded-xl border border-[#D9CEB8]/30 text-xs font-semibold text-[#D9CEB8] hover:bg-black/20"
            >
              {t(lang, 'gtaDismissRejoin')}
            </button>
            <button
              type="button"
              disabled={Boolean(loadingAction)}
              onClick={() => onRejoin(rejoinRoom.code)}
              className="min-h-[40px] px-4 rounded-xl bg-[#C5A059] hover:bg-[#D2AE69] text-[#141816] font-display font-bold text-xs flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t(lang, 'pcRejoinBtn')}</span>
            </button>
          </div>
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="px-4 py-3 rounded-2xl bg-[#4E221F]/80 border border-[#9E352B] text-sm font-medium text-[#F5D6D2]"
        >
          {errorMsg}
        </div>
      )}

      {/* Four Card Game Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {CARD_GAME_ORDER.map((gid) => {
          const info = CARD_GAMES_INFO[gid];
          const isBusy = loadingAction === 'create' && creatingGame === gid;
          return (
            <article
              key={gid}
              className="group rounded-3xl bg-[#FAF7F0] text-[#1A1D1B] border border-[#D9CEB8] shadow-xl p-6 flex flex-col justify-between gap-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#C5A059]"
            >
              <div className="space-y-4">
                <div className="rounded-2xl bg-[#173326] border border-[#3B281E] py-4 px-4 flex items-center justify-between gap-4 overflow-hidden">
                  <div className="space-y-1">
                    <span className="text-[11px] font-mono-nums uppercase tracking-widest text-[#C5A059]">
                      {info.deckType}
                    </span>
                    <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-[#FAF7F0] tracking-tight">
                      {info.name}
                    </h2>
                    <p className="text-xs text-[#C9BEA8] flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-[#C5A059]" />
                      <span>{info.playersLabel}</span>
                    </p>
                  </div>
                  <TileCardVisual gameId={gid} />
                </div>

                <div>
                  <p className="text-sm text-[#3E3931] leading-relaxed">{info.description}</p>
                  <p className="text-xs text-[#6B6153] mt-2 font-medium">{info.tagline}</p>
                </div>
              </div>

              <div className="pt-4 border-t border-[#E5DCCB] flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setRulesModalGame(gid)}
                  className="min-h-[46px] px-4 rounded-xl border border-[#C8BBA4] bg-[#F2ECE0] hover:bg-[#E7DEC9] text-[#3B281E] font-semibold text-sm flex items-center gap-2 transition-colors"
                >
                  <BookOpen className="w-4 h-4 text-[#6D5A3D]" />
                  <span>{t(lang, 'pcRules')}</span>
                </button>

                <button
                  type="button"
                  disabled={Boolean(loadingAction) || needsAuth}
                  onClick={() => handlePlayGame(gid)}
                  className="min-h-[46px] px-6 rounded-xl bg-[#173326] hover:bg-[#1E4231] disabled:opacity-45 text-[#FAF7F0] font-display font-bold text-sm flex items-center gap-2 transition-all active:scale-[0.98]"
                >
                  <Play className="w-4 h-4 text-[#C5A059]" />
                  <span>{isBusy ? 'Opening Table...' : t(lang, 'pcPlay')}</span>
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <CardRulesModal
        gameId={rulesModalGame}
        onClose={() => setRulesModalGame(null)}
        onPlayGame={!needsAuth ? handlePlayGame : undefined}
      />
    </div>
  );
};
