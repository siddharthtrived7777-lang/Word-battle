import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  HelpCircle,
  LogIn,
  Plus,
  RotateCcw,
  Users,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { Language } from '../types/game';
import { AnimalRoomState } from '../types/animalGame';
import { t } from '../data/i18n';
import { isFirestoreConfigured } from '../firebase';
import { HowToPlayAnimalModal } from '../components/HowToPlayAnimalModal';

interface GuessAnimalMenuScreenProps {
  lang: Language;
  playerName: string;
  authReady: boolean;
  authUser: User | null;
  signingIn: boolean;
  onSignIn: () => Promise<void>;
  onCreateRoom: () => Promise<void>;
  onJoinRoom: (code: string) => Promise<void>;
  onBack: () => void;
  rejoinRoom: AnimalRoomState | null;
  onRejoin: (code: string) => Promise<void>;
  onDismissRejoin: () => void;
  errorMsg: string | null;
  loadingAction: 'create' | 'join' | 'rejoin' | null;
}

export const GuessAnimalMenuScreen: React.FC<GuessAnimalMenuScreenProps> = ({
  lang,
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
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [showFriendPanel, setShowFriendPanel] = useState(false);
  const [joinCode, setJoinCode] = useState('');

  const firestoreEnabled = isFirestoreConfigured();
  const needsAuth = firestoreEnabled && !authUser;

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onJoinRoom(joinCode);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10">
      <div className="bg-[#FFFDF7] text-slate-900 border-2 border-amber-200 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
        {/* Top Navigation Back */}
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="min-h-[44px] px-4 rounded-2xl bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold text-sm flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t(lang, 'gtaBack')}</span>
          </button>

          <span className="text-xs font-semibold text-slate-500">
            {t(lang, 'gtaCardBadge')}
          </span>
        </div>

        {/* Title & Required Description */}
        <div className="text-center space-y-3 py-2">
          <div className="inline-flex items-center justify-center gap-2 text-4xl sm:text-5xl select-none">
            <span>🦁</span>
            <span>🐙</span>
            <span>🦒</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight text-balance">
            {t(lang, 'gtaTitle')}
          </h1>
          <p className="text-sm sm:text-base text-slate-600 max-w-lg mx-auto leading-relaxed">
            {t(lang, 'gtaDesc')}
          </p>
        </div>

        {/* Disconnect Rejoin Banner */}
        {rejoinRoom && !needsAuth && (
          <div className="p-4 rounded-2xl bg-sky-50 border-2 border-sky-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-sky-950">{t(lang, 'gtaRejoinTitle')}</p>
              <p className="text-xs text-sky-800 mt-0.5 font-mono-nums">
                {t(lang, 'roomCode')}: {rejoinRoom.code}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onDismissRejoin}
                className="min-h-[44px] px-3 rounded-xl bg-white border border-sky-200 hover:bg-sky-100 text-xs font-semibold text-sky-900 transition-colors"
              >
                {t(lang, 'gtaDismissRejoin')}
              </button>
              <button
                type="button"
                disabled={loadingAction !== null}
                onClick={() => onRejoin(rejoinRoom.code)}
                className="min-h-[44px] px-4 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white text-sm font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{t(lang, 'gtaRejoinBtn')}</span>
              </button>
            </div>
          </div>
        )}

        {errorMsg && (
          <div
            role="alert"
            className="px-4 py-3 rounded-2xl bg-rose-50 border border-rose-300 text-rose-800 text-sm font-semibold"
          >
            {errorMsg}
          </div>
        )}

        {/* Primary Menu Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setShowFriendPanel(true)}
            className="min-h-[56px] px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-display font-bold text-base flex items-center justify-center gap-2.5 shadow-md transition-all active:scale-[0.98]"
          >
            <Users className="w-5 h-5" />
            <span>{t(lang, 'gtaPlayWithFriend')}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowHowToPlay(true)}
            className="min-h-[56px] px-6 rounded-2xl bg-amber-100 hover:bg-amber-200 text-amber-950 border-2 border-amber-300 font-display font-bold text-base flex items-center justify-center gap-2.5 transition-all active:scale-[0.98]"
          >
            <HelpCircle className="w-5 h-5" />
            <span>{t(lang, 'howToPlay')}</span>
          </button>
        </div>

        {/* Play with Friend Panel (Create Room / Join 5-letter code) */}
        {showFriendPanel && (
          <div className="pt-4 border-t-2 border-amber-100 space-y-4">
            {needsAuth ? (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-center space-y-3">
                <p className="text-xs font-medium text-amber-950">
                  {t(lang, 'signInRequired')}
                </p>
                <button
                  type="button"
                  disabled={!authReady || signingIn}
                  onClick={onSignIn}
                  className="w-full min-h-[50px] px-6 rounded-2xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-display font-bold text-sm flex items-center justify-center gap-2 transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  <span>{signingIn ? t(lang, 'signingIn') : t(lang, 'signInWithGoogle')}</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
                {/* Create 2-player room */}
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col justify-between gap-3">
                  <div>
                    <h2 className="font-display font-bold text-base text-emerald-950">
                      {t(lang, 'gtaCreateRoom')}
                    </h2>
                    <p className="text-xs text-emerald-800 mt-1">
                      {lang === 'hi'
                        ? '5-अक्षर का कोड पाएँ और अपने दोस्त को भेजें।'
                        : 'Get a 5-letter code and share it with one friend.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={loadingAction !== null}
                    onClick={onCreateRoom}
                    className="w-full min-h-[48px] px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-display font-bold text-sm flex items-center justify-center gap-2 transition-colors"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    <span>{t(lang, 'createRoom')}</span>
                  </button>
                </div>

                {/* Join with 5-letter code */}
                <form
                  onSubmit={handleJoinSubmit}
                  className="p-4 rounded-2xl bg-sky-50 border border-sky-200 flex flex-col justify-between gap-3"
                >
                  <div>
                    <label
                      htmlFor="gta-room-code"
                      className="block font-display font-bold text-base text-sky-950"
                    >
                      {t(lang, 'gtaJoinRoom')}
                    </label>
                    <input
                      id="gta-room-code"
                      type="text"
                      maxLength={5}
                      value={joinCode}
                      onChange={(e) =>
                        setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
                      }
                      placeholder={t(lang, 'gtaRoomCodePlaceholder')}
                      className="mt-2 w-full h-12 px-3 rounded-xl bg-white border-2 border-sky-200 font-mono-nums text-lg font-bold tracking-[0.2em] text-center uppercase text-slate-900 placeholder:text-slate-400 placeholder:tracking-normal placeholder:font-sans placeholder:text-xs focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loadingAction !== null}
                    className="w-full min-h-[48px] px-5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white font-display font-bold text-sm flex items-center justify-center gap-2 transition-colors"
                  >
                    <span>{t(lang, 'gtaJoinBtn')}</span>
                    <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
      </div>

      <HowToPlayAnimalModal
        open={showHowToPlay}
        lang={lang}
        onClose={() => setShowHowToPlay(false)}
      />
    </div>
  );
};
