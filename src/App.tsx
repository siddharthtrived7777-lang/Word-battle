/**
 * Party Arcade — Word Battle & Guess the Animal
 *
 * Uses provisioned Firebase Firestore + Google Authentication (configured via
 * `firebase-applet-config.json` and initialized in `src/firebase.ts`).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  auth,
  extractFirebaseError,
  isFirestoreConfigured,
  signInWithGoogle,
  signOutFirebase,
} from './firebase';
import { FIREBASE_CONFIG } from './firebaseConfig';
import {
  GameSettings,
  Language,
  Player,
  PlayerAvatar,
  RoomState,
} from './types/game';
import {
  AnimalPlayer,
  AnimalRoomState,
  AnimalTraitOption,
  QuestionCategoryId,
} from './types/animalGame';
import {
  CharadesDifficulty,
  CharadesPlayer,
  CharadesPrivateMovie,
  CharadesReactionEvent,
  CharadesReactionType,
  CharadesRoomState,
  CharadesTeamId,
} from './types/charades';
import { CardGameId, CardRoomClientState } from './types/cardGames';
import { t } from './data/i18n';
import {
  computeRoundOutcome,
  createRoundSetup,
  generatePlayerId,
  generateRoomCode,
  getSortedPlayers,
} from './utils/gameLogic';
import { roomTransport } from './services/roomTransport';
import {
  animalRoomService,
  loadFlippedIds,
  saveActiveAnimalRoomCode,
  saveFlippedIds,
} from './services/animalRoomService';
import {
  charadesRoomService,
  saveActiveCharadesRoomCode,
} from './services/charadesRoomService';
import {
  cardRoomService,
  saveActiveCardRoomCode,
} from './services/cardRoomService';
import { useVoiceChat, VoiceTransportAdapter } from './hooks/useVoiceChat';
import { useCharadesMedia } from './hooks/useCharadesMedia';
import { useCharadesGestureDetector } from './hooks/useCharadesGestureDetector';
import { soundFx } from './utils/soundFx';
import { AVATAR_COLORS } from './components/Avatar';
import { TopBar } from './components/TopBar';
import { WordRoomShell } from './components/WordRoomShell';
import { FirebaseGuideModal } from './components/FirebaseGuideModal';
import { GameHubScreen } from './screens/GameHubScreen';
import { HomeScreen } from './screens/HomeScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { RoleRevealScreen } from './screens/RoleRevealScreen';
import { DiscussionScreen } from './screens/DiscussionScreen';
import { VotingScreen } from './screens/VotingScreen';
import { ResultScreen } from './screens/ResultScreen';
import { GuessAnimalMenuScreen } from './screens/GuessAnimalMenuScreen';
import { GuessAnimalLobbyScreen } from './screens/GuessAnimalLobbyScreen';
import { GuessAnimalGameScreen } from './screens/GuessAnimalGameScreen';
import { CharadesMenuScreen } from './screens/CharadesMenuScreen';
import { CharadesLobbyScreen } from './screens/CharadesLobbyScreen';
import { CharadesGameScreen } from './screens/CharadesGameScreen';
import { PlayingCardsMenuScreen } from './screens/PlayingCardsMenuScreen';
import { PlayingCardsLobbyScreen } from './screens/PlayingCardsLobbyScreen';
import { PlayingCardsTableScreen } from './screens/PlayingCardsTableScreen';
import { DrawMenuScreen } from './screens/DrawMenuScreen';
import { DrawLobbyScreen } from './screens/DrawLobbyScreen';
import { DrawGameScreen } from './screens/DrawGameScreen';
import type {
  DrawMessageDoc,
  DrawRoomState,
  DrawSecretDoc,
  DrawStrokeDoc,
} from './types/drawGuess';
import {
  drawRoomService,
  saveActiveDrawRoomCode,
} from './services/drawRoomService';
import { buildHintMask } from './data/drawWords';

void FIREBASE_CONFIG;

type ActiveHubSection =
  | 'hub'
  | 'word_battle'
  | 'guess_animal'
  | 'charades'
  | 'playing_cards'
  | 'draw_guess';

function loadStoredProfile() {
  try {
    const id = localStorage.getItem('iw_player_id') || generatePlayerId();
    localStorage.setItem('iw_player_id', id);
    const name = localStorage.getItem('iw_player_name') || '';
    const lang = (localStorage.getItem('iw_lang') as Language) || 'en';
    const rawAvatar = localStorage.getItem('iw_avatar');
    const parsedAvatar: Partial<PlayerAvatar> | null = rawAvatar ? JSON.parse(rawAvatar) : null;
    const avatar: PlayerAvatar = {
      type: 'initials',
      color:
        parsedAvatar?.color && AVATAR_COLORS.includes(parsedAvatar.color)
          ? parsedAvatar.color
          : AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
    };
    return { id, name, lang, avatar };
  } catch {
    return {
      id: generatePlayerId(),
      name: '',
      lang: 'en' as Language,
      avatar: { type: 'initials' as const, color: AVATAR_COLORS[0] },
    };
  }
}

export default function App() {
  const initial = useMemo(() => loadStoredProfile(), []);
  const firestoreEnabled = useMemo(() => isFirestoreConfigured(), []);

  const [authReady, setAuthReady] = useState<boolean>(!firestoreEnabled);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [signingIn, setSigningIn] = useState<boolean>(false);

  const [lang, setLang] = useState<Language>(initial.lang);
  const [playerName, setPlayerName] = useState<string>(initial.name);
  const [avatar, setAvatar] = useState<PlayerAvatar>(initial.avatar);
  const [sfxEnabled, setSfxEnabled] = useState(true);

  const initialJoinCode = useMemo(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return (params.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
    } catch {
      return '';
    }
  }, []);

  const initialCharadesCode = useMemo(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return (params.get('charades') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
    } catch {
      return '';
    }
  }, []);

  const initialCardsCode = useMemo(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return (params.get('cards') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
    } catch {
      return '';
    }
  }, []);

  const initialDrawCode = useMemo(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return (params.get('draw') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
    } catch {
      return '';
    }
  }, []);

  const [activeGame, setActiveGame] = useState<ActiveHubSection>(() =>
    initialDrawCode
      ? 'draw_guess'
      : initialCardsCode
        ? 'playing_cards'
        : initialCharadesCode
          ? 'charades'
          : initialJoinCode
            ? 'word_battle'
            : 'hub'
  );

  // Word Battle State (preserved identically)
  const [room, setRoom] = useState<RoomState | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<'create' | 'join' | null>(null);
  const [showFirebaseGuide, setShowFirebaseGuide] = useState(false);

  // Guess the Animal State
  const [animalRoom, setAnimalRoom] = useState<AnimalRoomState | null>(null);
  const [myAnimalSecretId, setMyAnimalSecretId] = useState<string | null>(null);
  const [rejoinAnimalRoom, setRejoinAnimalRoom] = useState<AnimalRoomState | null>(null);
  const [flippedIds, setFlippedIds] = useState<string[]>([]);
  const [animalErrorMsg, setAnimalErrorMsg] = useState<string | null>(null);
  const [animalLoadingAction, setAnimalLoadingAction] = useState<
    'create' | 'join' | 'rejoin' | null
  >(null);
  const [animalVoiceEnabled, setAnimalVoiceEnabled] = useState(false);

  // Bollywood Dumb Charades State
  const [charadesRoom, setCharadesRoom] = useState<CharadesRoomState | null>(null);
  const [myPrivateMovie, setMyPrivateMovie] = useState<CharadesPrivateMovie | null>(null);
  const [rejoinCharadesRoom, setRejoinCharadesRoom] = useState<CharadesRoomState | null>(null);
  const [charadesReactions, setCharadesReactions] = useState<CharadesReactionEvent[]>([]);
  const [charadesErrorMsg, setCharadesErrorMsg] = useState<string | null>(null);
  const [charadesLoadingAction, setCharadesLoadingAction] = useState<
    'create' | 'join' | 'rejoin' | null
  >(null);

  // Playing Cards State
  const [cardRoom, setCardRoom] = useState<CardRoomClientState | null>(null);
  const [rejoinCardRoom, setRejoinCardRoom] = useState<CardRoomClientState | null>(null);
  const [cardErrorMsg, setCardErrorMsg] = useState<string | null>(null);
  const [cardLoadingAction, setCardLoadingAction] = useState<
    'create' | 'join' | 'rejoin' | null
  >(null);

  // Draw & Guess State
  const [drawRoom, setDrawRoom] = useState<DrawRoomState | null>(null);
  const [drawStrokes, setDrawStrokes] = useState<DrawStrokeDoc[]>([]);
  const [drawMessages, setDrawMessages] = useState<DrawMessageDoc[]>([]);
  const [myDrawSecret, setMyDrawSecret] = useState<DrawSecretDoc | null>(null);
  const [rejoinDrawRoom, setRejoinDrawRoom] = useState<DrawRoomState | null>(null);
  const [drawErrorMsg, setDrawErrorMsg] = useState<string | null>(null);
  const [drawLoadingAction, setDrawLoadingAction] = useState<
    'create' | 'join' | 'rejoin' | null
  >(null);
  const [drawVoiceEnabled, setDrawVoiceEnabled] = useState(false);

  const myId = firestoreEnabled && authUser ? authUser.uid : initial.id;

  const roomRef = useRef<RoomState | null>(null);
  roomRef.current = room;

  const lastTurnAdvanceKeyRef = useRef<string>('');
  const advancingResultRef = useRef<boolean>(false);
  const startingPlayingPhaseRef = useRef<string>('');
  const resolvingQuestionRef = useRef<string>('');
  const resolvingGuessRef = useRef<string>('');
  const revealingFinishRef = useRef<string>('');
  const resolvingGadhaPickRef = useRef<string>('');
  const revealingCardsFinishRef = useRef<string>('');
  const cardTimeoutKeyRef = useRef<string>('');
  const cardEntryLockRef = useRef<boolean>(false);
  const drawEntryLockRef = useRef<boolean>(false);
  const drawChoicesKeyRef = useRef<string>('');
  const drawHintStageRef = useRef<{ turnKey: string; stage: number; indices: number[] }>({
    turnKey: '',
    stage: 0,
    indices: [],
  });
  const drawRevealLockRef = useRef<string>('');
  const drawAdvanceLockRef = useRef<string>('');

  useEffect(() => {
    if (!firestoreEnabled) return;
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthReady(true);
      if (user?.displayName) {
        setPlayerName((prev) => (prev.trim() ? prev : user.displayName || ''));
      }
      if (!user) {
        roomTransport.cleanup();
        animalRoomService.cleanup();
        charadesRoomService.cleanup();
        cardRoomService.cleanup();
        drawRoomService.cleanup();
        setRoom(null);
        setAnimalRoom(null);
        setMyAnimalSecretId(null);
        setRejoinAnimalRoom(null);
        setCharadesRoom(null);
        setMyPrivateMovie(null);
        setRejoinCharadesRoom(null);
        setCharadesReactions([]);
        setCardRoom(null);
        setRejoinCardRoom(null);
        setDrawRoom(null);
        setDrawStrokes([]);
        setDrawMessages([]);
        setMyDrawSecret(null);
        setRejoinDrawRoom(null);
      }
    });
    return () => unsub();
  }, [firestoreEnabled]);

  // Persist user profile locally
  useEffect(() => {
    try {
      localStorage.setItem('iw_player_name', playerName);
      localStorage.setItem('iw_lang', lang);
      localStorage.setItem('iw_avatar', JSON.stringify(avatar));
    } catch {
      // Ignore storage quota errors
    }
  }, [playerName, lang, avatar]);

  // Voice chat for Word Battle
  const {
    micStatus,
    isMuted,
    speakingIds,
    requestMicrophone,
    toggleMute,
    handleSignal,
  } = useVoiceChat(myId, Boolean(room), room?.players);

  // Optional voice chat for Guess the Animal
  const animalRoomCodeRef = useRef<string | null>(null);
  animalRoomCodeRef.current = animalRoom?.code ?? null;

  const animalVoiceAdapter = useMemo<VoiceTransportAdapter>(
    () => ({
      sendSignal: (signal) => {
        if (!animalRoomCodeRef.current) return Promise.resolve();
        return animalRoomService.sendSignal(animalRoomCodeRef.current, signal);
      },
      updateMuteState: (playerId, muted) => {
        if (!animalRoomCodeRef.current) return Promise.resolve();
        return animalRoomService.updateMuteState(animalRoomCodeRef.current, playerId, muted);
      },
    }),
    []
  );

  const animalVoice = useVoiceChat(
    myId,
    Boolean(animalRoom && animalVoiceEnabled),
    animalRoom?.players,
    animalVoiceAdapter
  );

  const handleToggleAnimalVoice = async () => {
    if (animalVoiceEnabled) {
      animalVoice.stopMicrophone();
      setAnimalVoiceEnabled(false);
    } else {
      setAnimalVoiceEnabled(true);
      await animalVoice.requestMicrophone();
    }
  };

  // Live video + voice WebRTC mesh for Dumb Charades
  const charadesMedia = useCharadesMedia(
    myId,
    charadesRoom?.code ?? null,
    charadesRoom?.players
  );

  const pushCharadesReaction = useCallback((reaction: CharadesReactionEvent) => {
    setCharadesReactions((prev) => {
      if (prev.some((item) => item.id === reaction.id)) return prev;
      return [...prev.slice(-11), reaction];
    });
    window.setTimeout(() => {
      setCharadesReactions((prev) => prev.filter((item) => item.id !== reaction.id));
    }, 2600);
  }, []);

  const handleLocalGestureTriggered = useCallback(
    async (gesture: CharadesReactionType) => {
      if (!charadesRoom) return;
      const myName =
        charadesRoom.players[myId]?.name ||
        playerName.trim() ||
        authUser?.displayName ||
        'Player';
      try {
        const sent = await charadesRoomService.sendReaction(
          charadesRoom.code,
          myName,
          gesture,
          charadesRoom.playerIds
        );
        if (sent) {
          pushCharadesReaction(sent);
        }
      } catch {
        // Ignore transient reaction broadcast failure without disrupting gameplay
      }
    },
    [authUser?.displayName, charadesRoom, myId, playerName, pushCharadesReaction]
  );

  useCharadesGestureDetector({
    enabled: activeGame === 'charades' && Boolean(charadesRoom) && charadesMedia.cameraOn,
    localStream: charadesMedia.localStream,
    onGestureTriggered: handleLocalGestureTriggered,
  });

  // Live voice chat WebRTC mesh for Playing Cards
  const cardsVoiceAdapter = useMemo<VoiceTransportAdapter>(
    () => ({
      sendSignal: (signal) => cardRoomService.sendSignal(signal),
      updateMuteState: (playerId, muted) => cardRoomService.updateMuteState(playerId, muted),
    }),
    []
  );

  const cardsVoice = useVoiceChat(
    myId,
    Boolean(cardRoom),
    cardRoom?.players,
    cardsVoiceAdapter
  );

  const cardsVoiceSignalRef = useRef(cardsVoice.handleSignal);
  cardsVoiceSignalRef.current = cardsVoice.handleSignal;

  // Optional live voice chat WebRTC mesh for Draw & Guess
  const drawRoomCodeRef = useRef<string | null>(null);
  drawRoomCodeRef.current = drawRoom?.code ?? null;

  const drawVoiceAdapter = useMemo<VoiceTransportAdapter>(
    () => ({
      sendSignal: async (signal) => {
        const code = drawRoomCodeRef.current;
        if (!code) return;
        await drawRoomService.sendSignal(code, {
          ...signal,
          id: `sig_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          timestamp: Date.now(),
        });
      },
      updateMuteState: async (playerId, muted) => {
        const code = drawRoomCodeRef.current;
        if (!code) return;
        await drawRoomService.setMute(code, playerId, muted);
      },
    }),
    []
  );

  const drawVoice = useVoiceChat(
    myId,
    Boolean(drawRoom) && drawVoiceEnabled,
    drawRoom?.players,
    drawVoiceAdapter
  );

  const drawVoiceSignalRef = useRef(drawVoice.handleSignal);
  drawVoiceSignalRef.current = drawVoice.handleSignal;

  // Discover active Draw & Guess room to offer rejoin
  useEffect(() => {
    if (!firestoreEnabled || !authUser || drawRoom) return;
    if (activeGame !== 'draw_guess') return;

    let cancelled = false;
    drawRoomService
      .findRejoinableRoom(authUser.uid)
      .then((found) => {
        if (!cancelled) setRejoinDrawRoom(found);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [activeGame, authUser, drawRoom, firestoreEnabled]);

  // Draw & Guess: Ensure drawer gets 3 word choices on choosing_word phase
  useEffect(() => {
    if (!drawRoom || drawRoom.phase !== 'choosing_word' || !drawRoom.turn) return;
    if (drawRoom.turn.drawerUid !== myId) return;
    const key = drawRoom.turn.turnKey;
    if (drawChoicesKeyRef.current === key) return;
    drawChoicesKeyRef.current = key;
    void drawRoomService.ensureDrawerChoices(drawRoom.code, drawRoom, myId).catch(() => {
      drawChoicesKeyRef.current = '';
    });
  }, [drawRoom, myId]);

  // Draw & Guess: Auto-pick, auto-hints, all-solved reveal, and turn-reveal auto-advance
  useEffect(() => {
    if (!drawRoom || !drawRoom.turn) return;
    const turn = drawRoom.turn;
    const isDrawer = turn.drawerUid === myId;
    const isHost = drawRoom.hostId === myId;

    const tick = () => {
      const now = Date.now();

      // 1. Choosing word timeout -> drawer auto-picks first option
      if (drawRoom.phase === 'choosing_word') {
        if (isDrawer && now >= turn.deadlineAt && myDrawSecret?.turnKey === turn.turnKey && myDrawSecret.choices[0]) {
          const lock = `autopick_${turn.turnKey}`;
          if (drawRevealLockRef.current !== lock) {
            drawRevealLockRef.current = lock;
            void drawRoomService.selectWord(drawRoom.code, drawRoom, myId, myDrawSecret.choices[0]);
          }
        }
        return;
      }

      // 2. Drawing phase: progressive hints + all-guessed / timeout reveal
      if (drawRoom.phase === 'drawing') {
        const totalMs = Math.max(1000, drawRoom.settings.drawTimeSec * 1000);
        const remainingMs = turn.deadlineAt - now;

        // Progressive letter hints published by drawer
        if (
          isDrawer &&
          drawRoom.settings.hintsEnabled &&
          myDrawSecret?.turnKey === turn.turnKey &&
          myDrawSecret.word
        ) {
          const letters = myDrawSecret.word.replace(/[^a-zA-Z0-9]/g, '');
          if (drawHintStageRef.current.turnKey !== turn.turnKey) {
            const idxPool = Array.from({ length: letters.length }, (_, i) => i);
            for (let i = idxPool.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [idxPool[i], idxPool[j]] = [idxPool[j], idxPool[i]];
            }
            drawHintStageRef.current = { turnKey: turn.turnKey, stage: 0, indices: idxPool };
          }

          if (letters.length >= 4 && remainingMs <= totalMs * 0.5 && drawHintStageRef.current.stage < 1) {
            drawHintStageRef.current.stage = 1;
            const reveal = drawHintStageRef.current.indices.slice(0, 1);
            void drawRoomService.publishHintMask(drawRoom.code, turn, buildHintMask(myDrawSecret.word, reveal));
          } else if (letters.length >= 6 && remainingMs <= totalMs * 0.25 && drawHintStageRef.current.stage < 2) {
            drawHintStageRef.current.stage = 2;
            const reveal = drawHintStageRef.current.indices.slice(0, 2);
            void drawRoomService.publishHintMask(drawRoom.code, turn, buildHintMask(myDrawSecret.word, reveal));
          }
        }

        const otherPlayerIds = drawRoom.playerIds.filter((id) => id !== turn.drawerUid);
        const allSolved =
          otherPlayerIds.length > 0 &&
          otherPlayerIds.every((uid) => Boolean(turn.guessedBy[uid]));
        const timedOut = remainingMs <= 0;

        if (allSolved || timedOut) {
          const revealKey = `reveal_${turn.turnKey}`;
          if (drawRevealLockRef.current === revealKey) return;

          if (isDrawer && myDrawSecret?.turnKey === turn.turnKey && myDrawSecret.word) {
            drawRevealLockRef.current = revealKey;
            void drawRoomService.revealTurn(drawRoom.code, drawRoom, myDrawSecret.word);
          } else if (isHost && (!drawRoom.players[turn.drawerUid] || remainingMs <= -3500)) {
            drawRevealLockRef.current = revealKey;
            void drawRoomService.revealTurn(drawRoom.code, drawRoom, 'Time Up');
          }
        }
        return;
      }

      // 3. Turn reveal timeout -> advance to next drawer or finished podium
      if (drawRoom.phase === 'turn_reveal') {
        if (now >= turn.deadlineAt && (isHost || (isDrawer && !drawRoom.players[drawRoom.hostId]))) {
          const advKey = `adv_${turn.turnKey}`;
          if (drawAdvanceLockRef.current !== advKey) {
            drawAdvanceLockRef.current = advKey;
            void drawRoomService.advanceNextTurn(drawRoom.code, drawRoom);
          }
        }
      }
    };

    tick();
    const intervalId = window.setInterval(tick, 500);
    return () => window.clearInterval(intervalId);
  }, [drawRoom, myDrawSecret, myId]);

  // Discover active Guess the Animal room to offer rejoin after disconnect
  useEffect(() => {
    if (!firestoreEnabled || !authUser || animalRoom) return;
    if (activeGame !== 'guess_animal') return;

    let cancelled = false;
    animalRoomService
      .findActiveRejoinRoom(authUser.uid)
      .then((found) => {
        if (!cancelled) {
          setRejoinAnimalRoom(found);
        }
      })
      .catch(() => {
        // Ignore lookup error
      });

    return () => {
      cancelled = true;
    };
  }, [activeGame, animalRoom, authUser, firestoreEnabled]);

  // Discover active Dumb Charades room to offer rejoin after disconnect
  useEffect(() => {
    if (!firestoreEnabled || !authUser || charadesRoom) return;
    if (activeGame !== 'charades') return;

    let cancelled = false;
    charadesRoomService
      .findActiveRejoinRoom(authUser.uid)
      .then((found) => {
        if (!cancelled) {
          setRejoinCharadesRoom(found);
        }
      })
      .catch(() => {
        // Ignore lookup error
      });

    return () => {
      cancelled = true;
    };
  }, [activeGame, authUser, charadesRoom, firestoreEnabled]);

  // Discover active Playing Cards room to offer rejoin after disconnect
  useEffect(() => {
    if (cardRoom || activeGame !== 'playing_cards') return;
    if (firestoreEnabled && !authUser) return;

    let cancelled = false;
    cardRoomService
      .findActiveRejoinRoom(myId)
      .then((found) => {
        if (!cancelled) {
          setRejoinCardRoom(found);
        }
      })
      .catch(() => {
        // Ignore lookup error
      });

    return () => {
      cancelled = true;
    };
  }, [activeGame, authUser, cardRoom, firestoreEnabled, myId]);

  // Restore flipped card state when joining/rejoining a Guess the Animal room
  useEffect(() => {
    if (!animalRoom) {
      setFlippedIds([]);
      return;
    }
    if (animalRoom.phase === 'picking' && animalRoom.history.length === 0) {
      setFlippedIds([]);
      saveFlippedIds(animalRoom.code, myId, []);
    } else if (animalRoom.phase === 'playing') {
      setFlippedIds(loadFlippedIds(animalRoom.code, myId));
    }
  }, [animalRoom?.code, animalRoom?.phase, animalRoom?.history.length, myId]);

  // Auto-advance Guess the Animal from 'picking' -> 'playing' when both players picked
  useEffect(() => {
    if (!animalRoom || animalRoom.phase !== 'picking' || animalRoom.hostId !== myId) return;
    const bothReady =
      animalRoom.playerIds.length === 2 &&
      animalRoom.playerIds.every((pid) => Boolean(animalRoom.players[pid]?.pickedSecret));
    const key = `${animalRoom.code}_picking_done`;
    if (bothReady && startingPlayingPhaseRef.current !== key) {
      startingPlayingPhaseRef.current = key;
      animalRoomService.beginPlayingPhase(animalRoom.code).catch(() => {});
    } else if (!bothReady) {
      startingPlayingPhaseRef.current = '';
    }
  }, [animalRoom, myId]);

  // Auto-answer pending question from opponent's secret animal
  useEffect(() => {
    if (!animalRoom || animalRoom.phase !== 'playing' || !animalRoom.pendingQuestion) return;
    const pq = animalRoom.pendingQuestion;
    if (pq.byUid === myId || !myAnimalSecretId) return;
    if (resolvingQuestionRef.current === pq.id) return;
    resolvingQuestionRef.current = pq.id;

    animalRoomService
      .resolvePendingQuestion(animalRoom.code, myAnimalSecretId, pq, animalRoom.history)
      .catch(() => {
        resolvingQuestionRef.current = '';
      });
  }, [animalRoom, myAnimalSecretId, myId]);

  // Auto-evaluate pending guess from opponent's secret animal
  useEffect(() => {
    if (!animalRoom || animalRoom.phase !== 'playing' || !animalRoom.pendingGuess) return;
    const pg = animalRoom.pendingGuess;
    if (pg.byUid === myId || !myAnimalSecretId) return;
    if (resolvingGuessRef.current === pg.id) return;
    resolvingGuessRef.current = pg.id;

    animalRoomService
      .resolvePendingGuess(animalRoom.code, myId, myAnimalSecretId, pg, animalRoom.history)
      .catch(() => {
        resolvingGuessRef.current = '';
      });
  }, [animalRoom, myAnimalSecretId, myId]);

  // Reveal own secret animal cleanly when match finishes
  useEffect(() => {
    if (!animalRoom || animalRoom.phase !== 'finished' || !myAnimalSecretId) return;
    if (animalRoom.revealedAnimals[myId]) return;
    const key = `${animalRoom.code}_${animalRoom.updatedAt}_${myId}`;
    if (revealingFinishRef.current === key) return;
    revealingFinishRef.current = key;

    animalRoomService
      .revealMySecretOnFinish(animalRoom.code, myId, myAnimalSecretId)
      .catch(() => {
        revealingFinishRef.current = '';
      });
  }, [animalRoom, myAnimalSecretId, myId]);

  // Auto-resolve incoming Gadha Chor blind pick from neighbor
  useEffect(() => {
    if (
      !firestoreEnabled ||
      !cardRoom ||
      cardRoom.phase !== 'playing' ||
      cardRoom.selectedGame !== 'gadha_chor'
    ) {
      return;
    }
    const pending = cardRoom.table?.gadhaChor?.pendingPick;
    if (!pending || pending.targetUid !== myId) return;
    if (resolvingGadhaPickRef.current === pending.id) return;
    resolvingGadhaPickRef.current = pending.id;

    cardRoomService.resolvePendingGadhaPick(cardRoom.code, myId).catch(() => {
      resolvingGadhaPickRef.current = '';
    });
  }, [cardRoom, firestoreEnabled, myId]);

  // Reveal own remaining hand cleanly when a card hand finishes
  useEffect(() => {
    if (!firestoreEnabled || !cardRoom || cardRoom.phase !== 'finished') return;
    if (!cardRoom.table?.outcome) return;
    if (cardRoom.table.outcome.revealedHands?.[myId]) return;
    if (cardRoom.myHand.length === 0) return;

    const key = `${cardRoom.code}_${cardRoom.table.roundNumber}_${myId}`;
    if (revealingCardsFinishRef.current === key) return;
    revealingCardsFinishRef.current = key;

    cardRoomService.revealHandOnFinish(cardRoom.code, myId).catch(() => {
      revealingCardsFinishRef.current = '';
    });
  }, [cardRoom, firestoreEnabled, myId]);

  // Client-side turn timer auto-advance in Firestore mode
  useEffect(() => {
    if (!firestoreEnabled || !cardRoom || cardRoom.phase !== 'playing') return;
    const table = cardRoom.table;
    if (!table?.turnDeadlineAt || !table.turnUid) return;

    const isTurnOwner = table.turnUid === myId;
    const isHost = cardRoom.hostId === myId;
    if (!isTurnOwner && !isHost) return;

    const key = `${cardRoom.code}_${table.roundNumber}_${table.turnUid}_${table.turnDeadlineAt}`;
    const delay = Math.max(
      250,
      table.turnDeadlineAt - Date.now() + (isTurnOwner ? 200 : 2800)
    );

    const timer = window.setTimeout(() => {
      if (cardTimeoutKeyRef.current === key) return;
      cardTimeoutKeyRef.current = key;
      cardRoomService.resolveTimedOutTurn(cardRoom.code, myId).catch(() => {
        cardTimeoutKeyRef.current = '';
      });
    }, delay);

    return () => window.clearTimeout(timer);
  }, [cardRoom, firestoreEnabled, myId]);

  const handleSignIn = async () => {
    setErrorMsg(null);
    setAnimalErrorMsg(null);
    setCharadesErrorMsg(null);
    setCardErrorMsg(null);
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign-in failed';
      setErrorMsg(msg);
      setAnimalErrorMsg(msg);
      setCharadesErrorMsg(msg);
      setCardErrorMsg(msg);
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await roomTransport.leaveRoom();
    if (animalRoom) {
      await animalRoomService.leaveRoom(animalRoom.code, myId);
    }
    if (charadesRoom) {
      await charadesRoomService.leaveRoom(charadesRoom.code, myId);
    }
    if (cardRoom) {
      await cardRoomService.leaveRoom(cardRoom.code, myId);
    }
    charadesMedia.stopAllMedia();
    setRoom(null);
    setAnimalRoom(null);
    setMyAnimalSecretId(null);
    setRejoinAnimalRoom(null);
    setCharadesRoom(null);
    setMyPrivateMovie(null);
    setRejoinCharadesRoom(null);
    setCardRoom(null);
    setRejoinCardRoom(null);
    await signOutFirebase();
  };

  const handleToggleLang = () => {
    setLang((prev) => (prev === 'en' ? 'hi' : 'en'));
  };

  const handleToggleSfx = () => {
    setSfxEnabled((prev) => {
      const next = !prev;
      soundFx.enabled = next;
      return next;
    });
  };

  const mapTransportError = useCallback(
    (rawCode: string) => {
      let code = rawCode;
      let detailMsg = '';

      if (rawCode.startsWith('{') && rawCode.includes('"operationType"')) {
        const extracted = extractFirebaseError({ message: rawCode });
        code = extracted.code || rawCode;
        detailMsg = extracted.message;
      } else if (rawCode.startsWith('CONNECTION_FAILED:')) {
        const detail = rawCode.slice('CONNECTION_FAILED:'.length);
        console.error('Room connection error:', detail);
        return `${t(lang, 'errConnectionFailed')} (${detail})`;
      }

      const lowerDetail = detailMsg.toLowerCase();
      if (
        code === 'unavailable' ||
        lowerDetail.includes('offline') ||
        lowerDetail.includes('network')
      ) {
        return lang === 'hi'
          ? `रूम सर्वर से कनेक्शन नहीं हो पाया — नेटवर्क ऑफ़लाइन या अस्थायी रूप से अनुपलब्ध है (${code}).`
          : `Could not connect to the room server — network is offline or temporarily unavailable (${code}).`;
      }
      if (code === 'permission-denied' || code === 'unauthenticated') {
        return lang === 'hi'
          ? `प्रमाणीकरण या रूम अनुमति अस्वीकृत हुई (${code}). कृपया Google से दोबारा साइन इन करें।`
          : `Authentication or room permission denied (${code}). Please sign in with Google again.`;
      }
      if (code === 'resource-exhausted') {
        return lang === 'hi'
          ? `डेटाबेस की दैनिक सीमा समाप्त हो गई है (${code}).`
          : `Database daily quota exceeded (${code}).`;
      }

      switch (code) {
        case 'ROOM_NOT_FOUND':
          return t(lang, 'errRoomNotFound');
        case 'ROOM_FULL':
          return t(lang, 'errRoomFull');
        case 'ROOM_UNAVAILABLE':
          return lang === 'hi'
            ? 'यह रूम पहले से भरा है या इसमें गेम चल रहा है।'
            : 'This room is already full or a game is currently in progress.';
        case 'ROOM_EXISTS':
          return lang === 'hi'
            ? 'रूम कोड पहले से उपयोग में है। कृपया नया रूम बनाने के लिए दोबारा प्रयास करें।'
            : 'That room code is already active. Please try again to generate a fresh code.';
        case 'INVALID_CODE':
          return t(lang, 'errInvalidCode');
        case 'GAME_IN_PROGRESS':
          return t(lang, 'errGameInProgress');
        case 'AUTH_REQUIRED':
          return t(lang, 'signInRequired');
        case 'AUTH_UNVERIFIED':
          return lang === 'hi'
            ? 'कृपया सत्यापित ईमेल वाले Google खाते से साइन इन करें।'
            : 'Please sign in with a verified Google account to play online.';
        case 'CONNECTION_FAILED':
          return t(lang, 'errConnectionFailed');
        case 'DISCONNECTED':
          return t(lang, 'errDisconnected');
        case 'NEED_AT_LEAST_2_PLAYERS':
          return 'At least 2 connected players are needed to deal cards.';
        case 'MAX_6_PLAYERS':
          return 'Satyo supports up to 6 players.';
        case 'MAX_8_PLAYERS':
          return 'Maximum 8 players allowed in this room.';
        default: {
          const suffix = code && code !== 'unknown' ? code : detailMsg || 'unknown';
          console.error('Unexpected room error:', rawCode);
          return `${t(lang, 'errConnectionFailed')} (${suffix})`;
        }
      }
    },
    [lang]
  );

  const mapAnimalError = useCallback(
    (code: string) => {
      switch (code) {
        case 'GTA_ROOM_FULL':
          return t(lang, 'gtaErrRoomFull');
        case 'GTA_GAME_STARTED':
          return t(lang, 'gtaErrGameStarted');
        case 'GTA_ROOM_NOT_FOUND':
          return t(lang, 'gtaErrRoomNotFound');
        case 'AUTH_REQUIRED':
          return t(lang, 'signInRequired');
        default:
          return `${t(lang, 'errConnectionFailed')} (${code})`;
      }
    },
    [lang]
  );

  // ---------------- Word Battle Handlers (unchanged) ----------------
  const buildLocalPlayer = useCallback(
    (isHost: boolean): Player => ({
      id: myId,
      name: playerName.trim() || authUser?.displayName || 'Player',
      avatar,
      isHost,
      connected: true,
      joinedAt: Date.now(),
      score: 0,
      isMuted: false,
      readyForDiscussion: false,
    }),
    [authUser?.displayName, avatar, myId, playerName]
  );

  const handleCreateRoom = async () => {
    if (firestoreEnabled && !authUser) {
      setErrorMsg(t(lang, 'signInRequired'));
      return;
    }
    if (!playerName.trim()) {
      setErrorMsg(t(lang, 'errEnterName'));
      return;
    }
    setErrorMsg(null);
    setLoadingAction('create');

    try {
      await requestMicrophone();
      const me = buildLocalPlayer(true);

      let lastErr: unknown = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const code = generateRoomCode();
        const initialRoom: RoomState = {
          code,
          hostId: myId,
          phase: 'lobby',
          createdAt: Date.now(),
          settings: {
            category: 'random',
            rounds: 3,
            imposterCount: 1,
          },
          players: { [myId]: me },
          usedPairIds: [],
          roundConfig: null,
          clues: [],
          votes: {},
          outcome: null,
        };

        try {
          await roomTransport.createRoom(initialRoom, me, {
            onRoomUpdate: (nextRoom) => {
              setRoom(nextRoom);
            },
            onSignal: handleSignal,
            onError: (codeErr) => {
              setErrorMsg(mapTransportError(codeErr));
            },
          });
          lastErr = null;
          break;
        } catch (err) {
          lastErr = err;
          if (!(err instanceof Error && err.message === 'ROOM_EXISTS')) {
            throw err;
          }
        }
      }

      if (lastErr) throw lastErr;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'CONNECTION_FAILED';
      setErrorMsg(mapTransportError(msg));
    } finally {
      setLoadingAction(null);
    }
  };

  const handleJoinRoom = async (rawCode: string) => {
    if (firestoreEnabled && !authUser) {
      setErrorMsg(t(lang, 'signInRequired'));
      return;
    }
    if (!playerName.trim()) {
      setErrorMsg(t(lang, 'errEnterName'));
      return;
    }
    const cleanCode = rawCode.toUpperCase().trim();
    if (cleanCode.length !== 5) {
      setErrorMsg(t(lang, 'errInvalidCode'));
      return;
    }

    setErrorMsg(null);
    setLoadingAction('join');

    try {
      await requestMicrophone();
      const me = buildLocalPlayer(false);
      await roomTransport.joinRoom(cleanCode, me, {
        onRoomUpdate: (nextRoom) => {
          setRoom(nextRoom);
        },
        onSignal: handleSignal,
        onError: (codeErr) => {
          setErrorMsg(mapTransportError(codeErr));
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'CONNECTION_FAILED';
      setErrorMsg(mapTransportError(msg));
    } finally {
      setLoadingAction(null);
    }
  };

  const handleLeaveRoom = async () => {
    await roomTransport.leaveRoom();
    setRoom(null);
    setErrorMsg(null);
  };

  const handleUpdateSettings = (settings: GameSettings) => {
    if (!room || room.hostId !== myId) return;
    roomTransport.updateRoom({ settings });
  };

  const handleStartGame = () => {
    if (!room || room.hostId !== myId) return;
    const playersList = getSortedPlayers(room.players);
    if (playersList.length < 2) return;

    const resetPlayers: Record<string, Player> = {};
    for (const p of playersList) {
      resetPlayers[p.id] = { ...p, readyForDiscussion: false };
    }

    const { roundConfig, nextUsedPairIds } = createRoundSetup(
      resetPlayers,
      room.settings,
      room.usedPairIds
    );

    advancingResultRef.current = false;
    roomTransport.updateRoom({
      phase: 'reveal',
      players: resetPlayers,
      roundConfig,
      usedPairIds: nextUsedPairIds,
      clues: [],
      votes: {},
      outcome: null,
    });
  };

  const handleMarkReady = () => {
    if (!room) return;
    soundFx.click();
    roomTransport.updatePlayer(myId, { readyForDiscussion: true });
  };

  const handleStartDiscussion = useCallback(() => {
    const current = roomRef.current;
    if (!current || current.hostId !== myId || !current.roundConfig) return;
    roomTransport.updateRoom({
      phase: 'discussion',
      roundConfig: {
        ...current.roundConfig,
        currentTurnIndex: 0,
        currentRound: 1,
        turnStartedAt: Date.now(),
      },
    });
  }, [myId]);

  useEffect(() => {
    if (!room || room.phase !== 'reveal' || room.hostId !== myId) return;
    const players = getSortedPlayers(room.players);
    if (players.length > 0 && players.every((p) => p.readyForDiscussion)) {
      handleStartDiscussion();
    }
  }, [handleStartDiscussion, myId, room]);

  const handleAdvanceTurn = useCallback(() => {
    const current = roomRef.current;
    if (!current || !current.roundConfig || current.phase !== 'discussion') return;

    const rc = current.roundConfig;
    const key = `${rc.currentRound}_${rc.currentTurnIndex}_${rc.turnStartedAt}`;
    if (lastTurnAdvanceKeyRef.current === key) return;
    lastTurnAdvanceKeyRef.current = key;

    const nextTurnIdx = rc.currentTurnIndex + 1;
    if (nextTurnIdx < rc.turnOrder.length) {
      roomTransport.updateRoom({
        roundConfig: {
          ...rc,
          currentTurnIndex: nextTurnIdx,
          turnStartedAt: Date.now(),
        },
      });
    } else if (rc.currentRound < current.settings.rounds) {
      roomTransport.updateRoom({
        roundConfig: {
          ...rc,
          currentRound: rc.currentRound + 1,
          currentTurnIndex: 0,
          turnStartedAt: Date.now(),
        },
      });
    } else {
      roomTransport.updateRoom({
        phase: 'voting',
        votes: {},
      });
    }
  }, []);

  const handleForceVoting = () => {
    if (!room || room.hostId !== myId) return;
    roomTransport.updateRoom({
      phase: 'voting',
      votes: {},
    });
  };

  const handleCastVote = (targetId: string) => {
    if (!room || room.phase !== 'voting') return;
    roomTransport.castVote(targetId);
  };

  const finalizeVoting = useCallback(() => {
    const current = roomRef.current;
    if (!current || current.hostId !== myId || current.phase !== 'voting') return;
    if (advancingResultRef.current) return;
    advancingResultRef.current = true;

    const outcome = computeRoundOutcome(current);
    const updatedPlayers: Record<string, Player> = {};
    for (const [pid, p] of Object.entries(current.players)) {
      const gained = outcome.pointsAwarded[pid] ?? 0;
      updatedPlayers[pid] = {
        ...p,
        score: p.score + gained,
      };
    }

    roomTransport.updateRoom({
      phase: 'result',
      outcome,
      players: updatedPlayers,
    });
  }, [myId]);

  useEffect(() => {
    if (!room || room.phase !== 'voting' || room.hostId !== myId) return;
    const players = getSortedPlayers(room.players);
    const validVotes = players.filter((p) => Boolean(room.votes?.[p.id])).length;
    if (players.length > 0 && validVotes >= players.length) {
      finalizeVoting();
    }
  }, [finalizeVoting, myId, room]);

  const handlePlayAgain = () => {
    if (!room || room.hostId !== myId) return;
    advancingResultRef.current = false;
    const resetPlayers: Record<string, Player> = {};
    for (const [pid, p] of Object.entries(room.players)) {
      resetPlayers[pid] = { ...p, readyForDiscussion: false };
    }
    roomTransport.updateRoom({
      phase: 'lobby',
      roundConfig: null,
      clues: [],
      votes: {},
      outcome: null,
      players: resetPlayers,
    });
  };

  // ---------------- Guess the Animal Handlers ----------------
  const buildAnimalPlayer = useCallback(
    (isHost: boolean): AnimalPlayer => ({
      id: myId,
      name: playerName.trim() || authUser?.displayName || 'Player',
      avatar,
      isHost,
      connected: true,
      joinedAt: Date.now(),
      isMuted: false,
      pickedSecret: false,
    }),
    [authUser?.displayName, avatar, myId, playerName]
  );

  const handleCreateAnimalRoom = async () => {
    if (firestoreEnabled && !authUser) {
      setAnimalErrorMsg(t(lang, 'signInRequired'));
      return;
    }
    setAnimalErrorMsg(null);
    setAnimalLoadingAction('create');

    try {
      const me = buildAnimalPlayer(true);
      let lastErr: unknown = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const code = generateRoomCode();
        try {
          await animalRoomService.createRoom(code, me, {
            onRoomUpdate: setAnimalRoom,
            onSecretUpdate: setMyAnimalSecretId,
            onSignal: animalVoice.handleSignal,
          });
          setRejoinAnimalRoom(null);
          lastErr = null;
          break;
        } catch (err) {
          lastErr = err;
          if (!(err instanceof Error && err.message === 'ROOM_EXISTS')) {
            throw err;
          }
        }
      }
      if (lastErr) throw lastErr;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'CONNECTION_FAILED';
      setAnimalErrorMsg(mapAnimalError(msg));
    } finally {
      setAnimalLoadingAction(null);
    }
  };

  const handleJoinAnimalRoom = async (
    rawCode: string,
    actionType: 'join' | 'rejoin' = 'join'
  ) => {
    if (firestoreEnabled && !authUser) {
      setAnimalErrorMsg(t(lang, 'signInRequired'));
      return;
    }
    const cleanCode = rawCode.toUpperCase().trim();
    if (cleanCode.length !== 5) {
      setAnimalErrorMsg(t(lang, 'errInvalidCode'));
      return;
    }

    setAnimalErrorMsg(null);
    setAnimalLoadingAction(actionType);

    try {
      const me = buildAnimalPlayer(false);
      await animalRoomService.joinRoom(cleanCode, me, {
        onRoomUpdate: setAnimalRoom,
        onSecretUpdate: setMyAnimalSecretId,
        onSignal: animalVoice.handleSignal,
      });
      setRejoinAnimalRoom(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'CONNECTION_FAILED';
      setAnimalErrorMsg(mapAnimalError(msg));
    } finally {
      setAnimalLoadingAction(null);
    }
  };

  const handleExitAnimalRoom = async () => {
    if (animalRoom) {
      await animalRoomService.leaveRoom(animalRoom.code, myId);
    }
    animalVoice.stopMicrophone();
    setAnimalVoiceEnabled(false);
    setAnimalRoom(null);
    setMyAnimalSecretId(null);
    setRejoinAnimalRoom(null);
    setAnimalErrorMsg(null);
    startingPlayingPhaseRef.current = '';
    resolvingQuestionRef.current = '';
    resolvingGuessRef.current = '';
    revealingFinishRef.current = '';
  };

  const handleToggleFlipAnimal = (animalId: string) => {
    if (!animalRoom) return;
    soundFx.click();
    setFlippedIds((prev) => {
      const next = prev.includes(animalId)
        ? prev.filter((id) => id !== animalId)
        : [...prev, animalId];
      saveFlippedIds(animalRoom.code, myId, next);
      return next;
    });
  };

  // ---------------- Bollywood Dumb Charades Handlers ----------------
  const buildCharadesPlayer = useCallback(
    (isHost: boolean): CharadesPlayer => ({
      id: myId,
      name: playerName.trim() || authUser?.displayName || 'Player',
      avatar,
      isHost,
      team: isHost ? 'A' : null,
      connected: true,
      joinedAt: Date.now(),
      cameraEnabled: charadesMedia.cameraOn,
      micEnabled: charadesMedia.micOn,
      isMuted: !charadesMedia.micOn,
    }),
    [
      authUser?.displayName,
      avatar,
      charadesMedia.cameraOn,
      charadesMedia.micOn,
      myId,
      playerName,
    ]
  );

  const handleCreateCharadesRoom = async () => {
    if (firestoreEnabled && !authUser) {
      setCharadesErrorMsg(t(lang, 'signInRequired'));
      return;
    }
    setCharadesErrorMsg(null);
    setCharadesLoadingAction('create');

    try {
      const me = buildCharadesPlayer(true);
      let lastErr: unknown = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const code = generateRoomCode();
        try {
          await charadesRoomService.createRoom(code, me, {
            onRoomUpdate: setCharadesRoom,
            onPrivateMovieUpdate: setMyPrivateMovie,
            onSignal: charadesMedia.handleSignal,
            onReaction: pushCharadesReaction,
          });
          setRejoinCharadesRoom(null);
          lastErr = null;
          break;
        } catch (err) {
          lastErr = err;
          if (!(err instanceof Error && err.message === 'ROOM_EXISTS')) {
            throw err;
          }
        }
      }
      if (lastErr) throw lastErr;
      await charadesMedia.startMedia({ wantVideo: true, wantAudio: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'CONNECTION_FAILED';
      setCharadesErrorMsg(mapTransportError(msg));
    } finally {
      setCharadesLoadingAction(null);
    }
  };

  const handleJoinCharadesRoom = async (
    rawCode: string,
    actionType: 'join' | 'rejoin' = 'join'
  ) => {
    if (firestoreEnabled && !authUser) {
      setCharadesErrorMsg(t(lang, 'signInRequired'));
      return;
    }
    const cleanCode = rawCode.toUpperCase().trim();
    if (cleanCode.length !== 5) {
      setCharadesErrorMsg(t(lang, 'errInvalidCode'));
      return;
    }

    setCharadesErrorMsg(null);
    setCharadesLoadingAction(actionType);

    try {
      const me = buildCharadesPlayer(false);
      await charadesRoomService.joinRoom(cleanCode, me, {
        onRoomUpdate: setCharadesRoom,
        onPrivateMovieUpdate: setMyPrivateMovie,
        onSignal: charadesMedia.handleSignal,
        onReaction: pushCharadesReaction,
      });
      setRejoinCharadesRoom(null);
      await charadesMedia.startMedia({ wantVideo: true, wantAudio: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'CONNECTION_FAILED';
      setCharadesErrorMsg(mapTransportError(msg));
    } finally {
      setCharadesLoadingAction(null);
    }
  };

  const handleLeaveCharadesRoom = async () => {
    if (charadesRoom) {
      await charadesRoomService.leaveRoom(charadesRoom.code, myId);
    }
    charadesMedia.stopAllMedia();
    setCharadesRoom(null);
    setMyPrivateMovie(null);
    setRejoinCharadesRoom(null);
    setCharadesReactions([]);
    setCharadesErrorMsg(null);
  };

  // ---------------- Playing Cards Handlers ----------------
  const handleCreateCardRoom = async (selectedGame: CardGameId) => {
    if (cardEntryLockRef.current) return;
    if (firestoreEnabled && !authUser) {
      setCardErrorMsg(t(lang, 'signInRequired'));
      return;
    }
    if (firestoreEnabled && authUser && !authUser.emailVerified) {
      setCardErrorMsg(mapTransportError('AUTH_UNVERIFIED'));
      return;
    }
    cardEntryLockRef.current = true;
    setCardErrorMsg(null);
    setCardLoadingAction('create');
    try {
      const displayName = playerName.trim() || authUser?.displayName || 'Player';
      const triedCodes = new Set<string>();
      let lastErr: unknown = null;
      for (let attempt = 0; attempt < 8; attempt++) {
        let code = generateRoomCode();
        while (triedCodes.has(code)) {
          code = generateRoomCode();
        }
        triedCodes.add(code);

        try {
          await cardRoomService.createRoom(
            code,
            selectedGame,
            { id: myId, name: displayName, avatar },
            {
              onState: (next) => setCardRoom(next),
              onSignal: (sig) => cardsVoiceSignalRef.current(sig),
              onError: (codeErr) => setCardErrorMsg(mapTransportError(codeErr)),
            }
          );
          setRejoinCardRoom(null);
          lastErr = null;
          break;
        } catch (err) {
          lastErr = err;
          if (!(err instanceof Error && err.message === 'ROOM_EXISTS')) {
            throw err;
          }
        }
      }
      if (lastErr) throw lastErr;
      await cardsVoice.requestMicrophone().catch(() => {});
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'CONNECTION_FAILED';
      setCardErrorMsg(mapTransportError(msg));
    } finally {
      cardEntryLockRef.current = false;
      setCardLoadingAction(null);
    }
  };

  const handleJoinCardRoom = async (
    rawCode: string,
    actionType: 'join' | 'rejoin' = 'join'
  ) => {
    if (cardEntryLockRef.current) return;
    if (firestoreEnabled && !authUser) {
      setCardErrorMsg(t(lang, 'signInRequired'));
      return;
    }
    if (firestoreEnabled && authUser && !authUser.emailVerified) {
      setCardErrorMsg(mapTransportError('AUTH_UNVERIFIED'));
      return;
    }
    const cleanCode = rawCode.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
    if (cleanCode.length !== 5) {
      setCardErrorMsg(t(lang, 'errInvalidCode'));
      return;
    }
    cardEntryLockRef.current = true;
    setCardErrorMsg(null);
    setCardLoadingAction(actionType);
    try {
      const displayName = playerName.trim() || authUser?.displayName || 'Player';
      await cardRoomService.joinRoom(
        cleanCode,
        { id: myId, name: displayName, avatar },
        {
          onState: (next) => setCardRoom(next),
          onSignal: (sig) => cardsVoiceSignalRef.current(sig),
          onError: (codeErr) => setCardErrorMsg(mapTransportError(codeErr)),
        }
      );
      setRejoinCardRoom(null);
      await cardsVoice.requestMicrophone().catch(() => {});
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'CONNECTION_FAILED';
      setCardErrorMsg(mapTransportError(msg));
    } finally {
      cardEntryLockRef.current = false;
      setCardLoadingAction(null);
    }
  };

  const handleLeaveCardRoom = async () => {
    if (cardRoom) {
      await cardRoomService.leaveRoom(cardRoom.code, myId);
    }
    cardsVoice.stopMicrophone();
    setCardRoom(null);
    setRejoinCardRoom(null);
    setCardErrorMsg(null);
    resolvingGadhaPickRef.current = '';
    revealingCardsFinishRef.current = '';
    cardTimeoutKeyRef.current = '';
  };

  // ---------------- Draw & Guess Handlers ----------------
  const attachDrawListeners = (code: string) => {
    drawRoomService.subscribe(code, myId, {
      onRoom: (next) => {
        if (!next) {
          drawRoomService.cleanup();
          saveActiveDrawRoomCode(myId, null);
          setDrawRoom(null);
          setDrawStrokes([]);
          setDrawMessages([]);
          setMyDrawSecret(null);
          return;
        }
        setDrawRoom(next);
      },
      onStrokes: (items) => setDrawStrokes(items),
      onMessages: (items) => setDrawMessages(items),
      onSecret: (secret) => setMyDrawSecret(secret),
      onSignal: (sig) => drawVoiceSignalRef.current(sig),
      onError: (msg) => setDrawErrorMsg(msg),
    });
  };

  const handleCreateDrawRoom = async () => {
    if (drawEntryLockRef.current) return;
    if (firestoreEnabled && !authUser) {
      setDrawErrorMsg(t(lang, 'signInRequired'));
      return;
    }
    if (firestoreEnabled && authUser && !authUser.emailVerified) {
      setDrawErrorMsg(mapTransportError('AUTH_UNVERIFIED'));
      return;
    }
    drawEntryLockRef.current = true;
    setDrawErrorMsg(null);
    setDrawLoadingAction('create');
    try {
      const displayName = playerName.trim() || authUser?.displayName || 'Player';
      const created = await drawRoomService.createRoom(myId, displayName, avatar);
      setDrawRoom(created);
      setRejoinDrawRoom(null);
      attachDrawListeners(created.code);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'CONNECTION_FAILED';
      setDrawErrorMsg(mapTransportError(msg));
    } finally {
      drawEntryLockRef.current = false;
      setDrawLoadingAction(null);
    }
  };

  const handleJoinDrawRoom = async (
    rawCode: string,
    actionType: 'join' | 'rejoin' = 'join'
  ) => {
    if (drawEntryLockRef.current) return;
    if (firestoreEnabled && !authUser) {
      setDrawErrorMsg(t(lang, 'signInRequired'));
      return;
    }
    if (firestoreEnabled && authUser && !authUser.emailVerified) {
      setDrawErrorMsg(mapTransportError('AUTH_UNVERIFIED'));
      return;
    }
    const cleanCode = rawCode.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
    if (cleanCode.length !== 5) {
      setDrawErrorMsg(t(lang, 'errInvalidCode'));
      return;
    }
    drawEntryLockRef.current = true;
    setDrawErrorMsg(null);
    setDrawLoadingAction(actionType);
    try {
      const displayName = playerName.trim() || authUser?.displayName || 'Player';
      const joined = await drawRoomService.joinRoom(cleanCode, myId, displayName, avatar);
      setDrawRoom(joined);
      setRejoinDrawRoom(null);
      attachDrawListeners(joined.code);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'CONNECTION_FAILED';
      setDrawErrorMsg(mapTransportError(msg));
    } finally {
      drawEntryLockRef.current = false;
      setDrawLoadingAction(null);
    }
  };

  const handleToggleDrawVoice = async () => {
    if (drawVoiceEnabled) {
      drawVoice.stopMicrophone();
      setDrawVoiceEnabled(false);
    } else {
      setDrawVoiceEnabled(true);
      await drawVoice.requestMicrophone().catch(() => {});
    }
  };

  const handleLeaveDrawRoom = async () => {
    if (drawRoom) {
      await drawRoomService.leaveRoom(drawRoom.code, myId);
    }
    drawVoice.stopMicrophone();
    setDrawVoiceEnabled(false);
    setDrawRoom(null);
    setDrawStrokes([]);
    setDrawMessages([]);
    setMyDrawSecret(null);
    setRejoinDrawRoom(null);
    setDrawErrorMsg(null);
    drawChoicesKeyRef.current = '';
    drawRevealLockRef.current = '';
    drawAdvanceLockRef.current = '';
  };

  const inWordBattleRoom = activeGame === 'word_battle' && Boolean(room);

  const screenKey =
    activeGame === 'hub'
      ? 'hub'
      : activeGame === 'word_battle'
        ? room
          ? `wb_${room.phase}`
          : 'wb_home'
        : activeGame === 'guess_animal'
          ? animalRoom
            ? `gta_${animalRoom.phase}`
            : 'gta_menu'
          : activeGame === 'playing_cards'
            ? cardRoom
              ? `pc_${cardRoom.phase}_${cardRoom.selectedGame}`
              : 'pc_menu'
            : activeGame === 'draw_guess'
              ? drawRoom
                ? `dg_${drawRoom.phase}`
                : 'dg_menu'
              : charadesRoom
                ? `dc_${charadesRoom.phase}`
                : 'dc_menu';

  const topBarTitle =
    activeGame === 'hub'
      ? t(lang, 'hubBrand')
      : activeGame === 'guess_animal'
        ? t(lang, 'gtaTitle')
        : activeGame === 'charades'
          ? t(lang, 'dcTitle')
          : activeGame === 'playing_cards'
            ? t(lang, 'pcMenuTitle')
            : activeGame === 'draw_guess'
              ? t(lang, 'dgTitle')
              : t(lang, 'appTitle');

  const topBarSubtitle =
    activeGame === 'hub'
      ? t(lang, 'hubSubtitle')
      : activeGame === 'guess_animal'
        ? t(lang, 'gtaCardBadge')
        : activeGame === 'charades'
          ? t(lang, 'dcBadge')
          : activeGame === 'playing_cards'
            ? t(lang, 'pcBadge')
            : activeGame === 'draw_guess'
              ? t(lang, 'dgBadge')
              : t(lang, 'tagline');

  const activeRoomCode =
    activeGame === 'word_battle'
      ? room?.code
      : activeGame === 'guess_animal'
        ? animalRoom?.code
        : activeGame === 'charades'
          ? charadesRoom?.code
          : activeGame === 'playing_cards'
            ? cardRoom?.code
            : activeGame === 'draw_guess'
              ? drawRoom?.code
              : undefined;

  if (inWordBattleRoom && room) {
    return (
      <>
        <WordRoomShell
          lang={lang}
          room={room}
          myId={myId}
          speakingIds={speakingIds}
          micStatus={micStatus}
          isMuted={isMuted}
          onToggleMute={toggleMute}
          onRetryMic={requestMicrophone}
          onLeaveRoom={handleLeaveRoom}
          onToggleLang={handleToggleLang}
          sfxEnabled={sfxEnabled}
          onToggleSfx={handleToggleSfx}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={screenKey}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            >
              {room.phase === 'lobby' ? (
                <LobbyScreen
                  lang={lang}
                  room={room}
                  myId={myId}
                  onUpdateSettings={handleUpdateSettings}
                  onStartGame={handleStartGame}
                />
              ) : room.phase === 'reveal' ? (
                <RoleRevealScreen
                  lang={lang}
                  room={room}
                  myId={myId}
                  onMarkReady={handleMarkReady}
                  onForceStartDiscussion={handleStartDiscussion}
                />
              ) : room.phase === 'discussion' ? (
                <DiscussionScreen
                  lang={lang}
                  room={room}
                  myId={myId}
                  speakingIds={speakingIds}
                  onAdvanceTurn={handleAdvanceTurn}
                  onForceVoting={handleForceVoting}
                />
              ) : room.phase === 'voting' ? (
                <VotingScreen
                  lang={lang}
                  room={room}
                  myId={myId}
                  speakingIds={speakingIds}
                  onCastVote={handleCastVote}
                  onForceRevealResults={finalizeVoting}
                />
              ) : (
                <ResultScreen
                  lang={lang}
                  room={room}
                  myId={myId}
                  speakingIds={speakingIds}
                  onPlayAgain={handlePlayAgain}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </WordRoomShell>

        <FirebaseGuideModal
          open={showFirebaseGuide}
          onClose={() => setShowFirebaseGuide(false)}
        />
      </>
    );
  }

  return (
    <div
      className={`min-h-screen flex flex-col ${
        activeGame === 'guess_animal'
          ? 'bg-[#FEF9EC] text-slate-900'
          : activeGame === 'charades'
            ? 'bg-[#0E071B] text-slate-100'
            : activeGame === 'playing_cards'
              ? 'bg-[#141816] text-[#FAF7F0]'
              : 'bg-[#0B0F17] text-slate-100'
      }`}
    >
      <TopBar
        lang={lang}
        onToggleLang={handleToggleLang}
        title={topBarTitle}
        subtitle={topBarSubtitle}
        roomCode={activeRoomCode}
        onLeaveRoom={undefined}
        onBackToHub={
          activeGame !== 'hub' && !room && !animalRoom && !charadesRoom && !cardRoom && !drawRoom
            ? () => {
                setErrorMsg(null);
                setAnimalErrorMsg(null);
                setCharadesErrorMsg(null);
                setCardErrorMsg(null);
                setDrawErrorMsg(null);
                setActiveGame('hub');
              }
            : undefined
        }
        sfxEnabled={sfxEnabled}
        onToggleSfx={handleToggleSfx}
      />

      <main className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={screenKey}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            {activeGame === 'hub' ? (
              <GameHubScreen
                lang={lang}
                playerName={playerName}
                setPlayerName={setPlayerName}
                avatar={avatar}
                setAvatar={setAvatar}
                authReady={authReady}
                authUser={authUser}
                onSignIn={handleSignIn}
                onSignOut={handleSignOut}
                signingIn={signingIn}
                errorMsg={errorMsg}
                onSelectWordBattle={() => setActiveGame('word_battle')}
                onSelectGuessAnimal={() => setActiveGame('guess_animal')}
                onSelectDumbCharades={() => setActiveGame('charades')}
                onSelectPlayingCards={() => setActiveGame('playing_cards')}
                onSelectDrawGuess={() => setActiveGame('draw_guess')}
              />
            ) : activeGame === 'word_battle' ? (
              <HomeScreen
                lang={lang}
                playerName={playerName}
                setPlayerName={setPlayerName}
                avatar={avatar}
                setAvatar={setAvatar}
                initialJoinCode={initialJoinCode}
                onCreateRoom={handleCreateRoom}
                onJoinRoom={handleJoinRoom}
                onOpenFirebaseGuide={() => setShowFirebaseGuide(true)}
                errorMsg={errorMsg}
                loadingAction={loadingAction}
                authReady={authReady}
                authUser={authUser}
                onSignIn={handleSignIn}
                onSignOut={handleSignOut}
                signingIn={signingIn}
              />
            ) : activeGame === 'guess_animal' ? (
              !animalRoom ? (
                <GuessAnimalMenuScreen
                  lang={lang}
                  playerName={playerName}
                  authReady={authReady}
                  authUser={authUser}
                  signingIn={signingIn}
                  onSignIn={handleSignIn}
                  onCreateRoom={handleCreateAnimalRoom}
                  onJoinRoom={(code) => handleJoinAnimalRoom(code, 'join')}
                  onBack={() => {
                    setAnimalErrorMsg(null);
                    setActiveGame('hub');
                  }}
                  rejoinRoom={rejoinAnimalRoom}
                  onRejoin={(code) => handleJoinAnimalRoom(code, 'rejoin')}
                  onDismissRejoin={() => {
                    if (authUser) saveActiveAnimalRoomCode(authUser.uid, null);
                    setRejoinAnimalRoom(null);
                  }}
                  errorMsg={animalErrorMsg}
                  loadingAction={animalLoadingAction}
                />
              ) : animalRoom.phase === 'lobby' ? (
                <GuessAnimalLobbyScreen
                  lang={lang}
                  room={animalRoom}
                  myId={myId}
                  speakingIds={animalVoice.speakingIds}
                  voiceEnabled={animalVoiceEnabled}
                  micStatus={animalVoice.micStatus}
                  isMuted={animalVoice.isMuted}
                  onToggleVoice={handleToggleAnimalVoice}
                  onToggleMute={animalVoice.toggleMute}
                  onStartMatch={() => animalRoomService.startMatch(animalRoom.code, animalRoom)}
                  onExit={handleExitAnimalRoom}
                />
              ) : (
                <GuessAnimalGameScreen
                  lang={lang}
                  room={animalRoom}
                  myId={myId}
                  mySecretAnimalId={myAnimalSecretId}
                  flippedIds={flippedIds}
                  onToggleFlip={handleToggleFlipAnimal}
                  onLockSecret={(animalId) =>
                    animalRoomService.submitSecretAnimal(animalRoom.code, myId, animalId)
                  }
                  onAskQuestion={(category: QuestionCategoryId, option: AnimalTraitOption) =>
                    animalRoomService.askQuestion(
                      animalRoom.code,
                      myId,
                      category,
                      option,
                      animalRoom.askedCategoriesThisTurn
                    )
                  }
                  onEndTurn={() =>
                    animalRoomService.endTurn(
                      animalRoom.code,
                      animalRoom.turnUid ?? myId,
                      animalRoom.playerIds
                    )
                  }
                  onSubmitGuess={(animalId) =>
                    animalRoomService.submitGuess(animalRoom.code, myId, animalId)
                  }
                  onPlayAgain={async () => {
                    startingPlayingPhaseRef.current = '';
                    resolvingQuestionRef.current = '';
                    resolvingGuessRef.current = '';
                    revealingFinishRef.current = '';
                    await animalRoomService.playAgain(animalRoom.code, myId, animalRoom);
                  }}
                  onExit={handleExitAnimalRoom}
                  voiceEnabled={animalVoiceEnabled}
                  micStatus={animalVoice.micStatus}
                  isMuted={animalVoice.isMuted}
                  speakingIds={animalVoice.speakingIds}
                  onToggleVoice={handleToggleAnimalVoice}
                  onToggleMute={animalVoice.toggleMute}
                />
              )
            ) : activeGame === 'playing_cards' ? (
              !cardRoom ? (
                <PlayingCardsMenuScreen
                  lang={lang}
                  playerName={playerName}
                  initialJoinCode={initialCardsCode}
                  authReady={authReady}
                  authUser={authUser}
                  signingIn={signingIn}
                  onSignIn={handleSignIn}
                  onCreateRoom={handleCreateCardRoom}
                  onJoinRoom={(code) => handleJoinCardRoom(code, 'join')}
                  onBack={() => {
                    setCardErrorMsg(null);
                    setActiveGame('hub');
                  }}
                  rejoinRoom={rejoinCardRoom}
                  onRejoin={(code) => handleJoinCardRoom(code, 'rejoin')}
                  onDismissRejoin={() => {
                    saveActiveCardRoomCode(myId, null);
                    setRejoinCardRoom(null);
                  }}
                  errorMsg={cardErrorMsg}
                  onDismissError={() => setCardErrorMsg(null)}
                  loadingAction={cardLoadingAction}
                />
              ) : cardRoom.phase === 'lobby' ? (
                <PlayingCardsLobbyScreen
                  lang={lang}
                  room={cardRoom}
                  myId={myId}
                  speakingIds={cardsVoice.speakingIds}
                  micStatus={cardsVoice.micStatus}
                  isMuted={cardsVoice.isMuted}
                  localMutedPeers={cardsVoice.localMutedPeers}
                  peerStates={cardsVoice.peerStates}
                  onRequestMic={cardsVoice.requestMicrophone}
                  onToggleMute={cardsVoice.toggleMute}
                  onTogglePeerMute={cardsVoice.togglePeerMute}
                  onReconnectVoice={cardsVoice.reconnectVoice}
                  onToggleReady={async (ready) => {
                    try {
                      setCardErrorMsg(null);
                      await cardRoomService.setReady(cardRoom.code, myId, ready);
                    } catch (err) {
                      setCardErrorMsg(err instanceof Error ? err.message : 'Failed');
                    }
                  }}
                  onUpdateConfig={async (payload) => {
                    try {
                      setCardErrorMsg(null);
                      await cardRoomService.updateConfig(cardRoom.code, myId, payload);
                    } catch (err) {
                      setCardErrorMsg(err instanceof Error ? err.message : 'Failed');
                    }
                  }}
                  onStartGame={async () => {
                    try {
                      setCardErrorMsg(null);
                      await cardRoomService.startGame(cardRoom.code, myId);
                    } catch (err) {
                      setCardErrorMsg(
                        err instanceof Error ? err.message.replace(/_/g, ' ') : 'Could not start game'
                      );
                    }
                  }}
                  onLeaveRoom={handleLeaveCardRoom}
                  errorMsg={cardErrorMsg}
                />
              ) : (
                <PlayingCardsTableScreen
                  lang={lang}
                  room={cardRoom}
                  myId={myId}
                  speakingIds={cardsVoice.speakingIds}
                  micStatus={cardsVoice.micStatus}
                  isMuted={cardsVoice.isMuted}
                  localMutedPeers={cardsVoice.localMutedPeers}
                  peerStates={cardsVoice.peerStates}
                  onRequestMic={cardsVoice.requestMicrophone}
                  onToggleMute={cardsVoice.toggleMute}
                  onTogglePeerMute={cardsVoice.togglePeerMute}
                  onReconnectVoice={cardsVoice.reconnectVoice}
                  onAction={async (action) => {
                    await cardRoomService.sendAction(cardRoom.code, myId, action);
                  }}
                  onPlayAgain={async (mode) => {
                    resolvingGadhaPickRef.current = '';
                    revealingCardsFinishRef.current = '';
                    cardTimeoutKeyRef.current = '';
                    await cardRoomService.playAgain(cardRoom.code, myId, mode);
                  }}
                  onLeaveRoom={handleLeaveCardRoom}
                />
              )
            ) : activeGame === 'draw_guess' ? (
              !drawRoom ? (
                <DrawMenuScreen
                  lang={lang}
                  playerName={playerName}
                  initialJoinCode={initialDrawCode}
                  authReady={authReady}
                  authUser={authUser}
                  signingIn={signingIn}
                  onSignIn={handleSignIn}
                  onCreateRoom={handleCreateDrawRoom}
                  onJoinRoom={(code) => handleJoinDrawRoom(code, 'join')}
                  onBack={() => {
                    setDrawErrorMsg(null);
                    setActiveGame('hub');
                  }}
                  rejoinRoom={rejoinDrawRoom}
                  onRejoin={(code) => handleJoinDrawRoom(code, 'rejoin')}
                  onDismissRejoin={() => {
                    saveActiveDrawRoomCode(myId, null);
                    setRejoinDrawRoom(null);
                  }}
                  errorMsg={drawErrorMsg}
                  loadingAction={drawLoadingAction}
                />
              ) : drawRoom.phase === 'lobby' ? (
                <DrawLobbyScreen
                  lang={lang}
                  room={drawRoom}
                  myId={myId}
                  speakingIds={drawVoice.speakingIds}
                  voiceEnabled={drawVoiceEnabled}
                  micStatus={drawVoice.micStatus}
                  isMuted={drawVoice.isMuted}
                  onToggleVoice={handleToggleDrawVoice}
                  onToggleMute={drawVoice.toggleMute}
                  onUpdateSettings={async (settings) => {
                    try {
                      setDrawErrorMsg(null);
                      await drawRoomService.updateSettings(drawRoom.code, settings);
                    } catch (err) {
                      setDrawErrorMsg(err instanceof Error ? err.message : 'Failed');
                    }
                  }}
                  onStartGame={async () => {
                    try {
                      setDrawErrorMsg(null);
                      drawChoicesKeyRef.current = '';
                      drawRevealLockRef.current = '';
                      drawAdvanceLockRef.current = '';
                      await drawRoomService.startGame(drawRoom.code, drawRoom);
                    } catch (err) {
                      setDrawErrorMsg(
                        err instanceof Error ? err.message.replace(/_/g, ' ') : 'Could not start'
                      );
                    }
                  }}
                  onLeaveRoom={handleLeaveDrawRoom}
                  errorMsg={drawErrorMsg}
                />
              ) : (
                <DrawGameScreen
                  lang={lang}
                  room={drawRoom}
                  myId={myId}
                  mySecret={myDrawSecret}
                  strokes={drawStrokes}
                  messages={drawMessages}
                  speakingIds={drawVoice.speakingIds}
                  voiceEnabled={drawVoiceEnabled}
                  isMuted={drawVoice.isMuted}
                  onToggleVoice={handleToggleDrawVoice}
                  onToggleMute={drawVoice.toggleMute}
                  onSelectWord={(word) =>
                    drawRoomService.selectWord(drawRoom.code, drawRoom, myId, word)
                  }
                  onCreateStroke={(stroke) => drawRoomService.createStroke(drawRoom.code, stroke)}
                  onUpdateStrokePoints={(strokeId, points) =>
                    drawRoomService.updateStrokePoints(drawRoom.code, strokeId, points)
                  }
                  onUndoStroke={(strokeId) => drawRoomService.deleteStroke(drawRoom.code, strokeId)}
                  onClearCanvas={() =>
                    drawRoom.turn
                      ? drawRoomService.clearCanvas(drawRoom.code, drawRoom.turn)
                      : Promise.resolve()
                  }
                  onSubmitGuess={(text) => {
                    const myName =
                      drawRoom.players[myId]?.name ||
                      playerName.trim() ||
                      authUser?.displayName ||
                      'Player';
                    return drawRoomService.submitGuess(drawRoom.code, drawRoom, myId, myName, text);
                  }}
                  onNextTurn={() => drawRoomService.advanceNextTurn(drawRoom.code, drawRoom)}
                  onPlayAgain={async () => {
                    drawChoicesKeyRef.current = '';
                    drawRevealLockRef.current = '';
                    drawAdvanceLockRef.current = '';
                    await drawRoomService.startGame(drawRoom.code, drawRoom);
                  }}
                  onBackToLobby={() => drawRoomService.backToLobby(drawRoom.code, drawRoom)}
                  onLeaveRoom={handleLeaveDrawRoom}
                />
              )
            ) : !charadesRoom ? (
              <CharadesMenuScreen
                lang={lang}
                playerName={playerName}
                initialJoinCode={initialCharadesCode}
                authReady={authReady}
                authUser={authUser}
                signingIn={signingIn}
                onSignIn={handleSignIn}
                onCreateRoom={handleCreateCharadesRoom}
                onJoinRoom={(code) => handleJoinCharadesRoom(code, 'join')}
                onBack={() => {
                  setCharadesErrorMsg(null);
                  setActiveGame('hub');
                }}
                rejoinRoom={rejoinCharadesRoom}
                onRejoin={(code) => handleJoinCharadesRoom(code, 'rejoin')}
                onDismissRejoin={() => {
                  if (authUser) saveActiveCharadesRoomCode(authUser.uid, null);
                  setRejoinCharadesRoom(null);
                }}
                errorMsg={charadesErrorMsg}
                loadingAction={charadesLoadingAction}
              />
            ) : charadesRoom.phase === 'lobby' ? (
              <CharadesLobbyScreen
                lang={lang}
                room={charadesRoom}
                myId={myId}
                localStream={charadesMedia.localStream}
                cameraOn={charadesMedia.cameraOn}
                micOn={charadesMedia.micOn}
                camStatus={charadesMedia.camStatus}
                micStatus={charadesMedia.micStatus}
                facingMode={charadesMedia.facingMode}
                turnConfigured={charadesMedia.turnConfigured}
                mediaNotice={charadesMedia.mediaNotice}
                speakingIds={charadesMedia.speakingIds}
                reactions={charadesReactions}
                onStartCameraAndMic={async () => {
                  await charadesMedia.startMedia({ wantVideo: true, wantAudio: true });
                }}
                onToggleCamera={charadesMedia.toggleCamera}
                onToggleMic={charadesMedia.toggleMic}
                onSwitchCamera={charadesMedia.switchCamera}
                onUpdateHostPatch={(patch) =>
                  charadesRoomService.updateHostRoomPatch(charadesRoom.code, patch)
                }
                onStartRound={(config) =>
                  charadesRoomService.startRoundSetup(charadesRoom.code, charadesRoom, config)
                }
                onRemoveDisconnected={(targetUid) =>
                  charadesRoomService.removeDisconnectedPlayer(
                    charadesRoom.code,
                    charadesRoom,
                    targetUid
                  )
                }
                onLeaveRoom={handleLeaveCharadesRoom}
              />
            ) : (
              <CharadesGameScreen
                lang={lang}
                room={charadesRoom}
                myId={myId}
                privateMovie={myPrivateMovie}
                localStream={charadesMedia.localStream}
                remoteStreams={charadesMedia.remoteStreams}
                peerStates={charadesMedia.peerStates}
                speakingIds={charadesMedia.speakingIds}
                reactions={charadesReactions}
                cameraOn={charadesMedia.cameraOn}
                micOn={charadesMedia.micOn}
                facingMode={charadesMedia.facingMode}
                mediaNotice={charadesMedia.mediaNotice}
                onToggleCamera={charadesMedia.toggleCamera}
                onToggleMic={charadesMedia.toggleMic}
                onSwitchCamera={charadesMedia.switchCamera}
                onAssignMovie={(payload) =>
                  charadesRoomService.assignMovie(
                    charadesRoom.code,
                    myId,
                    charadesRoom.actorIds,
                    payload.title,
                    payload.category,
                    payload.language,
                    payload.difficulty,
                    payload.hintsEnabled
                  )
                }
                onUpdateHostPatch={(patch) =>
                  charadesRoomService.updateHostRoomPatch(charadesRoom.code, patch)
                }
                onUpdateMovieMeta={(meta) =>
                  charadesRoomService.updateMovieMeta(charadesRoom.code, meta)
                }
                onMarkWrongGuess={() =>
                  charadesRoomService.markWrongGuess(
                    charadesRoom.code,
                    charadesRoom.guessFeedback.count
                  )
                }
                onRevealMovie={(options) => {
                  if (!myPrivateMovie) return Promise.resolve();
                  return charadesRoomService.revealRoundMovie(
                    charadesRoom.code,
                    charadesRoom,
                    myPrivateMovie,
                    options
                  );
                }}
                onStartRoundSetup={(config) =>
                  charadesRoomService.startRoundSetup(charadesRoom.code, charadesRoom, config)
                }
                onBackToLobby={() =>
                  charadesRoomService.updateHostRoomPatch(charadesRoom.code, {
                    phase: 'lobby',
                    pausedFromPhase: null,
                    movieMeta: null,
                    revealedMovie: null,
                    guessFeedback: { status: 'none', count: 0, updatedAt: Date.now() },
                  })
                }
                onRestartMatch={() =>
                  charadesRoomService.updateHostRoomPatch(charadesRoom.code, {
                    phase: 'lobby',
                    pausedFromPhase: null,
                    roundNumber: 0,
                    movieMeta: null,
                    revealedMovie: null,
                    guessFeedback: { status: 'none', count: 0, updatedAt: Date.now() },
                    scores: { teamA: 0, teamB: 0, players: {} },
                  })
                }
                onLeaveRoom={handleLeaveCharadesRoom}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer
        className={`text-center text-xs px-4 py-4 ${
          activeGame === 'guess_animal'
            ? 'border-t border-amber-200 text-slate-600'
            : 'border-t border-slate-800/60 text-slate-400'
        } ${
          activeGame === 'charades' && charadesRoom && charadesRoom.phase !== 'lobby'
            ? 'pb-24'
            : ''
        }`}
      >
        Developed by{' '}
        <span
          className={
            activeGame === 'guess_animal'
              ? 'text-slate-900 font-bold'
              : 'text-slate-200 font-semibold'
          }
        >
          Siddharth Trivedi
        </span>
      </footer>

      <FirebaseGuideModal
        open={showFirebaseGuide}
        onClose={() => setShowFirebaseGuide(false)}
      />
    </div>
  );
}
