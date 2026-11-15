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
  isFirestoreConfigured,
  signInWithGoogle,
  signOutFirebase,
} from './firebase';
import { FIREBASE_CONFIG } from './firebaseConfig';
import {
  ClueEntry,
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
import { useVoiceChat, VoiceTransportAdapter } from './hooks/useVoiceChat';
import { soundFx } from './utils/soundFx';
import { AVATAR_COLORS, AVATAR_EMOJIS } from './components/Avatar';
import { TopBar } from './components/TopBar';
import { VoiceBar } from './components/VoiceBar';
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

void FIREBASE_CONFIG;

type ActiveHubSection = 'hub' | 'word_battle' | 'guess_animal';

function loadStoredProfile() {
  try {
    const id = localStorage.getItem('iw_player_id') || generatePlayerId();
    localStorage.setItem('iw_player_id', id);
    const name = localStorage.getItem('iw_player_name') || '';
    const lang = (localStorage.getItem('iw_lang') as Language) || 'en';
    const rawAvatar = localStorage.getItem('iw_avatar');
    const avatar: PlayerAvatar = rawAvatar
      ? JSON.parse(rawAvatar)
      : {
          type: 'emoji',
          emoji: AVATAR_EMOJIS[Math.floor(Math.random() * AVATAR_EMOJIS.length)],
          color: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
        };
    return { id, name, lang, avatar };
  } catch {
    return {
      id: generatePlayerId(),
      name: '',
      lang: 'en' as Language,
      avatar: { type: 'emoji' as const, emoji: '🦊', color: AVATAR_COLORS[0] },
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

  const [activeGame, setActiveGame] = useState<ActiveHubSection>(() =>
    initialJoinCode ? 'word_battle' : 'hub'
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

  const myId = firestoreEnabled && authUser ? authUser.uid : initial.id;

  const roomRef = useRef<RoomState | null>(null);
  roomRef.current = room;

  const lastTurnAdvanceKeyRef = useRef<string>('');
  const advancingResultRef = useRef<boolean>(false);
  const startingPlayingPhaseRef = useRef<string>('');
  const resolvingQuestionRef = useRef<string>('');
  const resolvingGuessRef = useRef<string>('');
  const revealingFinishRef = useRef<string>('');

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
        setRoom(null);
        setAnimalRoom(null);
        setMyAnimalSecretId(null);
        setRejoinAnimalRoom(null);
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

  const handleSignIn = async () => {
    setErrorMsg(null);
    setAnimalErrorMsg(null);
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign-in failed';
      setErrorMsg(msg);
      setAnimalErrorMsg(msg);
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await roomTransport.leaveRoom();
    if (animalRoom) {
      await animalRoomService.leaveRoom(animalRoom.code, myId);
    }
    setRoom(null);
    setAnimalRoom(null);
    setMyAnimalSecretId(null);
    setRejoinAnimalRoom(null);
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
    (code: string) => {
      if (code.startsWith('CONNECTION_FAILED:')) {
        const detail = code.slice('CONNECTION_FAILED:'.length);
        console.error('Room connection error:', detail);
        return `${t(lang, 'errConnectionFailed')} (${detail})`;
      }
      switch (code) {
        case 'ROOM_NOT_FOUND':
          return t(lang, 'errRoomNotFound');
        case 'ROOM_FULL':
          return t(lang, 'errRoomFull');
        case 'GAME_IN_PROGRESS':
          return t(lang, 'errGameInProgress');
        case 'AUTH_REQUIRED':
          return t(lang, 'signInRequired');
        case 'CONNECTION_FAILED':
          return t(lang, 'errConnectionFailed');
        case 'DISCONNECTED':
          return t(lang, 'errDisconnected');
        default:
          console.error('Unexpected room error:', code);
          return `${t(lang, 'errConnectionFailed')} (${code})`;
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

  const handleSendClue = (text: string) => {
    if (!room || !room.roundConfig) return;
    const me = room.players[myId];
    if (!me) return;
    const clue: ClueEntry = {
      id: `${Date.now()}_${myId}`,
      playerId: myId,
      playerName: me.name,
      round: room.roundConfig.currentRound,
      text,
      createdAt: Date.now(),
    };
    roomTransport.addClue(clue);
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

  const playersList = room ? getSortedPlayers(room.players) : [];
  const speakingNames = playersList
    .filter((p) => speakingIds[p.id])
    .map((p) => p.name);

  const screenKey =
    activeGame === 'hub'
      ? 'hub'
      : activeGame === 'word_battle'
        ? room
          ? `wb_${room.phase}`
          : 'wb_home'
        : animalRoom
          ? `gta_${animalRoom.phase}`
          : 'gta_menu';

  const topBarTitle =
    activeGame === 'hub'
      ? t(lang, 'hubBrand')
      : activeGame === 'guess_animal'
        ? t(lang, 'gtaTitle')
        : t(lang, 'appTitle');

  const topBarSubtitle =
    activeGame === 'hub'
      ? t(lang, 'hubSubtitle')
      : activeGame === 'guess_animal'
        ? t(lang, 'gtaCardBadge')
        : t(lang, 'tagline');

  const activeRoomCode =
    activeGame === 'word_battle'
      ? room?.code
      : activeGame === 'guess_animal'
        ? animalRoom?.code
        : undefined;

  return (
    <div
      className={`min-h-screen flex flex-col ${
        activeGame === 'guess_animal'
          ? 'bg-[#FEF9EC] text-slate-900'
          : 'bg-[#0B0F17] text-slate-100'
      }`}
    >
      <TopBar
        lang={lang}
        onToggleLang={handleToggleLang}
        title={topBarTitle}
        subtitle={topBarSubtitle}
        roomCode={activeRoomCode}
        onLeaveRoom={activeGame === 'word_battle' && room ? handleLeaveRoom : undefined}
        onBackToHub={
          activeGame !== 'hub' && !room && !animalRoom
            ? () => {
                setErrorMsg(null);
                setAnimalErrorMsg(null);
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
              />
            ) : activeGame === 'word_battle' ? (
              !room ? (
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
              ) : room.phase === 'lobby' ? (
                <LobbyScreen
                  lang={lang}
                  room={room}
                  myId={myId}
                  speakingIds={speakingIds}
                  onUpdateSettings={handleUpdateSettings}
                  onStartGame={handleStartGame}
                />
              ) : room.phase === 'reveal' ? (
                <RoleRevealScreen
                  lang={lang}
                  room={room}
                  myId={myId}
                  speakingIds={speakingIds}
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
                  onSendClue={handleSendClue}
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
              )
            ) : !animalRoom ? (
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
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer
        className={`text-center text-xs px-4 py-4 ${
          activeGame === 'guess_animal'
            ? 'border-t border-amber-200 text-slate-600'
            : 'border-t border-slate-800/60 text-slate-400'
        } ${activeGame === 'word_battle' && room ? 'pb-24' : ''}`}
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

      {activeGame === 'word_battle' && room && (
        <VoiceBar
          lang={lang}
          micStatus={micStatus}
          isMuted={isMuted}
          isSpeaking={Boolean(speakingIds[myId])}
          onToggleMute={toggleMute}
          onRetryMic={requestMicrophone}
          speakingNames={speakingNames}
          players={playersList}
        />
      )}

      <FirebaseGuideModal
        open={showFirebaseGuide}
        onClose={() => setShowFirebaseGuide(false)}
      />
    </div>
  );
}
