/**
 * Imposter Word — Multiplayer Social Deduction Party Game
 *
 * Firebase Realtime Database config placeholder & setup instructions live at the
 * top of `src/firebaseConfig.ts` (imported below as `FIREBASE_CONFIG`).
 * While placeholder values are present, the app uses its built-in WebSocket
 * room server so multiplayer and WebRTC voice chat work out of the box.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { FIREBASE_CONFIG } from './firebaseConfig';
import {
  ClueEntry,
  GameSettings,
  Language,
  Player,
  PlayerAvatar,
  RoomState,
} from './types/game';
import { t } from './data/i18n';
import {
  computeRoundOutcome,
  createRoundSetup,
  generatePlayerId,
  generateRoomCode,
  getSortedPlayers,
} from './utils/gameLogic';
import { roomTransport } from './services/roomTransport';
import { useVoiceChat } from './hooks/useVoiceChat';
import { soundFx } from './utils/soundFx';
import { AVATAR_COLORS, AVATAR_EMOJIS } from './components/Avatar';
import { TopBar } from './components/TopBar';
import { VoiceBar } from './components/VoiceBar';
import { FirebaseGuideModal } from './components/FirebaseGuideModal';
import { HomeScreen } from './screens/HomeScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { RoleRevealScreen } from './screens/RoleRevealScreen';
import { DiscussionScreen } from './screens/DiscussionScreen';
import { VotingScreen } from './screens/VotingScreen';
import { ResultScreen } from './screens/ResultScreen';

// Reference config so tree-shaking never strips FIREBASE_CONFIG metadata
void FIREBASE_CONFIG;

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

  const [myId] = useState<string>(initial.id);
  const [lang, setLang] = useState<Language>(initial.lang);
  const [playerName, setPlayerName] = useState<string>(initial.name);
  const [avatar, setAvatar] = useState<PlayerAvatar>(initial.avatar);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<'create' | 'join' | null>(null);
  const [showFirebaseGuide, setShowFirebaseGuide] = useState(false);
  const [sfxEnabled, setSfxEnabled] = useState(true);

  const initialJoinCode = useMemo(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return (params.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
    } catch {
      return '';
    }
  }, []);

  const roomRef = useRef<RoomState | null>(null);
  roomRef.current = room;

  const lastTurnAdvanceKeyRef = useRef<string>('');
  const advancingResultRef = useRef<boolean>(false);

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

  const {
    micStatus,
    isMuted,
    speakingIds,
    requestMicrophone,
    toggleMute,
    handleSignal,
  } = useVoiceChat(myId, Boolean(room), room?.players);

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
      switch (code) {
        case 'ROOM_NOT_FOUND':
          return t(lang, 'errRoomNotFound');
        case 'ROOM_FULL':
          return t(lang, 'errRoomFull');
        case 'GAME_IN_PROGRESS':
          return t(lang, 'errGameInProgress');
        case 'CONNECTION_FAILED':
          return t(lang, 'errConnectionFailed');
        case 'DISCONNECTED':
          return t(lang, 'errDisconnected');
        default:
          return t(lang, 'errConnectionFailed');
      }
    },
    [lang]
  );

  const buildLocalPlayer = useCallback(
    (isHost: boolean): Player => ({
      id: myId,
      name: playerName.trim(),
      avatar,
      isHost,
      connected: true,
      joinedAt: Date.now(),
      score: 0,
      isMuted: false,
      readyForDiscussion: false,
    }),
    [avatar, myId, playerName]
  );

  const handleCreateRoom = async () => {
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
      const msg = err instanceof Error ? err.message : 'UNKNOWN';
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
    if (playersList.length < 3) return;

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

  // Host auto-advances from reveal -> discussion once all players are ready
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

  // Host auto-reveals voting results once all players have locked in
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

  const playersList = room ? getSortedPlayers(room.players) : [];
  const speakingNames = playersList
    .filter((p) => speakingIds[p.id])
    .map((p) => p.name);

  const screenKey = room ? room.phase : 'home';

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col">
      <TopBar
        lang={lang}
        onToggleLang={handleToggleLang}
        roomCode={room?.code}
        onLeaveRoom={room ? handleLeaveRoom : undefined}
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
            {!room ? (
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
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {room && (
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
