import React, { useState } from 'react';
import {
  BookOpen,
  Check,
  CheckCircle2,
  Circle,
  Copy,
  Crown,
  Link2,
  LogOut,
  Play,
  Sliders,
  Users,
} from 'lucide-react';
import type { MicPermissionState } from '../hooks/useVoiceChat';
import type {
  CardGameId,
  CardGameSettingsMap,
  CardRoomClientState,
  TurnTimerOption,
} from '../types/cardGames';
import type { Language } from '../types/game';
import { CARD_GAMES_INFO, CARD_GAME_ORDER } from '../data/cardGamesInfo';
import { t } from '../data/i18n';
import { Avatar } from '../components/Avatar';
import { CardVoicePanel } from '../components/cards/CardVoicePanel';
import { CardRulesModal } from '../components/cards/CardRulesModal';

interface PlayingCardsLobbyScreenProps {
  lang: Language;
  room: CardRoomClientState;
  myId: string;
  speakingIds: Record<string, boolean>;
  micStatus: MicPermissionState;
  isMuted: boolean;
  localMutedPeers: Record<string, boolean>;
  peerStates: Record<string, RTCPeerConnectionState>;
  onRequestMic: () => Promise<unknown>;
  onToggleMute: () => void;
  onTogglePeerMute: (peerId: string) => void;
  onReconnectVoice: () => void;
  onToggleReady: (ready: boolean) => Promise<void>;
  onUpdateConfig: (payload: {
    selectedGame?: CardGameId;
    settings?: Partial<CardGameSettingsMap>;
  }) => Promise<void>;
  onStartGame: () => Promise<void>;
  onLeaveRoom: () => Promise<void>;
  errorMsg: string | null;
}

export const PlayingCardsLobbyScreen: React.FC<PlayingCardsLobbyScreenProps> = ({
  lang,
  room,
  myId,
  speakingIds,
  micStatus,
  isMuted,
  localMutedPeers,
  peerStates,
  onRequestMic,
  onToggleMute,
  onTogglePeerMute,
  onReconnectVoice,
  onToggleReady,
  onUpdateConfig,
  onStartGame,
  onLeaveRoom,
  errorMsg,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [rulesGame, setRulesGame] = useState<CardGameId | null>(null);
  const [starting, setStarting] = useState(false);

  const isHost = room.hostId === myId;
  const playersList = Object.values(room.players).sort(
    (a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id)
  );
  const me = room.players[myId];
  const selectedMeta = CARD_GAMES_INFO[room.selectedGame];
  const connectedCount = playersList.filter((p) => p.connected).length;
  const canStart =
    connectedCount >= selectedMeta.minPlayers && connectedCount <= selectedMeta.maxPlayers;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(room.code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1800);
    } catch {
      // Ignore clipboard failures
    }
  };

  const handleCopyInviteLink = async () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('room');
      url.searchParams.delete('charades');
      url.searchParams.set('cards', room.code);
      await navigator.clipboard.writeText(url.toString());
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Ignore clipboard failures
    }
  };

  const handleStart = async () => {
    setStarting(true);
    try {
      await onStartGame();
    } finally {
      setStarting(false);
    }
  };

  const renderTimerButtons = (
    current: TurnTimerOption,
    onChange: (val: TurnTimerOption) => void
  ) => (
    <div className="flex flex-wrap gap-1.5">
      {([0, 20, 30, 45] as TurnTimerOption[]).map((sec) => (
        <button
          key={sec}
          type="button"
          disabled={!isHost}
          onClick={() => onChange(sec)}
          className={`min-h-[36px] px-3 rounded-lg text-xs font-mono-nums font-bold border transition-colors ${
            current === sec
              ? 'bg-[#173326] text-[#FAF7F0] border-[#173326]'
              : 'bg-[#FAF7F0] text-[#3B281E] border-[#D9CEB8] hover:bg-[#EFE8DA]'
          } disabled:opacity-70`}
        >
          {sec === 0 ? t(lang, 'pcOff') : `${sec}s`}
        </button>
      ))}
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-5 sm:py-7 space-y-5 text-[#FAF7F0]">
      {/* Top Room Code & Share Strip */}
      <div className="rounded-3xl bg-[#173326] border border-[#3B281E] shadow-xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-[#C5A059] font-semibold uppercase tracking-wider">
            <span>{t(lang, 'pcLobbyTitle')}</span>
            <span>·</span>
            <span>{selectedMeta.name}</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono-nums text-3xl sm:text-4xl font-extrabold tracking-[0.2em] text-[#FAF7F0]">
              {room.code}
            </span>
            <button
              type="button"
              onClick={handleCopyCode}
              className="min-h-[40px] px-3.5 rounded-xl bg-[#12261C] hover:bg-[#1C3A2B] border border-[#C5A059]/35 text-xs font-semibold text-[#FAF7F0] flex items-center gap-1.5"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-[#C5A059]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCode ? t(lang, 'copied') : t(lang, 'copyCode')}</span>
            </button>
            <button
              type="button"
              onClick={handleCopyInviteLink}
              className="min-h-[40px] px-3.5 rounded-xl bg-[#C5A059] hover:bg-[#D2AE69] text-xs font-bold text-[#141816] flex items-center gap-1.5"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
              <span>{copiedLink ? t(lang, 'dcInviteCopied') : t(lang, 'dcShareInvite')}</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {me && (
            <button
              type="button"
              onClick={() => onToggleReady(!me.ready)}
              className={`min-h-[44px] px-4 rounded-xl font-display font-bold text-sm flex items-center gap-2 transition-colors ${
                me.ready
                  ? 'bg-[#25523A] border border-[#C5A059] text-[#FAF7F0]'
                  : 'bg-[#FAF7F0] hover:bg-[#EFE8DA] text-[#141816]'
              }`}
            >
              {me.ready ? <CheckCircle2 className="w-4 h-4 text-[#C5A059]" /> : <Circle className="w-4 h-4" />}
              <span>{me.ready ? t(lang, 'pcUnready') : t(lang, 'pcMarkReady')}</span>
            </button>
          )}
          <button
            type="button"
            onClick={onLeaveRoom}
            className="min-h-[44px] px-3.5 rounded-xl bg-[#382120] hover:bg-[#4F2C2A] border border-[#6E3B37] text-[#F2D5D2] text-xs font-semibold flex items-center gap-1.5"
          >
            <LogOut className="w-4 h-4" />
            <span>{t(lang, 'leaveRoom')}</span>
          </button>
        </div>
      </div>

      {/* Live WebRTC Voice Chat */}
      <CardVoicePanel
        lang={lang}
        myId={myId}
        players={playersList}
        micStatus={micStatus}
        isMuted={isMuted}
        speakingIds={speakingIds}
        localMutedPeers={localMutedPeers}
        peerStates={peerStates}
        onRequestMic={onRequestMic}
        onToggleMute={onToggleMute}
        onTogglePeerMute={onTogglePeerMute}
        onReconnectVoice={onReconnectVoice}
      />

      {errorMsg && (
        <div
          role="alert"
          className="px-4 py-3 rounded-2xl bg-[#4E221F]/80 border border-[#9E352B] text-sm font-medium text-[#F5D6D2]"
        >
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: Seated Players Roster */}
        <section className="lg:col-span-5 rounded-3xl bg-[#FAF7F0] text-[#1A1D1B] border border-[#D9CEB8] p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#E5DCCB]">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#173326]" />
              <h2 className="font-display font-bold text-lg text-[#1A1D1B]">
                Seated Players
              </h2>
            </div>
            <span className="font-mono-nums text-xs font-bold text-[#5B5449]">
              {playersList.length} / {selectedMeta.maxPlayers}
            </span>
          </div>

          <div className="space-y-2.5">
            {playersList.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-[#F2ECE0] border border-[#E0D6C3]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar
                    name={p.name}
                    avatar={p.avatar}
                    size="sm"
                    isSpeaking={Boolean(speakingIds[p.id])}
                    isMuted={p.isMuted || Boolean(localMutedPeers[p.id])}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-display font-bold text-sm text-[#1A1D1B] truncate">
                        {p.name}
                        {p.id === myId ? ' (You)' : ''}
                      </span>
                      {p.isHost && <Crown className="w-3.5 h-3.5 text-[#9C7628] shrink-0" />}
                    </div>
                    <p className="text-xs text-[#6B6153] font-mono-nums">
                      {p.score} pts · {p.connected ? 'Online' : 'Reconnecting'}
                    </p>
                  </div>
                </div>

                <span
                  className={`text-xs font-semibold flex items-center gap-1 shrink-0 ${
                    p.ready ? 'text-[#1E5C3A]' : 'text-[#7B7163]'
                  }`}
                >
                  {p.ready ? (
                    <CheckCircle2 className="w-4 h-4 text-[#1E5C3A]" />
                  ) : (
                    <Circle className="w-3.5 h-3.5 text-[#A59A89]" />
                  )}
                  <span>{p.ready ? t(lang, 'pcReady') : t(lang, 'pcNotReady')}</span>
                </span>
              </div>
            ))}
          </div>

          {/* Host Start Button or Guest Status */}
          <div className="pt-3 border-t border-[#E5DCCB] space-y-2.5">
            {isHost ? (
              <>
                <button
                  type="button"
                  disabled={!canStart || starting}
                  onClick={handleStart}
                  className="w-full min-h-[50px] rounded-2xl bg-[#173326] hover:bg-[#1E4231] disabled:opacity-45 text-[#FAF7F0] font-display font-bold text-base flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                >
                  <Play className="w-4 h-4 text-[#C5A059]" />
                  <span>{starting ? 'Dealing Cards...' : t(lang, 'pcDealStart')}</span>
                </button>
                {!canStart && (
                  <p className="text-xs text-center text-[#8B3A32] font-medium">
                    {connectedCount < selectedMeta.minPlayers
                      ? t(lang, 'pcNeedPlayers')
                      : `${selectedMeta.name} supports up to ${selectedMeta.maxPlayers} players.`}
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs text-center text-[#5B5449] font-medium py-2">
                Waiting for the host ({room.players[room.hostId]?.name || 'Host'}) to deal...
              </p>
            )}
          </div>
        </section>

        {/* Right: Game Switcher & Configurable Rules */}
        <section className="lg:col-span-7 rounded-3xl bg-[#FAF7F0] text-[#1A1D1B] border border-[#D9CEB8] p-5 sm:p-6 space-y-5 shadow-xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display font-bold text-lg text-[#1A1D1B]">
                {t(lang, 'pcSelectGame')}
              </h2>
              <p className="text-xs text-[#6B6153]">
                {isHost
                  ? 'Choose which card game to play in this room and tune house rules.'
                  : 'Host selects the active card game and table rules.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setRulesGame(room.selectedGame)}
              className="min-h-[40px] px-3.5 rounded-xl border border-[#C8BBA4] bg-[#F2ECE0] hover:bg-[#E7DEC9] text-[#3B281E] text-xs font-semibold flex items-center gap-1.5 shrink-0"
            >
              <BookOpen className="w-4 h-4 text-[#6D5A3D]" />
              <span>{t(lang, 'pcRules')}</span>
            </button>
          </div>

          {/* 4 Game Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {CARD_GAME_ORDER.map((gid) => {
              const info = CARD_GAMES_INFO[gid];
              const active = room.selectedGame === gid;
              return (
                <button
                  key={gid}
                  type="button"
                  disabled={!isHost}
                  onClick={() => onUpdateConfig({ selectedGame: gid })}
                  className={`min-h-[54px] px-3 py-2 rounded-2xl border text-left transition-all ${
                    active
                      ? 'bg-[#173326] text-[#FAF7F0] border-[#173326] shadow-md'
                      : 'bg-[#F2ECE0] text-[#3B281E] border-[#DFD4C0] hover:bg-[#E9DFCE]'
                  } disabled:cursor-default`}
                >
                  <p className="font-display font-bold text-sm leading-tight">{info.name}</p>
                  <p
                    className={`text-[11px] mt-0.5 ${
                      active ? 'text-[#C5A059]' : 'text-[#6B6153]'
                    }`}
                  >
                    {info.playersLabel}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Game Rules & Variants Panel */}
          <div className="rounded-2xl bg-[#F2ECE0] border border-[#DFD4C0] p-4 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-[#DFD4C0]">
              <Sliders className="w-4 h-4 text-[#6D5A3D]" />
              <h3 className="font-display font-bold text-sm text-[#1A1D1B]">
                {selectedMeta.name} — {t(lang, 'pcRulesSettings')}
              </h3>
            </div>

            {room.selectedGame === 'uno' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="font-semibold text-[#3B281E] mb-1.5">Starting Hand</p>
                  <div className="flex gap-2">
                    {([5, 7] as const).map((n) => (
                      <button
                        key={n}
                        type="button"
                        disabled={!isHost}
                        onClick={() =>
                          onUpdateConfig({
                            settings: { uno: { ...room.settings.uno, startingHandSize: n } },
                          })
                        }
                        className={`min-h-[38px] px-4 rounded-xl font-mono-nums font-bold border ${
                          room.settings.uno.startingHandSize === n
                            ? 'bg-[#173326] text-[#FAF7F0] border-[#173326]'
                            : 'bg-[#FAF7F0] text-[#3B281E] border-[#D9CEB8]'
                        }`}
                      >
                        {n} cards
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="font-semibold text-[#3B281E] mb-1.5">{t(lang, 'pcTurnTimer')}</p>
                  {renderTimerButtons(room.settings.uno.turnTimerSeconds, (val) =>
                    onUpdateConfig({
                      settings: { uno: { ...room.settings.uno, turnTimerSeconds: val } },
                    })
                  )}
                </div>

                <label className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#FAF7F0] border border-[#DFD4C0] cursor-pointer">
                  <span className="font-medium text-[#1A1D1B]">Stack +2 / +4 Draw Cards</span>
                  <input
                    type="checkbox"
                    disabled={!isHost}
                    checked={room.settings.uno.stackDrawCards}
                    onChange={(e) =>
                      onUpdateConfig({
                        settings: {
                          uno: { ...room.settings.uno, stackDrawCards: e.target.checked },
                        },
                      })
                    }
                    className="w-4 h-4 accent-[#173326]"
                  />
                </label>

                <label className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#FAF7F0] border border-[#DFD4C0] cursor-pointer">
                  <span className="font-medium text-[#1A1D1B]">Draw Until Playable</span>
                  <input
                    type="checkbox"
                    disabled={!isHost}
                    checked={room.settings.uno.drawUntilPlayable}
                    onChange={(e) =>
                      onUpdateConfig({
                        settings: {
                          uno: { ...room.settings.uno, drawUntilPlayable: e.target.checked },
                        },
                      })
                    }
                    className="w-4 h-4 accent-[#173326]"
                  />
                </label>
              </div>
            )}

            {room.selectedGame === 'satyo' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="font-semibold text-[#3B281E] mb-1.5">Opening Card</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        ['hearts', '7♥ Hearts'],
                        ['spades', '7♠ Spades'],
                        ['any', 'Any 7'],
                      ] as const
                    ).map(([val, label]) => (
                      <button
                        key={val}
                        type="button"
                        disabled={!isHost}
                        onClick={() =>
                          onUpdateConfig({
                            settings: { satyo: { ...room.settings.satyo, startingSeven: val } },
                          })
                        }
                        className={`min-h-[38px] px-3 rounded-xl font-semibold border ${
                          room.settings.satyo.startingSeven === val
                            ? 'bg-[#173326] text-[#FAF7F0] border-[#173326]'
                            : 'bg-[#FAF7F0] text-[#3B281E] border-[#D9CEB8]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="font-semibold text-[#3B281E] mb-1.5">Ace Placement</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        ['low', 'Low (below 2)'],
                        ['high', 'High (above K)'],
                        ['both', 'Both Ends'],
                      ] as const
                    ).map(([val, label]) => (
                      <button
                        key={val}
                        type="button"
                        disabled={!isHost}
                        onClick={() =>
                          onUpdateConfig({
                            settings: { satyo: { ...room.settings.satyo, aceRule: val } },
                          })
                        }
                        className={`min-h-[38px] px-3 rounded-xl font-semibold border ${
                          room.settings.satyo.aceRule === val
                            ? 'bg-[#173326] text-[#FAF7F0] border-[#173326]'
                            : 'bg-[#FAF7F0] text-[#3B281E] border-[#D9CEB8]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="font-semibold text-[#3B281E] mb-1.5">{t(lang, 'pcTurnTimer')}</p>
                  {renderTimerButtons(room.settings.satyo.turnTimerSeconds, (val) =>
                    onUpdateConfig({
                      settings: { satyo: { ...room.settings.satyo, turnTimerSeconds: val } },
                    })
                  )}
                </div>

                <div className="space-y-2">
                  <label className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#FAF7F0] border border-[#DFD4C0] cursor-pointer">
                    <span className="font-medium text-[#1A1D1B]">Must Play If Legal Move Exists</span>
                    <input
                      type="checkbox"
                      disabled={!isHost}
                      checked={room.settings.satyo.mustPlayIfAble}
                      onChange={(e) =>
                        onUpdateConfig({
                          settings: {
                            satyo: { ...room.settings.satyo, mustPlayIfAble: e.target.checked },
                          },
                        })
                      }
                      className="w-4 h-4 accent-[#173326]"
                    />
                  </label>
                </div>
              </div>
            )}

            {room.selectedGame === 'mongoose' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="font-semibold text-[#3B281E] mb-1.5">Stack Play Rule</p>
                  <div className="flex flex-col gap-1.5">
                    {(
                      [
                        ['rank_or_suit', 'Match Suit or Rank'],
                        ['higher_or_equal', 'Equal or Higher Rank'],
                        ['rank_match', 'Any Card (Rank Match Captures)'],
                      ] as const
                    ).map(([val, label]) => (
                      <button
                        key={val}
                        type="button"
                        disabled={!isHost}
                        onClick={() =>
                          onUpdateConfig({
                            settings: { mongoose: { ...room.settings.mongoose, matchRule: val } },
                          })
                        }
                        className={`min-h-[38px] px-3 rounded-xl font-semibold text-left border ${
                          room.settings.mongoose.matchRule === val
                            ? 'bg-[#173326] text-[#FAF7F0] border-[#173326]'
                            : 'bg-[#FAF7F0] text-[#3B281E] border-[#D9CEB8]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="font-semibold text-[#3B281E] mb-1.5">On Rank Match Capture</p>
                  <div className="flex flex-col gap-1.5">
                    {(
                      [
                        ['give_pile_to_previous', 'Previous Player Picks Up Stack'],
                        ['collect_pile_to_score', 'Bank Stack for Points'],
                        ['burn_and_bonus', 'Burn Stack + Bonus Turn'],
                      ] as const
                    ).map(([val, label]) => (
                      <button
                        key={val}
                        type="button"
                        disabled={!isHost}
                        onClick={() =>
                          onUpdateConfig({
                            settings: {
                              mongoose: { ...room.settings.mongoose, captureEffect: val },
                            },
                          })
                        }
                        className={`min-h-[38px] px-3 rounded-xl font-semibold text-left border ${
                          room.settings.mongoose.captureEffect === val
                            ? 'bg-[#173326] text-[#FAF7F0] border-[#173326]'
                            : 'bg-[#FAF7F0] text-[#3B281E] border-[#D9CEB8]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="font-semibold text-[#3B281E] mb-1.5">{t(lang, 'pcTurnTimer')}</p>
                  {renderTimerButtons(room.settings.mongoose.turnTimerSeconds, (val) =>
                    onUpdateConfig({
                      settings: {
                        mongoose: { ...room.settings.mongoose, turnTimerSeconds: val },
                      },
                    })
                  )}
                </div>

                <div className="space-y-2">
                  <label className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#FAF7F0] border border-[#DFD4C0] cursor-pointer">
                    <span className="font-medium text-[#1A1D1B]">Allow Multi-Card Same Rank</span>
                    <input
                      type="checkbox"
                      disabled={!isHost}
                      checked={room.settings.mongoose.allowMultiCardPlay}
                      onChange={(e) =>
                        onUpdateConfig({
                          settings: {
                            mongoose: {
                              ...room.settings.mongoose,
                              allowMultiCardPlay: e.target.checked,
                            },
                          },
                        })
                      }
                      className="w-4 h-4 accent-[#173326]"
                    />
                  </label>
                  <label className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#FAF7F0] border border-[#DFD4C0] cursor-pointer">
                    <span className="font-medium text-[#1A1D1B]">10s Burn Stack & Aces Skip</span>
                    <input
                      type="checkbox"
                      disabled={!isHost}
                      checked={room.settings.mongoose.specialCardsRule === 'tens_burn_aces_skip'}
                      onChange={(e) =>
                        onUpdateConfig({
                          settings: {
                            mongoose: {
                              ...room.settings.mongoose,
                              specialCardsRule: e.target.checked ? 'tens_burn_aces_skip' : 'none',
                            },
                          },
                        })
                      }
                      className="w-4 h-4 accent-[#173326]"
                    />
                  </label>
                </div>
              </div>
            )}

            {room.selectedGame === 'gadha_chor' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="font-semibold text-[#3B281E] mb-1.5">Unmatched Odd Card</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        ['queen_spades', 'Queen of Spades (49 Cards)'],
                        ['joker', 'Joker (53 Cards)'],
                      ] as const
                    ).map(([val, label]) => (
                      <button
                        key={val}
                        type="button"
                        disabled={!isHost}
                        onClick={() =>
                          onUpdateConfig({
                            settings: {
                              gadha_chor: { ...room.settings.gadha_chor, oddCard: val },
                            },
                          })
                        }
                        className={`min-h-[38px] px-3 rounded-xl font-semibold border ${
                          room.settings.gadha_chor.oddCard === val
                            ? 'bg-[#173326] text-[#FAF7F0] border-[#173326]'
                            : 'bg-[#FAF7F0] text-[#3B281E] border-[#D9CEB8]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="font-semibold text-[#3B281E] mb-1.5">Pair Matching Rule</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        ['any_same_rank', 'Any Same Rank'],
                        ['same_rank_same_color', 'Same Rank & Color'],
                      ] as const
                    ).map(([val, label]) => (
                      <button
                        key={val}
                        type="button"
                        disabled={!isHost}
                        onClick={() =>
                          onUpdateConfig({
                            settings: {
                              gadha_chor: { ...room.settings.gadha_chor, pairRule: val },
                            },
                          })
                        }
                        className={`min-h-[38px] px-3 rounded-xl font-semibold border ${
                          room.settings.gadha_chor.pairRule === val
                            ? 'bg-[#173326] text-[#FAF7F0] border-[#173326]'
                            : 'bg-[#FAF7F0] text-[#3B281E] border-[#D9CEB8]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="font-semibold text-[#3B281E] mb-1.5">{t(lang, 'pcTurnTimer')}</p>
                  {renderTimerButtons(room.settings.gadha_chor.turnTimerSeconds, (val) =>
                    onUpdateConfig({
                      settings: {
                        gadha_chor: { ...room.settings.gadha_chor, turnTimerSeconds: val },
                      },
                    })
                  )}
                </div>

                <div className="space-y-2">
                  <label className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#FAF7F0] border border-[#DFD4C0] cursor-pointer">
                    <span className="font-medium text-[#1A1D1B]">Auto-Discard Pairs</span>
                    <input
                      type="checkbox"
                      disabled={!isHost}
                      checked={room.settings.gadha_chor.autoDiscardPairs}
                      onChange={(e) =>
                        onUpdateConfig({
                          settings: {
                            gadha_chor: {
                              ...room.settings.gadha_chor,
                              autoDiscardPairs: e.target.checked,
                            },
                          },
                        })
                      }
                      className="w-4 h-4 accent-[#173326]"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* Quick Rules Summary */}
            <div className="pt-2 border-t border-[#DFD4C0] space-y-1">
              {selectedMeta.rulesSummary.map((line, i) => (
                <p key={i} className="text-xs text-[#4C453B]">
                  <span className="text-[#9C7628] font-bold mr-1.5">·</span>
                  {line}
                </p>
              ))}
            </div>
          </div>
        </section>
      </div>

      <CardRulesModal gameId={rulesGame} onClose={() => setRulesGame(null)} />
    </div>
  );
};
