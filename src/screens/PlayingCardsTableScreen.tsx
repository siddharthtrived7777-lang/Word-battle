import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { AlertCircle, Layers, Shuffle, Sparkles } from 'lucide-react';
import type { MicPermissionState } from '../hooks/useVoiceChat';
import type {
  CardActionPayload,
  CardItem,
  CardRoomClientState,
  JokerCard,
  StandardCard,
  StandardSuit,
  UnoCard,
  UnoChosenColor,
} from '../types/cardGames';
import type { Language } from '../types/game';
import { CardTableShell } from '../components/cards/CardTableShell';
import { PlayingCardView } from '../components/cards/PlayingCardView';
import { UnoCardView } from '../components/cards/UnoCardView';
import { CardRulesModal } from '../components/cards/CardRulesModal';
import { soundFx } from '../utils/soundFx';

interface PlayingCardsTableScreenProps {
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
  onAction: (action: CardActionPayload) => Promise<void>;
  onPlayAgain: (mode: 'lobby' | 'redeal') => Promise<void>;
  onLeaveRoom: () => Promise<void>;
}

const SUIT_LIST: Array<{ suit: StandardSuit; symbol: string; name: string; red: boolean }> = [
  { suit: 'spades', symbol: '♠', name: 'Spades', red: false },
  { suit: 'hearts', symbol: '♥', name: 'Hearts', red: true },
  { suit: 'diamonds', symbol: '♦', name: 'Diamonds', red: true },
  { suit: 'clubs', symbol: '♣', name: 'Clubs', red: false },
];

const UNO_COLOR_BUTTONS: Array<{ color: UnoChosenColor; label: string; bg: string }> = [
  { color: 'red', label: 'Crimson', bg: 'bg-[#9E352B]' },
  { color: 'blue', label: 'Cobalt', bg: 'bg-[#28577A]' },
  { color: 'green', label: 'Forest', bg: 'bg-[#2A6646]' },
  { color: 'yellow', label: 'Ochre', bg: 'bg-[#B38629]' },
];

function rankShort(rank: number): string {
  switch (rank) {
    case 1:
      return 'A';
    case 11:
      return 'J';
    case 12:
      return 'Q';
    case 13:
      return 'K';
    case 14:
      return 'A';
    default:
      return String(rank);
  }
}

export const PlayingCardsTableScreen: React.FC<PlayingCardsTableScreenProps> = ({
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
  onAction,
  onPlayAgain,
  onLeaveRoom,
}) => {
  const [showRules, setShowRules] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingWildCard, setPendingWildCard] = useState<UnoCard | null>(null);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);

  const prevTurnRef = useRef<string | null>(null);
  const prevPhaseRef = useRef(room.phase);
  const table = room.table;
  const isMyTurn = room.phase === 'playing' && table?.turnUid === myId;
  const me = room.players[myId];

  useEffect(() => {
    setSelectedCardIds([]);
    setPendingWildCard(null);
    setActionError(null);
  }, [room.selectedGame, room.phase, table?.turnUid, room.myHand.length]);

  useEffect(() => {
    if (table?.turnUid === myId && prevTurnRef.current !== myId && room.phase === 'playing') {
      soundFx.turnChange();
    }
    prevTurnRef.current = table?.turnUid ?? null;
  }, [myId, room.phase, table?.turnUid]);

  useEffect(() => {
    if (room.phase === 'finished' && prevPhaseRef.current !== 'finished') {
      soundFx.cardWin();
    }
    prevPhaseRef.current = room.phase;
  }, [room.phase]);

  const sendSafeAction = async (action: CardActionPayload) => {
    if (actionBusy) return;
    setActionBusy(true);
    setActionError(null);
    try {
      await onAction(action);
      if (action.type === 'uno_call') soundFx.unoCall();
      else soundFx.cardPlay();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Move rejected';
      setActionError(msg.replace(/_/g, ' ').toLowerCase());
    } finally {
      setActionBusy(false);
    }
  };

  // ---------------- UNO Legality Helpers ----------------
  const isUnoPlayableClient = (card: CardItem): boolean => {
    if (!isMyTurn || card.kind !== 'uno' || !table?.uno) return false;
    const { topCard, activeColor, pendingDrawCount } = table.uno;
    if (pendingDrawCount > 0) {
      if (!room.settings.uno.stackDrawCards || !topCard) return false;
      if (topCard.value === 'draw2') return card.value === 'draw2' || card.value === 'wild4';
      if (topCard.value === 'wild4') return card.value === 'wild4';
      return false;
    }
    if (!topCard) return true;
    if (card.color === 'wild') return true;
    return card.color === activeColor || card.value === topCard.value;
  };

  // ---------------- Satyo Legality Helpers ----------------
  const isSatyoPlayableClient = (card: CardItem): boolean => {
    if (!isMyTurn || card.kind !== 'standard' || !table?.satyo) return false;
    const { lanes, boardCardCount, startingSevenRequired } = table.satyo;
    if (boardCardCount === 0) {
      if (startingSevenRequired === 'hearts') return card.rank === 7 && card.suit === 'hearts';
      if (startingSevenRequired === 'spades') return card.rank === 7 && card.suit === 'spades';
      return card.rank === 7;
    }
    const lane = lanes[card.suit];
    if (!lane.started) return card.rank === 7;
    const low = lane.low ?? 7;
    const high = lane.high ?? 7;
    const aceRule = room.settings.satyo.aceRule;
    if (low > 2 && card.rank === low - 1) return true;
    if (low === 2 && card.rank === 1 && (aceRule === 'low' || aceRule === 'both')) return true;
    if (high < 13 && card.rank === high + 1) return true;
    if (high === 13 && card.rank === 1 && (aceRule === 'high' || aceRule === 'both')) return true;
    return false;
  };

  const hasAnySatyoPlay = useMemo(
    () => room.selectedGame === 'satyo' && room.myHand.some((c) => isSatyoPlayableClient(c)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [room.selectedGame, room.myHand, table?.satyo, isMyTurn]
  );

  // ---------------- Mongoose Legality Helpers ----------------
  const isMongooseSingleLegal = (card: CardItem): boolean => {
    if (!isMyTurn || card.kind === 'uno' || !table?.mongoose) return false;
    const top = table.mongoose.uppermostCard;
    if (!top) return true;
    if (room.settings.mongoose.specialCardsRule === 'tens_burn_aces_skip' && card.rank === 10) {
      return true;
    }
    if (room.settings.mongoose.matchRule === 'rank_match') return true;
    if (room.settings.mongoose.matchRule === 'rank_or_suit') {
      if (card.kind === 'joker' || top.kind === 'joker') return true;
      return card.rank === top.rank || card.suit === top.suit;
    }
    const eff = (r: number) => (r === 1 ? 14 : r);
    return eff(card.rank) >= eff(top.rank);
  };

  const selectedMongooseCards = useMemo(
    () =>
      room.myHand.filter(
        (c): c is StandardCard | JokerCard => c.kind !== 'uno' && selectedCardIds.includes(c.id)
      ),
    [room.myHand, selectedCardIds]
  );

  const canPlaySelectedMongoose = useMemo(() => {
    if (!isMyTurn || selectedMongooseCards.length === 0) return false;
    const first = selectedMongooseCards[0];
    if (selectedMongooseCards.some((c) => c.rank !== first.rank)) return false;
    if (selectedMongooseCards.length > 1 && !room.settings.mongoose.allowMultiCardPlay) {
      return false;
    }
    return isMongooseSingleLegal(first);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMyTurn, selectedMongooseCards, room.settings.mongoose, table?.mongoose]);

  // ---------------- Gadha Chor Pair Helper ----------------
  const selectedGadhaPairValid = useMemo(() => {
    if (room.selectedGame !== 'gadha_chor' || selectedCardIds.length !== 2) return false;
    const a = room.myHand.find((c) => c.id === selectedCardIds[0]);
    const b = room.myHand.find((c) => c.id === selectedCardIds[1]);
    if (!a || !b || a.kind !== 'standard' || b.kind !== 'standard') return false;
    if (a.rank !== b.rank) return false;
    if (room.settings.gadha_chor.pairRule === 'any_same_rank') return true;
    const aRed = a.suit === 'hearts' || a.suit === 'diamonds';
    const bRed = b.suit === 'hearts' || b.suit === 'diamonds';
    return aRed === bRed;
  }, [room.myHand, room.selectedGame, room.settings.gadha_chor.pairRule, selectedCardIds]);

  const toggleCardSelection = (cardId: string, maxSelect: number) => {
    soundFx.click();
    setSelectedCardIds((prev) => {
      if (prev.includes(cardId)) return prev.filter((id) => id !== cardId);
      if (maxSelect === 1) return [cardId];
      if (prev.length >= maxSelect) return [...prev.slice(1), cardId];
      return [...prev, cardId];
    });
  };

  // ---------------- Render Center Felt ----------------
  const renderCenterFelt = () => {
    if (!table) return null;

    if (room.selectedGame === 'uno' && table.uno) {
      const uno = table.uno;
      const colorBadgeHex: Record<UnoChosenColor, string> = {
        red: '#9E352B',
        blue: '#28577A',
        green: '#2A6646',
        yellow: '#B38629',
      };
      const vulnerablePlayer = uno.unoVulnerableUid
        ? room.players[uno.unoVulnerableUid]
        : null;

      return (
        <div className="flex flex-col items-center justify-center gap-5 py-2">
          <div className="flex items-center justify-center gap-6 sm:gap-10">
            {/* Draw Pile */}
            <div className="flex flex-col items-center gap-2">
              <UnoCardView
                faceDown
                size="lg"
                onClick={isMyTurn ? () => sendSafeAction({ type: 'uno_draw' }) : undefined}
                disabled={!isMyTurn || actionBusy}
              />
              <span className="font-mono-nums text-xs text-[#E6D7B7]">
                Deck ({uno.drawPileCount})
              </span>
            </div>

            {/* Active Discard Card */}
            <div className="flex flex-col items-center gap-2">
              <motion.div
                key={uno.topCard?.id || 'empty'}
                initial={{ scale: 0.9, y: -8, opacity: 0.7 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                transition={{ duration: 0.2 }}
              >
                <UnoCardView
                  card={uno.topCard}
                  activeColor={uno.activeColor}
                  size="lg"
                />
              </motion.div>
              <div className="flex items-center gap-2 text-xs text-[#FAF7F0]">
                <span
                  className="w-3 h-3 rounded-full border border-white/60"
                  style={{ backgroundColor: colorBadgeHex[uno.activeColor] }}
                />
                <span className="uppercase tracking-wider font-bold text-[#E6D7B7]">
                  {uno.activeColor}
                </span>
                {uno.pendingDrawCount > 0 && (
                  <span className="font-mono-nums font-black text-[#F5A89D]">
                    +{uno.pendingDrawCount} PENDING
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* UNO Call / Catch / Pass Controls */}
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            {me && room.myHand.length <= 2 && room.myHand.length > 0 && !me.saidUno && (
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => sendSafeAction({ type: 'uno_call' })}
                className="min-h-[44px] px-5 rounded-xl bg-[#C5A059] hover:bg-[#D2AE69] text-[#141816] font-display font-black text-sm shadow-lg"
              >
                Shout UNO!
              </button>
            )}

            {vulnerablePlayer && uno.unoVulnerableUid !== myId && (
              <button
                type="button"
                disabled={actionBusy}
                onClick={() =>
                  sendSafeAction({ type: 'uno_catch', targetUid: vulnerablePlayer.id })
                }
                className="min-h-[44px] px-4 rounded-xl bg-[#9E352B] hover:bg-[#B24136] text-[#FAF7F0] font-display font-bold text-xs flex items-center gap-1.5"
              >
                <AlertCircle className="w-4 h-4" />
                <span>Catch {vulnerablePlayer.name} (+2)</span>
              </button>
            )}

            {isMyTurn && uno.hasDrawnThisTurn && (
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => sendSafeAction({ type: 'uno_pass' })}
                className="min-h-[44px] px-4 rounded-xl bg-[#263C30] hover:bg-[#314E3E] border border-[#C5A059]/50 text-[#FAF7F0] font-semibold text-xs"
              >
                Pass Turn
              </button>
            )}
          </div>
        </div>
      );
    }

    if (room.selectedGame === 'satyo' && table.satyo) {
      const lanes = table.satyo.lanes;
      return (
        <div className="space-y-3 py-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {SUIT_LIST.map(({ suit, symbol, name, red }) => {
              const lane = lanes[suit];
              return (
                <div
                  key={suit}
                  className="rounded-2xl bg-[#12261C]/90 border border-[#C5A059]/25 px-3.5 py-3 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-9 h-9 rounded-xl bg-[#FAF7F0] flex items-center justify-center text-lg font-serif ${
                        red ? 'text-[#9F2929]' : 'text-[#1E2220]'
                      }`}
                    >
                      {symbol}
                    </span>
                    <div>
                      <p className="font-display font-bold text-sm text-[#FAF7F0]">{name}</p>
                      <p className="text-[11px] font-mono-nums text-[#B6C5BC]">
                        {lane.started ? `${lane.cardsCount}/13 laid` : 'Needs 7 to open'}
                      </p>
                    </div>
                  </div>

                  {lane.started ? (
                    <div className="flex items-center gap-1.5 font-mono-nums text-xs">
                      <span className="px-2 py-1 rounded-lg bg-[#FAF7F0] text-[#1A1D1B] font-bold">
                        {rankShort(lane.low ?? 7)}
                        {symbol}
                      </span>
                      <span className="text-[#C5A059]">← 7 →</span>
                      <span className="px-2 py-1 rounded-lg bg-[#FAF7F0] text-[#1A1D1B] font-bold">
                        {rankShort(lane.high ?? 7)}
                        {symbol}
                      </span>
                    </div>
                  ) : (
                    <span className="font-mono-nums text-xs text-[#C5A059]/80">
                      7{symbol}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {isMyTurn && (
            <div className="flex items-center justify-center gap-3 pt-1">
              <span className="text-xs text-[#E6D7B7]">
                {hasAnySatyoPlay
                  ? 'Tap a highlighted card in your hand to extend a suit.'
                  : 'No legal cards available.'}
              </span>
              {(!hasAnySatyoPlay || !room.settings.satyo.mustPlayIfAble) && (
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => sendSafeAction({ type: 'satyo_pass' })}
                  className="min-h-[42px] px-4 rounded-xl bg-[#C5A059] hover:bg-[#D2AE69] text-[#141816] font-display font-bold text-xs"
                >
                  Pass Turn
                </button>
              )}
            </div>
          )}
        </div>
      );
    }

    if (room.selectedGame === 'mongoose' && table.mongoose) {
      const m = table.mongoose;
      const lastPlayer = m.lastPlayedByUid ? room.players[m.lastPlayedByUid]?.name : null;

      return (
        <div className="flex flex-col items-center justify-center gap-4 py-2">
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-12">
            {/* Stockpile */}
            <div className="flex flex-col items-center gap-2">
              <PlayingCardView faceDown size="lg" label={String(m.drawPileCount)} />
              <span className="font-mono-nums text-xs text-[#C9BEA8]">
                Stockpile ({m.drawPileCount})
              </span>
            </div>

            {/* Central Public Stack — uppermost card ALWAYS face-up and clearly visible */}
            <div className="flex flex-col items-center gap-2">
              <div className="relative flex items-center justify-center min-w-[124px] min-h-[164px]">
                {m.stackCount === 0 || !m.uppermostCard ? (
                  <div className="w-24 h-36 sm:w-28 sm:h-40 rounded-2xl border-2 border-dashed border-[#C5A059]/45 bg-[#12261C]/60 flex flex-col items-center justify-center text-center p-3">
                    <Layers className="w-5 h-5 text-[#C5A059]/70 mb-1" />
                    <span className="text-xs text-[#D9CEB8]">Empty Stack</span>
                    <span className="text-[10px] text-[#9EB0A6]">Any card opens</span>
                  </div>
                ) : (
                  <div className="relative">
                    {m.stackCount > 2 && (
                      <div
                        aria-hidden="true"
                        className="absolute inset-0 -translate-x-2.5 translate-y-1.5 -rotate-6 rounded-2xl bg-[#E8DFCE] border border-[#C8BBA4] opacity-70"
                      />
                    )}
                    {m.stackCount > 1 && (
                      <div
                        aria-hidden="true"
                        className="absolute inset-0 translate-x-2 translate-y-1 rotate-3 rounded-2xl bg-[#F2ECE0] border border-[#D9CEB8] opacity-85"
                      />
                    )}
                    <motion.div
                      key={`${m.uppermostCard.id}_${m.stackCount}`}
                      initial={{ scale: 0.88, y: -12, opacity: 0.7 }}
                      animate={{ scale: 1, y: 0, opacity: 1 }}
                      transition={{ duration: 0.18 }}
                      className="relative z-10"
                    >
                      <PlayingCardView card={m.uppermostCard} size="lg" />
                    </motion.div>
                  </div>
                )}
              </div>
              <div className="text-center">
                <p className="font-mono-nums text-xs font-bold text-[#E6D7B7]">
                  Central Stack: {m.stackCount} {m.stackCount === 1 ? 'card' : 'cards'}
                  {m.burnedCount > 0 ? ` · Burned ${m.burnedCount}` : ''}
                </p>
                {lastPlayer && m.uppermostCard && (
                  <p className="text-[11px] text-[#B6C5BC]">Uppermost played by {lastPlayer}</p>
                )}
              </div>
            </div>
          </div>

          {isMyTurn && (
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                disabled={!canPlaySelectedMongoose || actionBusy}
                onClick={() =>
                  sendSafeAction({ type: 'mongoose_play', cardIds: selectedCardIds })
                }
                className="min-h-[44px] px-5 rounded-xl bg-[#C5A059] hover:bg-[#D2AE69] disabled:opacity-45 text-[#141816] font-display font-bold text-sm"
              >
                Play Selected ({selectedCardIds.length})
              </button>
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => sendSafeAction({ type: 'mongoose_pickup' })}
                className="min-h-[44px] px-4 rounded-xl bg-[#243B2E] hover:bg-[#2E4B3B] border border-[#C5A059]/40 text-[#FAF7F0] font-semibold text-xs"
              >
                {m.stackCount > 0 ? `Pick Up Stack (${m.stackCount})` : 'Draw / Pass'}
              </button>
            </div>
          )}
        </div>
      );
    }

    if (room.selectedGame === 'gadha_chor' && table.gadhaChor) {
      const gc = table.gadhaChor;
      const targetPlayer = gc.targetUid ? room.players[gc.targetUid] : null;
      const cardIndices = Array.from({ length: gc.targetCardCount }, (_, i) => i);
      const pickPending = Boolean(gc.pendingPick);

      return (
        <div className="flex flex-col items-center justify-center gap-4 py-2 text-center">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wider text-[#C5A059] font-semibold">
              {pickPending
                ? 'Drawing selected card...'
                : isMyTurn
                  ? `Pick 1 face-down card from ${targetPlayer?.name || 'Neighbor'}`
                  : `${room.players[table.turnUid || '']?.name || 'Player'} is picking from ${targetPlayer?.name || 'Neighbor'}`}
            </p>
            <p className="text-xs font-mono-nums text-[#C9BEA8]">
              Pairs cleared: {gc.pairsClearedTotal} · Avoid keeping{' '}
              {gc.oddCardType === 'joker' ? 'the Joker' : 'Q♠'}
            </p>
          </div>

          {gc.targetCardCount > 0 && (
            <div className="flex items-center justify-center flex-wrap gap-2 max-w-2xl px-2">
              {cardIndices.map((idx) => (
                <PlayingCardView
                  key={`pick_${idx}`}
                  faceDown
                  size="sm"
                  label={`#${idx + 1}`}
                  disabled={!isMyTurn || actionBusy || pickPending}
                  onClick={
                    isMyTurn && !pickPending
                      ? () => {
                          soundFx.cardFlip();
                          sendSafeAction({ type: 'gadha_pick', index: idx });
                        }
                      : undefined
                  }
                />
              ))}
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  // ---------------- Render Personal Hand Tray ----------------
  const renderHandTray = () => {
    const hand = room.myHand;

    return (
      <div className="rounded-3xl bg-[#1A211E] border border-[#3B281E] p-3.5 sm:p-4 space-y-3 shadow-xl text-[#FAF7F0]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-sm sm:text-base text-[#FAF7F0]">
              Your Hand
            </span>
            <span className="font-mono-nums text-xs text-[#C5A059]">
              · {hand.length} {hand.length === 1 ? 'card' : 'cards'}
            </span>
            {me?.safe && (
              <span className="text-xs font-bold text-[#7BC49A] flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> Safe!
              </span>
            )}
          </div>

          {/* Context-specific hand actions */}
          {room.selectedGame === 'gadha_chor' && hand.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {!room.settings.gadha_chor.autoDiscardPairs && (
                <button
                  type="button"
                  disabled={!selectedGadhaPairValid || actionBusy}
                  onClick={() =>
                    sendSafeAction({
                      type: 'gadha_discard_pair',
                      cardIds: [selectedCardIds[0], selectedCardIds[1]],
                    })
                  }
                  className="min-h-[40px] px-4 rounded-xl bg-[#C5A059] hover:bg-[#D2AE69] disabled:opacity-40 text-[#141816] font-display font-bold text-xs"
                >
                  Drop Pair
                </button>
              )}
              <button
                type="button"
                disabled={actionBusy || hand.length < 2}
                onClick={() => sendSafeAction({ type: 'gadha_shuffle_hand' })}
                className="min-h-[40px] px-3.5 rounded-xl bg-[#24322B] hover:bg-[#2F4138] border border-[#3B4E43] text-[#E6D7B7] text-xs font-semibold flex items-center gap-1.5"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>Shuffle Hand</span>
              </button>
            </div>
          )}

          {room.selectedGame === 'mongoose' && room.settings.mongoose.allowMultiCardPlay && (
            <span className="text-[11px] text-[#A8B6AD]">
              Tap card(s) of the same rank, then Play Selected
            </span>
          )}
        </div>

        {actionError && (
          <div
            role="alert"
            className="px-3 py-2 rounded-xl bg-[#4E221F]/80 border border-[#9E352B] text-xs text-[#F5D6D2]"
          >
            {actionError}
          </div>
        )}

        {/* Wild color selector for UNO */}
        {pendingWildCard && (
          <div className="p-3 rounded-2xl bg-[#121916] border border-[#C5A059] flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-bold text-[#E6D7B7]">
              Choose color for {pendingWildCard.value === 'wild4' ? 'Wild +4' : 'Wild'}:
            </span>
            <div className="flex flex-wrap gap-2">
              {UNO_COLOR_BUTTONS.map((btn) => (
                <button
                  key={btn.color}
                  type="button"
                  onClick={() => {
                    const card = pendingWildCard;
                    setPendingWildCard(null);
                    sendSafeAction({
                      type: 'uno_play',
                      cardId: card.id,
                      chosenColor: btn.color,
                    });
                  }}
                  className={`min-h-[40px] px-3.5 rounded-xl ${btn.bg} text-[#FAF7F0] font-display font-bold text-xs border border-white/40`}
                >
                  {btn.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPendingWildCard(null)}
                className="min-h-[40px] px-3 rounded-xl bg-[#27312C] text-xs text-[#D9CEB8]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {hand.length === 0 ? (
          <p className="text-sm text-[#A8B6AD] py-4 text-center">
            No cards in hand.
          </p>
        ) : (
          <div className="flex items-end gap-2 overflow-x-auto pt-3 pb-2 px-1">
            {hand.map((card) => {
              if (card.kind === 'uno') {
                const playable = isUnoPlayableClient(card);
                return (
                  <UnoCardView
                    key={card.id}
                    card={card}
                    size="md"
                    playable={playable}
                    disabled={isMyTurn && !playable}
                    onClick={() => {
                      if (!isMyTurn || !playable || actionBusy) return;
                      if (card.color === 'wild') {
                        setPendingWildCard(card);
                      } else {
                        sendSafeAction({ type: 'uno_play', cardId: card.id });
                      }
                    }}
                  />
                );
              }

              if (room.selectedGame === 'satyo') {
                const playable = isSatyoPlayableClient(card);
                return (
                  <PlayingCardView
                    key={card.id}
                    card={card}
                    size="md"
                    playable={playable}
                    disabled={isMyTurn && !playable}
                    onClick={() => {
                      if (!isMyTurn || !playable || actionBusy) return;
                      sendSafeAction({ type: 'satyo_play', cardId: card.id });
                    }}
                  />
                );
              }

              if (room.selectedGame === 'mongoose') {
                const selected = selectedCardIds.includes(card.id);
                const playable = isMongooseSingleLegal(card);
                return (
                  <PlayingCardView
                    key={card.id}
                    card={card}
                    size="md"
                    selected={selected}
                    playable={playable}
                    onClick={() => {
                      const maxSel = room.settings.mongoose.allowMultiCardPlay ? 4 : 1;
                      toggleCardSelection(card.id, maxSel);
                    }}
                  />
                );
              }

              // Gadha Chor hand cards (tap to pair if manual discard enabled)
              const selected = selectedCardIds.includes(card.id);
              return (
                <PlayingCardView
                  key={card.id}
                  card={card}
                  size="md"
                  selected={selected}
                  onClick={
                    !room.settings.gadha_chor.autoDiscardPairs
                      ? () => toggleCardSelection(card.id, 2)
                      : undefined
                  }
                />
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <CardTableShell
        lang={lang}
        room={room}
        myId={myId}
        speakingIds={speakingIds}
        micStatus={micStatus}
        isMuted={isMuted}
        localMutedPeers={localMutedPeers}
        peerStates={peerStates}
        onRequestMic={onRequestMic}
        onToggleMute={onToggleMute}
        onTogglePeerMute={onTogglePeerMute}
        onReconnectVoice={onReconnectVoice}
        onOpenRules={() => setShowRules(true)}
        onPlayAgain={onPlayAgain}
        onLeaveRoom={onLeaveRoom}
        handTray={renderHandTray()}
      >
        {renderCenterFelt()}
      </CardTableShell>

      <CardRulesModal
        gameId={showRules ? room.selectedGame : null}
        onClose={() => setShowRules(false)}
      />
    </>
  );
};
