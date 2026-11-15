import React, { useState } from 'react';
import {
  Check,
  Eye,
  EyeOff,
  HelpCircle,
  LogOut,
  Mic,
  MicOff,
  RotateCcw,
  SkipForward,
  Sparkles,
  Target,
  Trophy,
  X,
} from 'lucide-react';
import { Language } from '../types/game';
import {
  AnimalDef,
  AnimalRoomState,
  AnimalTraitOption,
  QuestionCategoryId,
} from '../types/animalGame';
import { ANIMALS, ANIMALS_BY_ID, QUESTION_CATEGORIES } from '../data/animals';
import { formatTraitQuestion, t } from '../data/i18n';
import { AnimalArtwork, AnimalCard } from '../components/AnimalCard';
import { Avatar } from '../components/Avatar';
import { MicPermissionState } from '../hooks/useVoiceChat';

interface GuessAnimalGameScreenProps {
  lang: Language;
  room: AnimalRoomState;
  myId: string;
  mySecretAnimalId: string | null;
  flippedIds: string[];
  onToggleFlip: (animalId: string) => void;
  onLockSecret: (animalId: string) => Promise<void>;
  onAskQuestion: (category: QuestionCategoryId, option: AnimalTraitOption) => Promise<void>;
  onEndTurn: () => Promise<void>;
  onSubmitGuess: (animalId: string) => Promise<void>;
  onPlayAgain: () => Promise<void>;
  onExit: () => Promise<void>;
  voiceEnabled: boolean;
  micStatus: MicPermissionState;
  isMuted: boolean;
  speakingIds: Record<string, boolean>;
  onToggleVoice: () => void;
  onToggleMute: () => void;
}

export const GuessAnimalGameScreen: React.FC<GuessAnimalGameScreenProps> = ({
  lang,
  room,
  myId,
  mySecretAnimalId,
  flippedIds,
  onToggleFlip,
  onLockSecret,
  onAskQuestion,
  onEndTurn,
  onSubmitGuess,
  onPlayAgain,
  onExit,
  voiceEnabled,
  micStatus,
  isMuted,
  speakingIds,
  onToggleVoice,
  onToggleMute,
}) => {
  const [selectedPickId, setSelectedPickId] = useState<string | null>(null);
  const [submittingPick, setSubmittingPick] = useState(false);

  const [activeCategory, setActiveCategory] = useState<QuestionCategoryId | null>(null);
  const [guessMode, setGuessMode] = useState(false);
  const [pendingGuessAnimal, setPendingGuessAnimal] = useState<AnimalDef | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [hideSecret, setHideSecret] = useState(false);
  const [busyAction, setBusyAction] = useState(false);

  const opponentId = room.playerIds.find((id) => id !== myId) ?? '';
  const me = room.players[myId];
  const opponent = opponentId ? room.players[opponentId] : undefined;

  const isMyTurn = room.phase === 'playing' && room.turnUid === myId;
  const waitingForResolution = Boolean(room.pendingQuestion || room.pendingGuess);
  const remainingCount = ANIMALS.length - flippedIds.length;
  const mySecretAnimal = mySecretAnimalId ? ANIMALS_BY_ID[mySecretAnimalId] : null;
  const latestHistory = room.history.length > 0 ? room.history[room.history.length - 1] : null;

  const handleConfirmPick = async () => {
    if (!selectedPickId || submittingPick) return;
    setSubmittingPick(true);
    try {
      await onLockSecret(selectedPickId);
      setSelectedPickId(null);
    } finally {
      setSubmittingPick(false);
    }
  };

  const handleSelectOption = async (category: QuestionCategoryId, option: AnimalTraitOption) => {
    if (!isMyTurn || waitingForResolution || busyAction) return;
    setBusyAction(true);
    setActiveCategory(null);
    try {
      await onAskQuestion(category, option);
    } finally {
      setBusyAction(false);
    }
  };

  const handleCardClick = (animal: AnimalDef) => {
    if (room.phase === 'picking') {
      if (!me?.pickedSecret) {
        setSelectedPickId(animal.id);
      }
      return;
    }

    if (room.phase === 'playing') {
      if (guessMode && isMyTurn && !waitingForResolution) {
        setPendingGuessAnimal(animal);
        return;
      }
      onToggleFlip(animal.id);
    }
  };

  const handleConfirmGuess = async () => {
    if (!pendingGuessAnimal || busyAction) return;
    setBusyAction(true);
    try {
      await onSubmitGuess(pendingGuessAnimal.id);
      setPendingGuessAnimal(null);
      setGuessMode(false);
    } finally {
      setBusyAction(false);
    }
  };

  const handleEndTurnClick = async () => {
    if (!isMyTurn || waitingForResolution || busyAction) return;
    setBusyAction(true);
    setGuessMode(false);
    try {
      await onEndTurn();
    } finally {
      setBusyAction(false);
    }
  };

  const activeCategoryConfig = activeCategory
    ? QUESTION_CATEGORIES.find((c) => c.id === activeCategory) ?? null
    : null;

  // Finished Win/Lose View
  if (room.phase === 'finished') {
    const didIWin = room.winnerUid === myId;
    const myRevealedId = room.revealedAnimals[myId] || mySecretAnimalId;
    const oppRevealedId = opponentId ? room.revealedAnimals[opponentId] : undefined;
    const myRevealedAnimal = myRevealedId ? ANIMALS_BY_ID[myRevealedId] : null;
    const oppRevealedAnimal = oppRevealedId ? ANIMALS_BY_ID[oppRevealedId] : null;

    return (
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10">
        <div className="bg-[#FFFDF7] text-slate-900 border-2 border-amber-200 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6 text-center">
          <div
            className={`w-20 h-20 mx-auto rounded-3xl flex items-center justify-center border-2 ${
              didIWin
                ? 'bg-emerald-100 border-emerald-300 text-emerald-700'
                : 'bg-rose-100 border-rose-300 text-rose-700'
            }`}
          >
            <Trophy className="w-10 h-10" />
          </div>

          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-slate-900">
              {didIWin ? t(lang, 'gtaYouWon') : t(lang, 'gtaYouLost')}
            </h1>
            <p className="text-sm sm:text-base text-slate-600 mt-1.5">
              {didIWin ? t(lang, 'gtaWonSub') : t(lang, 'gtaLostSub')}
            </p>
          </div>

          {/* Side-by-side Secret Reveal */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
            <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-200 flex items-center gap-3.5">
              <div className="w-16 h-16 rounded-2xl bg-white border border-emerald-200 flex items-center justify-center shrink-0">
                {myRevealedAnimal ? <AnimalArtwork animal={myRevealedAnimal} size="md" /> : <span>❓</span>}
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-emerald-800 block">
                  {t(lang, 'gtaYourAnimalWas')}
                </span>
                <p className="font-display text-lg font-extrabold text-slate-900 truncate">
                  {myRevealedAnimal ? myRevealedAnimal.name[lang] : '...'}
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-200 flex items-center gap-3.5">
              <div className="w-16 h-16 rounded-2xl bg-white border border-amber-200 flex items-center justify-center shrink-0">
                {oppRevealedAnimal ? <AnimalArtwork animal={oppRevealedAnimal} size="md" /> : <span>❓</span>}
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-amber-800 block">
                  {t(lang, 'gtaOpponentAnimalWas')}
                </span>
                <p className="font-display text-lg font-extrabold text-slate-900 truncate">
                  {oppRevealedAnimal ? oppRevealedAnimal.name[lang] : '...'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={onPlayAgain}
              className="flex-1 min-h-[54px] px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-display font-bold text-base flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98]"
            >
              <RotateCcw className="w-5 h-5" />
              <span>{t(lang, 'gtaPlayAgain')}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowExitConfirm(true)}
              className="min-h-[54px] px-6 rounded-2xl bg-slate-200 hover:bg-slate-300 text-slate-900 font-display font-bold text-base flex items-center justify-center gap-2 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>{t(lang, 'gtaExitBtn')}</span>
            </button>
          </div>
        </div>

        {/* Exit Confirm Modal */}
        {showExitConfirm && (
          <ExitConfirmModal
            lang={lang}
            onCancel={() => setShowExitConfirm(false)}
            onConfirm={onExit}
          />
        )}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-2.5 sm:px-4 py-4 sm:py-6 space-y-3.5">
      {/* Top Status & Controls Bar */}
      <div className="bg-[#FFFDF7] text-slate-900 border-2 border-amber-200 rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-sm flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          {me && (
            <Avatar
              name={me.name}
              avatar={me.avatar}
              size="sm"
              isSpeaking={Boolean(speakingIds[me.id])}
            />
          )}
          <div className="min-w-0">
            {room.phase === 'picking' ? (
              <p className="font-display font-extrabold text-sm sm:text-base text-slate-900 truncate">
                {me?.pickedSecret ? t(lang, 'gtaWaitingOpponentPick') : t(lang, 'gtaPickTitle')}
              </p>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`inline-flex items-center gap-1.5 text-sm sm:text-base font-display font-extrabold ${
                    isMyTurn ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <span>{isMyTurn ? t(lang, 'gtaYourTurn') : t(lang, 'gtaOpponentTurn')}</span>
                </span>
                <span className="text-xs font-bold text-slate-500 font-mono-nums">
                  · {remainingCount}/30 {t(lang, 'gtaRemaining')}
                </span>
              </div>
            )}
            {opponent && (
              <p className="text-[11px] font-medium text-slate-500 truncate">
                vs {opponent.name}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Optional Voice Controls */}
          {voiceEnabled && micStatus === 'granted' && (
            <button
              type="button"
              onClick={onToggleMute}
              className={`min-h-[40px] px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors ${
                isMuted
                  ? 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                  : 'bg-emerald-600 text-white hover:bg-emerald-500'
              }`}
            >
              {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{isMuted ? t(lang, 'micMuted') : t(lang, 'micOn')}</span>
            </button>
          )}
          <button
            type="button"
            onClick={onToggleVoice}
            className="min-h-[40px] px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5 transition-colors"
            title={t(lang, 'gtaVoiceOptionalHint')}
          >
            {voiceEnabled ? <Mic className="w-3.5 h-3.5 text-emerald-600" /> : <MicOff className="w-3.5 h-3.5 text-slate-500" />}
            <span className="hidden sm:inline">
              {voiceEnabled ? t(lang, 'gtaVoiceOff') : t(lang, 'gtaEnableVoice')}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowExitConfirm(true)}
            className="min-h-[40px] px-3.5 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-900 text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{t(lang, 'gtaExitBtn')}</span>
          </button>
        </div>
      </div>

      {/* Secret Animal Reminder + Latest Q&A Strip (Playing Phase) */}
      {room.phase === 'playing' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Your Secret Animal Card */}
          <div className="md:col-span-4 bg-[#FFFDF7] text-slate-900 border-2 border-emerald-200 rounded-2xl p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                {hideSecret ? (
                  <span className="text-xl">🙈</span>
                ) : mySecretAnimal ? (
                  <AnimalArtwork animal={mySecretAnimal} size="sm" />
                ) : (
                  <span>❓</span>
                )}
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-bold text-emerald-800 block">
                  {t(lang, 'gtaYourSecret')}
                </span>
                <p className="font-display font-extrabold text-sm text-slate-900 truncate">
                  {hideSecret ? '••••••' : mySecretAnimal ? mySecretAnimal.name[lang] : '...'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setHideSecret((v) => !v)}
              className="min-h-[40px] min-w-[40px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center shrink-0"
              aria-label={hideSecret ? 'Show secret animal' : 'Hide secret animal'}
            >
              {hideSecret ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
          </div>

          {/* Latest Q&A Banner */}
          <div className="md:col-span-8 bg-[#FFFDF7] text-slate-900 border-2 border-sky-200 rounded-2xl p-3 flex items-center justify-between gap-3">
            {room.pendingQuestion ? (
              <div className="text-sm font-semibold text-sky-900">
                {formatTraitQuestion(
                  lang,
                  room.pendingQuestion.category,
                  room.pendingQuestion.option
                )}{' '}
                <span className="text-sky-600">...</span>
              </div>
            ) : latestHistory ? (
              <div className="flex items-center justify-between gap-3 w-full">
                <div className="min-w-0">
                  <span className="text-[11px] font-bold text-slate-500 block">
                    {latestHistory.byUid === myId
                      ? t(lang, 'gtaYouAsked')
                      : t(lang, 'gtaOpponentAsked')}
                  </span>
                  <p className="text-sm font-bold text-slate-900 truncate">
                    {latestHistory.kind === 'question' &&
                    latestHistory.category &&
                    latestHistory.option
                      ? formatTraitQuestion(lang, latestHistory.category, latestHistory.option)
                      : `${t(lang, 'gtaGuessedLabel')}: ${
                          latestHistory.animalId
                            ? ANIMALS_BY_ID[latestHistory.animalId]?.name[lang] ?? latestHistory.animalId
                            : ''
                        }`}
                  </p>
                </div>
                <span
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap shrink-0 ${
                    latestHistory.answer
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-rose-100 text-rose-800 border border-rose-300'
                  }`}
                >
                  {latestHistory.answer ? t(lang, 'gtaYes') : t(lang, 'gtaNo')}
                </span>
              </div>
            ) : (
              <p className="text-xs sm:text-sm font-medium text-slate-500">
                {t(lang, 'gtaNoHistory')}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Secret Picking Confirm Banner */}
      {room.phase === 'picking' && !me?.pickedSecret && (
        <div className="bg-amber-50 text-slate-900 border-2 border-amber-300 rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-center sm:text-left">
            <p className="text-sm font-bold text-slate-900">
              {selectedPickId
                ? `${t(lang, 'gtaSelectedLabel')}: ${ANIMALS_BY_ID[selectedPickId]?.name[lang]}`
                : t(lang, 'gtaPickSub')}
            </p>
          </div>
          <button
            type="button"
            disabled={!selectedPickId || submittingPick}
            onClick={handleConfirmPick}
            className="w-full sm:w-auto min-h-[46px] px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 disabled:text-slate-500 text-white font-display font-bold text-sm flex items-center justify-center gap-2 whitespace-nowrap shrink-0 transition-colors"
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
            <span>{t(lang, 'gtaConfirmPick')}</span>
          </button>
        </div>
      )}

      {/* Guess Mode Instruction Banner */}
      {guessMode && isMyTurn && (
        <div className="bg-rose-50 border-2 border-rose-400 text-rose-950 rounded-2xl px-4 py-2.5 flex items-center justify-between gap-3">
          <span className="text-sm font-bold">{t(lang, 'gtaGuessModeHint')}</span>
          <button
            type="button"
            onClick={() => setGuessMode(false)}
            className="min-h-[38px] px-3 rounded-xl bg-white border border-rose-300 text-xs font-bold text-rose-900 hover:bg-rose-100"
          >
            {t(lang, 'gtaCancelGuess')}
          </button>
        </div>
      )}

      {/* 5 x 6 Grid of 30 Animal Cards */}
      <div className="bg-[#FFFDF7] border-2 border-amber-200 rounded-2xl sm:rounded-3xl p-2 sm:p-3.5 shadow-sm">
        <div className="grid grid-cols-5 gap-1.5 sm:gap-2.5">
          {ANIMALS.map((animal) => (
            <AnimalCard
              key={animal.id}
              animal={animal}
              lang={lang}
              flipped={room.phase === 'playing' && flippedIds.includes(animal.id)}
              selected={room.phase === 'picking' && selectedPickId === animal.id}
              isSecret={room.phase === 'playing' && mySecretAnimalId === animal.id}
              guessMode={guessMode && isMyTurn && !flippedIds.includes(animal.id)}
              onClick={() => handleCardClick(animal)}
            />
          ))}
        </div>
        {room.phase === 'playing' && !guessMode && (
          <p className="text-[11px] font-medium text-slate-500 text-center mt-2">
            {t(lang, 'gtaTapToFlipHint')}
          </p>
        )}
      </div>

      {/* 6 Question Category Buttons + End Turn + Make Guess (Playing Phase) */}
      {room.phase === 'playing' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          <div className="lg:col-span-8 bg-[#FFFDF7] text-slate-900 border-2 border-amber-200 rounded-2xl p-3.5 sm:p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display font-bold text-sm text-slate-800 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-amber-600" />
                <span>{t(lang, 'gtaAskHeading')}</span>
              </h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {QUESTION_CATEGORIES.map((cat) => {
                const alreadyAsked = room.askedCategoriesThisTurn.includes(cat.id);
                const disabled = !isMyTurn || alreadyAsked || waitingForResolution || busyAction;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`min-h-[48px] px-3 rounded-xl font-display font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all active:scale-[0.97] ${
                      alreadyAsked
                        ? 'bg-emerald-50 border border-emerald-200 text-emerald-700 opacity-75'
                        : disabled
                          ? 'bg-slate-100 border border-slate-200 text-slate-400'
                          : 'bg-sky-50 hover:bg-sky-100 border-2 border-sky-200 text-sky-950 shadow-xs'
                    }`}
                  >
                    {alreadyAsked && <Check className="w-3.5 h-3.5 shrink-0" />}
                    <span className="truncate">{t(lang, `cat_${cat.id}`)}</span>
                  </button>
                );
              })}
            </div>

            {/* Turn Controls: Make a Guess + End Turn */}
            <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                disabled={!isMyTurn || waitingForResolution || busyAction}
                onClick={() => setGuessMode((v) => !v)}
                className={`flex-1 min-h-[48px] px-4 rounded-xl font-display font-bold text-sm flex items-center justify-center gap-2 transition-colors ${
                  guessMode
                    ? 'bg-rose-600 text-white hover:bg-rose-500'
                    : 'bg-rose-500 hover:bg-rose-400 disabled:bg-slate-200 disabled:text-slate-400 text-white'
                }`}
              >
                <Target className="w-4 h-4" />
                <span>{guessMode ? t(lang, 'gtaCancelGuess') : t(lang, 'gtaMakeGuess')}</span>
              </button>

              <button
                type="button"
                disabled={!isMyTurn || waitingForResolution || busyAction}
                onClick={handleEndTurnClick}
                className="flex-1 min-h-[48px] px-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-slate-200 disabled:text-slate-400 text-slate-950 font-display font-bold text-sm flex items-center justify-center gap-2 transition-colors"
              >
                <SkipForward className="w-4 h-4" />
                <span>{t(lang, 'gtaEndTurn')}</span>
              </button>
            </div>
          </div>

          {/* Short Q&A History List */}
          <div className="lg:col-span-4 bg-[#FFFDF7] text-slate-900 border-2 border-amber-200 rounded-2xl p-3.5 sm:p-4 flex flex-col">
            <h2 className="font-display font-bold text-sm text-slate-800 mb-2.5">
              {t(lang, 'gtaHistoryTitle')}
            </h2>
            {room.history.length === 0 ? (
              <p className="text-xs text-slate-500 flex-1 flex items-center justify-center text-center py-4">
                {t(lang, 'gtaNoHistory')}
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {[...room.history].reverse().map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <span className="font-bold text-slate-500 block text-[10px]">
                        {item.byUid === myId ? t(lang, 'gtaYouAsked') : t(lang, 'gtaOpponentAsked')}
                      </span>
                      <span className="font-semibold text-slate-800 block truncate">
                        {item.kind === 'question' && item.category && item.option
                          ? formatTraitQuestion(lang, item.category, item.option)
                          : `${t(lang, 'gtaGuessedLabel')}: ${
                              item.animalId
                                ? ANIMALS_BY_ID[item.animalId]?.name[lang] ?? item.animalId
                                : ''
                            }`}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-lg font-extrabold shrink-0 ${
                        item.answer
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {item.answer ? t(lang, 'gtaYes') : t(lang, 'gtaNo')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Question Category Option Popup */}
      {activeCategoryConfig && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-white text-slate-900 rounded-3xl border-2 border-sky-200 shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-display text-lg font-extrabold text-slate-900">
                {t(lang, `cat_${activeCategoryConfig.id}`)}
              </h3>
              <button
                type="button"
                onClick={() => setActiveCategory(null)}
                className="min-h-[40px] min-w-[40px] rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700"
                aria-label={t(lang, 'gtaCancel')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 grid grid-cols-1 gap-2 max-h-[65vh] overflow-y-auto">
              {activeCategoryConfig.options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => handleSelectOption(activeCategoryConfig.id, opt)}
                  className="w-full min-h-[48px] px-4 py-2.5 rounded-2xl bg-sky-50 hover:bg-sky-100 border border-sky-200 text-left font-semibold text-sm text-slate-900 flex items-center justify-between gap-2 transition-colors"
                >
                  <span>{formatTraitQuestion(lang, activeCategoryConfig.id, opt)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Confirm Final Guess Modal */}
      {pendingGuessAnimal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm bg-white text-slate-900 rounded-3xl border-2 border-rose-200 p-6 shadow-2xl text-center space-y-4">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center">
              <AnimalArtwork animal={pendingGuessAnimal} size="lg" />
            </div>
            <div>
              <h3 className="font-display text-xl font-extrabold text-slate-900">
                {t(lang, 'gtaConfirmGuessTitle')}
              </h3>
              <p className="font-display text-lg font-bold text-rose-700 mt-1">
                {pendingGuessAnimal.name[lang]}
              </p>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                {t(lang, 'gtaConfirmGuessDesc')}
              </p>
            </div>
            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setPendingGuessAnimal(null)}
                className="flex-1 min-h-[48px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm"
              >
                {t(lang, 'gtaCancel')}
              </button>
              <button
                type="button"
                disabled={busyAction}
                onClick={handleConfirmGuess}
                className="flex-1 min-h-[48px] px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-display font-bold text-sm"
              >
                {t(lang, 'gtaConfirmGuessBtn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exit Confirmation Modal */}
      {showExitConfirm && (
        <ExitConfirmModal
          lang={lang}
          onCancel={() => setShowExitConfirm(false)}
          onConfirm={onExit}
        />
      )}
    </div>
  );
};

interface ExitConfirmModalProps {
  lang: Language;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

const ExitConfirmModal: React.FC<ExitConfirmModalProps> = ({
  lang,
  onCancel,
  onConfirm,
}) => (
  <div
    className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4"
    role="dialog"
    aria-modal="true"
  >
    <div className="w-full max-w-sm bg-white text-slate-900 rounded-3xl border-2 border-amber-200 p-6 shadow-2xl space-y-4">
      <h3 className="font-display text-xl font-extrabold text-slate-900">
        {t(lang, 'gtaExitTitle')}
      </h3>
      <p className="text-sm text-slate-600 leading-relaxed">{t(lang, 'gtaExitDesc')}</p>
      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 min-h-[48px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm"
        >
          {t(lang, 'gtaCancel')}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="flex-1 min-h-[48px] rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-display font-bold text-sm"
        >
          {t(lang, 'gtaExitConfirm')}
        </button>
      </div>
    </div>
  </div>
);
