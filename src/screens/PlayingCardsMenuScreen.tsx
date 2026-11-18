import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  LogIn,
  Play,
  RefreshCw,
  RotateCcw,
  Spade,
  Users,
  WifiOff,
  X,
} from 'lucide-react';
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
  onDismissError?: () => void;
  loadingAction: 'create' | 'join' | 'rejoin' | null;
}

type LastMenuAttempt =
  | { type: 'create'; gameId: CardGameId }
  | { type: 'join'; code: string }
  | { type: 'rejoin'; code: string }
  | null;

type ErrorCategory = 'offline' | 'auth' | 'room_not_found' | 'room_state' | 'quota' | 'connection';

interface ErrorDiagnosis {
  category: ErrorCategory;
  title: string;
  steps: string[];
  showSignIn: boolean;
  showRetry: boolean;
}

function diagnoseConnectionError(
  errorMsg: string,
  lang: Language,
  isOnline: boolean,
  needsAuth: boolean,
  hasLastAttempt: boolean
): ErrorDiagnosis {
  const lower = errorMsg.toLowerCase();
  const isHi = lang === 'hi';

  const isOfflineErr =
    !isOnline ||
    lower.includes('offline') ||
    lower.includes('unavailable') ||
    lower.includes('network') ||
    lower.includes('failed to fetch') ||
    lower.includes('timeout') ||
    lower.includes('नेटवर्क') ||
    lower.includes('ऑफ़लाइन');

  const isAuthErr =
    needsAuth ||
    lower.includes('sign in') ||
    lower.includes('auth') ||
    lower.includes('permission') ||
    lower.includes('unauthenticated') ||
    lower.includes('verified') ||
    lower.includes('साइन इन') ||
    lower.includes('अनुमति');

  const isRoomNotFound =
    lower.includes('not found') ||
    lower.includes('room_not_found') ||
    lower.includes('5-character') ||
    lower.includes('नहीं मिला') ||
    lower.includes('5-अक्षर');

  const isRoomState =
    lower.includes('already') ||
    lower.includes('room_full') ||
    lower.includes('room_unavailable') ||
    lower.includes('game_in_progress') ||
    lower.includes('in progress') ||
    lower.includes('at least 2') ||
    lower.includes('up to 6') ||
    lower.includes('maximum 8') ||
    lower.includes('पहले से') ||
    lower.includes('भरा है');

  const isQuota =
    lower.includes('quota') || lower.includes('resource-exhausted') || lower.includes('सीमा');

  if (isOfflineErr) {
    return {
      category: 'offline',
      title: isHi ? 'नेटवर्क या सर्वर से संपर्क नहीं हो पा रहा' : 'Connection Interrupted',
      steps: isHi
        ? [
            'सुनिश्चित करें कि आपका Wi-Fi या मोबाइल डेटा चालू है।',
            'VPN, सख्त एड-ब्लॉकर या फ़ायरवॉल बंद करके देखें जो लाइव डेटाबेस ट्रैफ़िक रोक सकता है।',
            'कुछ सेकंड रुककर "दोबारा प्रयास करें" दबाएँ या पेज रीफ़्रेश करें।',
          ]
        : [
            'Verify that your Wi-Fi or mobile data connection is active and stable.',
            'Temporarily disable VPNs, strict ad-blockers, or browser privacy shields that may block Firestore requests.',
            'Wait a few seconds and click Try Again, or refresh the page.',
          ],
      showSignIn: false,
      showRetry: hasLastAttempt,
    };
  }

  if (isAuthErr) {
    return {
      category: 'auth',
      title: isHi ? 'साइन-इन या अनुमति की समस्या' : 'Account Sign-In Required',
      steps: isHi
        ? [
            'नीचे दिए गए बटन से अपने Google खाते से फिर से साइन इन करें।',
            'यदि Google लॉगिन विंडो नहीं खुल रही है, तो ब्राउज़र में इस साइट के लिए पॉप-अप (Pop-ups) की अनुमति दें।',
            'जाँचें कि आपके Google खाते का ईमेल सत्यापित (verified) है और निजी/इनकॉग्निटो मोड कुकीज़ ब्लॉक नहीं कर रहा।',
          ]
        : [
            'Sign in again with your Google account below to refresh your active session.',
            'Allow browser pop-ups for this site if the Google sign-in window was blocked or closed early.',
            'Ensure third-party cookies/storage are enabled (private browsing modes can block Firebase login).',
          ],
      showSignIn: true,
      showRetry: !needsAuth && hasLastAttempt,
    };
  }

  if (isQuota) {
    return {
      category: 'quota',
      title: isHi ? 'सर्वर उपयोग सीमा पूरी हो गई' : 'Temporary Server Limit Reached',
      steps: isHi
        ? [
            'फ़्री-टियर डेटाबेस की दैनिक सीमा अस्थायी रूप से पूरी हो गई है।',
            'सीमा रीसेट होने तक थोड़ी देर प्रतीक्षा करें और फिर प्रयास करें।',
          ]
        : [
            'The free-tier database daily read/write quota has been temporarily reached.',
            'Wait for the quota window to reset before starting a new card room.',
          ],
      showSignIn: false,
      showRetry: false,
    };
  }

  if (isRoomNotFound) {
    return {
      category: 'room_not_found',
      title: isHi ? 'रूम कोड नहीं मिला' : 'Room Could Not Be Found',
      steps: isHi
        ? [
            'अपने दोस्त से 5-अक्षर का रूम कोड दोबारा जाँचें (अक्सर अक्षर या अंक गलत टाइप हो जाते हैं)।',
            'होस्ट से पूछें कि क्या रूम अभी खुला है — खाली या पुराने रूम अपने आप बंद हो जाते हैं।',
            'या नीचे किसी भी गेम पर "खेलें" दबाकर खुद एक नया कार्ड रूम बनाएँ।',
          ]
        : [
            'Double-check all 5 characters of the room code with the host.',
            'Confirm the room is still open — idle or empty rooms close automatically.',
            'Or start a fresh table by clicking Play on any game card below and share your code.',
          ],
      showSignIn: false,
      showRetry: hasLastAttempt,
    };
  }

  if (isRoomState) {
    return {
      category: 'room_state',
      title: isHi ? 'इस रूम में अभी नहीं जुड़ सकते' : 'Unable to Enter This Room',
      steps: isHi
        ? [
            'यदि गेम पहले ही शुरू हो चुका है, तो इस राउंड के पूरा होने का इंतज़ार करें।',
            'सीट सीमा जाँचें (Satyo: अधिकतम 6 खिलाड़ी · UNO, Mongoose, Gadha Chor: अधिकतम 8)।',
            'नई गेम टेबल शुरू करने के लिए नीचे किसी भी गेम पर "खेलें" दबाएँ।',
          ]
        : [
            'If a hand is already underway, wait for the host to return to the lobby.',
            'Check table capacity (Satyo supports up to 6 players; UNO, Mongoose & Gadha Chor support up to 8).',
            'Create a new card room below to start with a fresh group.',
          ],
      showSignIn: false,
      showRetry: false,
    };
  }

  return {
    category: 'connection',
    title: isHi ? 'रूम सर्वर से कनेक्शन विफल' : 'Could Not Reach Room Server',
    steps: isHi
      ? [
          'अपना इंटरनेट कनेक्शन जाँचें और देखें कि VPN या प्रॉक्सी कनेक्शन बाधित तो नहीं कर रहा।',
          'यदि टैब काफी देर से खुला था, तो Google से दोबारा साइन इन करें ताकि सेशन ताज़ा हो सके।',
          'नीचे "दोबारा प्रयास करें" दबाएँ या पेज रीलोड करके फिर कोशिश करें।',
        ]
      : [
          'Check your internet connection and make sure no firewall, proxy, or VPN is blocking live sync.',
          'Refresh your Google sign-in below if the tab has been idle for a while.',
          'Click Try Again below, or reload the page and retry creating or joining the room.',
        ],
    showSignIn: true,
    showRetry: hasLastAttempt,
  };
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
  onDismissError,
  loadingAction,
}) => {
  const [joinCode, setJoinCode] = useState(initialJoinCode);
  const [rulesModalGame, setRulesModalGame] = useState<CardGameId | null>(null);
  const [creatingGame, setCreatingGame] = useState<CardGameId | null>(null);
  const [lastAttempt, setLastAttempt] = useState<LastMenuAttempt>(null);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const firestoreEnabled = isFirestoreConfigured();
  const needsAuth = firestoreEnabled && !authUser;

  const handlePlayGame = async (gameId: CardGameId) => {
    if (loadingAction || creatingGame) return;
    setLastAttempt({ type: 'create', gameId });
    setCreatingGame(gameId);
    try {
      await onCreateRoom(gameId);
    } finally {
      setCreatingGame(null);
    }
  };

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loadingAction || creatingGame) return;
    setLastAttempt({ type: 'join', code: joinCode });
    await onJoinRoom(joinCode);
  };

  const handleRejoinClick = async (code: string) => {
    if (loadingAction || creatingGame) return;
    setLastAttempt({ type: 'rejoin', code });
    await onRejoin(code);
  };

  const handleRetryAttempt = async () => {
    if (!lastAttempt || loadingAction || creatingGame) return;
    if (lastAttempt.type === 'create') {
      await handlePlayGame(lastAttempt.gameId);
    } else if (lastAttempt.type === 'join') {
      await onJoinRoom(lastAttempt.code);
    } else {
      await onRejoin(lastAttempt.code);
    }
  };

  const diagnosis = useMemo(() => {
    if (!errorMsg) return null;
    return diagnoseConnectionError(
      errorMsg,
      lang,
      isOnline,
      needsAuth,
      Boolean(lastAttempt)
    );
  }, [errorMsg, isOnline, lang, lastAttempt, needsAuth]);

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
            onSubmit={handleJoinSubmit}
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
              onClick={() => handleRejoinClick(rejoinRoom.code)}
              className="min-h-[40px] px-4 rounded-xl bg-[#C5A059] hover:bg-[#D2AE69] text-[#141816] font-display font-bold text-xs flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t(lang, 'pcRejoinBtn')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Enhanced Connection & Troubleshooting Alert */}
      {errorMsg && diagnosis && (
        <div
          role="alert"
          className="rounded-2xl bg-[#2E1716] border border-[#9E352B] p-4 sm:p-5 space-y-4 shadow-xl"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#4E221F] border border-[#B24136]/60 flex items-center justify-center shrink-0 mt-0.5">
                {diagnosis.category === 'offline' || !isOnline ? (
                  <WifiOff className="w-5 h-5 text-[#F5A89D]" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-[#F5A89D]" />
                )}
              </div>
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h2 className="font-display font-bold text-base text-[#FAF7F0]">
                    {diagnosis.title}
                  </h2>
                  <span className="text-xs font-mono-nums text-[#E6D7B7]">
                    · {isOnline ? (lang === 'hi' ? 'नेटवर्क ऑनलाइन' : 'Network Online') : (lang === 'hi' ? 'नेटवर्क ऑफ़लाइन' : 'Network Offline')}
                  </span>
                </div>
                <p className="text-sm text-[#F5D6D2] break-words">{errorMsg}</p>
              </div>
            </div>

            {onDismissError && (
              <button
                type="button"
                onClick={onDismissError}
                aria-label="Dismiss error"
                className="min-h-[36px] min-w-[36px] rounded-xl text-[#D9B0AA] hover:text-[#FAF7F0] hover:bg-[#4E221F] flex items-center justify-center shrink-0 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="rounded-xl bg-[#21100F]/90 border border-[#6E2D27]/70 p-3.5 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-[#E6D7B7]">
              {lang === 'hi' ? 'समाधान के चरण' : 'Troubleshooting Steps'}
            </p>
            <ol className="space-y-1.5 text-xs sm:text-sm text-[#EAD6D3]">
              {diagnosis.steps.map((step, idx) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <span className="font-mono-nums font-bold text-[#C5A059] shrink-0">
                    {idx + 1}.
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {diagnosis.showRetry && (
              <button
                type="button"
                disabled={Boolean(loadingAction)}
                onClick={handleRetryAttempt}
                className="min-h-[42px] px-4 rounded-xl bg-[#C5A059] hover:bg-[#D2AE69] disabled:opacity-50 text-[#141816] font-display font-bold text-xs sm:text-sm inline-flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                <span>{lang === 'hi' ? 'दोबारा प्रयास करें' : 'Try Again'}</span>
              </button>
            )}

            {diagnosis.showSignIn && firestoreEnabled && authReady && (
              <button
                type="button"
                disabled={signingIn}
                onClick={onSignIn}
                className="min-h-[42px] px-4 rounded-xl bg-[#FAF7F0] hover:bg-[#EFE8DA] disabled:opacity-50 text-[#141816] font-display font-bold text-xs sm:text-sm inline-flex items-center gap-1.5 transition-colors"
              >
                <LogIn className="w-4 h-4" />
                <span>
                  {signingIn
                    ? t(lang, 'signingIn')
                    : authUser
                      ? lang === 'hi'
                        ? 'Google खाता रीफ़्रेश करें'
                        : 'Re-authenticate Google'
                      : t(lang, 'signInWithGoogle')}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => window.location.reload()}
              className="min-h-[42px] px-4 rounded-xl bg-[#3D201E] hover:bg-[#522B28] border border-[#7E433D] text-[#FAF7F0] font-semibold text-xs sm:text-sm inline-flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{lang === 'hi' ? 'पेज रीलोड करें' : 'Reload Page'}</span>
            </button>
          </div>
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
