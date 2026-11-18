import type {
  CardGameId,
  CardGameSettingsMap,
} from '../types/cardGames.ts';

export interface CardGameMeta {
  id: CardGameId;
  name: string;
  tagline: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  playersLabel: string;
  deckType: string;
  accentHex: string;
  rulesSummary: string[];
  rulesDetails: {
    objective: string;
    setup: string;
    gameplay: string[];
    winning: string;
    variants: string[];
  };
}

export const DEFAULT_CARD_GAME_SETTINGS: CardGameSettingsMap = {
  uno: {
    startingHandSize: 7,
    stackDrawCards: true,
    drawUntilPlayable: false,
    twoPlayerReverseActsAsSkip: true,
    unoPenaltyCards: 2,
    turnTimerSeconds: 30,
  },
  satyo: {
    mustPlayIfAble: true,
    aceRule: 'low',
    startingSeven: 'hearts',
    scoringMode: 'first_out',
    turnTimerSeconds: 30,
  },
  mongoose: {
    matchRule: 'rank_or_suit',
    captureEffect: 'give_pile_to_previous',
    allowMultiCardPlay: true,
    specialCardsRule: 'tens_burn_aces_skip',
    turnTimerSeconds: 30,
  },
  gadha_chor: {
    oddCard: 'queen_spades',
    pairRule: 'any_same_rank',
    autoDiscardPairs: false,
    pickDirection: 'clockwise',
    turnTimerSeconds: 30,
  },
};

export const CARD_GAMES_INFO: Record<CardGameId, CardGameMeta> = {
  uno: {
    id: 'uno',
    name: 'UNO',
    tagline: 'Match colors, chain action cards, shout UNO!',
    description:
      'Race to empty your hand by matching color or value on the discard pile while dodging Draw Twos and Wilds.',
    minPlayers: 2,
    maxPlayers: 8,
    playersLabel: '2–8 Players',
    deckType: '108-Card Color Deck',
    accentHex: '#C5A059',
    rulesSummary: [
      'Match the active color, number, or symbol — or play a Wild anytime.',
      'Action cards: Skip, Reverse, Draw +2, Wild, and Wild +4.',
      'Tap UNO! when down to 1 card before someone catches you for +2.',
    ],
    rulesDetails: {
      objective: 'Be the first player to play all cards from your hand.',
      setup:
        'Each player is dealt 5 or 7 cards. One starting card is placed face-up to open the central discard pile.',
      gameplay: [
        'On your turn, play one card matching the active color, matching the top number/symbol, or play a Wild / Wild +4.',
        'If you cannot or choose not to play, draw from the deck. Depending on room rules, draw 1 card or draw until playable.',
        'When Draw +2 or Wild +4 is played, the next player draws (or stacks if enabled) and loses their turn.',
        'Tap UNO! as soon as you drop to 1 card. Any opponent can tap Catch UNO! before the next turn finishes to give you +2 penalty cards.',
      ],
      winning:
        'The round ends immediately when a player plays their final card. Opponents tally remaining cards while the winner claims the round.',
      variants: [
        'Stacking (+2 on +2, +4 on +4) lets defenders pass the penalty forward.',
        'Draw Until Playable keeps drawing until you find a legal card.',
        'In 2-player rooms, Reverse acts as Skip so your turn comes right back.',
      ],
    },
  },
  satyo: {
    id: 'satyo',
    name: 'Satyo',
    tagline: 'Build suit ladders out from the 7s.',
    description:
      'Classic Indian 7s domino-layout game. Open suits with 7s and extend sequences down to Ace and up to King.',
    minPlayers: 2,
    maxPlayers: 6,
    playersLabel: '2–6 Players',
    deckType: 'Standard 52-Card Deck',
    accentHex: '#C5A059',
    rulesSummary: [
      'The player holding the starting 7 opens the table.',
      'Play any 7 to start a new suit, or extend an open suit one rank up or down.',
      'Pass only if you have no legal move (or strategically if enabled).',
    ],
    rulesDetails: {
      objective: 'Empty your hand of all cards first (or minimize leftover pips).',
      setup:
        'All 52 cards are dealt out evenly among seated players. Whoever holds the configured starting 7 (default 7♥) leads the opening play.',
      gameplay: [
        'Each suit starts only when its 7 is placed into that suit lane on the felt.',
        'Once a suit lane is open, any player on their turn can extend it by playing the next lower card (6 → 5 → … → A) or next higher card (8 → 9 → … → K).',
        'If you have no legal card to place, you must Pass.',
      ],
      winning:
        'First player to shed their last card wins the hand immediately. In Pip-Sum mode, remaining hands are scored by card value.',
      variants: [
        'Must Play If Able forces legal plays vs Strategic Passing.',
        'Ace Low (A below 2), Ace High (A above K), or Both Ways.',
        'Choose 7♥, 7♠, or any 7 to open the table.',
      ],
    },
  },
  mongoose: {
    id: 'mongoose',
    name: 'Mongoose',
    tagline: 'Stack cards live onto the visible top card.',
    description:
      'Keep your eyes on the uppermost card in the center stack. Match rank, suit, or escalate—don’t get stuck holding the pile.',
    minPlayers: 2,
    maxPlayers: 8,
    playersLabel: '2–8 Players',
    deckType: 'Standard 52-Card Deck',
    accentHex: '#C5A059',
    rulesSummary: [
      'The uppermost card on the central stack is always face-up and clearly visible.',
      'Play matching card(s) onto the stack following the room rule, or pick up the stack.',
      'Matching rank can push the stack onto the previous player or burn the pile.',
    ],
    rulesDetails: {
      objective:
        'Shed your entire hand first (or bank the most captured cards in Collector mode).',
      setup:
        'Each player receives 7 cards and the remaining deck forms a draw stockpile. An opening card starts the visible central stack.',
      gameplay: [
        'The uppermost card played on the central stack stays face-up so every player sees it clearly.',
        'Depending on the room variant, play a card matching rank/suit, equal-or-higher rank, or drop multiple same-rank cards together.',
        'If you play the exact same rank as the uppermost card, the capture rule triggers (push stack to the previous player, bank it, or burn it for a bonus turn).',
        'If Tens Burn & Aces Skip is active, playing any 10 clears the central stack and grants an extra play, while Aces skip the next player.',
      ],
      winning:
        'In Shedding variants, the first player to reach 0 cards after the draw pile empties wins. In Collector mode, highest banked card count wins when hands clear.',
      variants: [
        'Match Rule: Rank or Suit / Exact Rank / Higher-or-Equal.',
        'Capture Trigger: Send Stack to Previous Player / Collect to Score / Burn + Bonus Turn.',
        'Allow Multi-Card Set plays of the same rank.',
      ],
    },
  },
  gadha_chor: {
    id: 'gadha_chor',
    name: 'Gadha Chor',
    tagline: 'Pair up your cards. Don’t keep the lonely one.',
    description:
      'Remove matching pairs, pick a hidden card from your neighbor’s fan, and avoid being left holding the unmatched card.',
    minPlayers: 2,
    maxPlayers: 8,
    playersLabel: '2–8 Players',
    deckType: '49 Cards (Q♠) or 53 Cards (+Joker)',
    accentHex: '#C5A059',
    rulesSummary: [
      'Discard matching pairs from your hand on your turn (or automatically at deal).',
      'Pick 1 face-down card from your active neighbor’s hand without seeing what it is.',
      'Everyone who clears all cards becomes Safe—the last player holding the odd card is Gadha Chor!',
    ],
    rulesDetails: {
      objective:
        'Pair off every card in your hand to escape before the single unmatched card traps you.',
      setup:
        'Either three Queens are removed leaving the lone Queen of Spades (49 cards), or one Joker is added (53 cards). Cards are dealt around the table.',
      gameplay: [
        'All players pair and discard matching pairs from their hand (manually or automatically depending on room settings).',
        'On your turn, tap any face-down card in your target neighbor’s fan to draw it secretly into your hand.',
        'If the drawn card forms a new pair, discard the pair (or let Auto-Pair clear it). Use Shuffle Hand anytime to disguise your card positions!',
      ],
      winning:
        'Players become Safe the instant their hand reaches 0 cards. The final player left holding the lone Q♠ or Joker is declared the Gadha Chor.',
      variants: [
        'Odd Card: Lone Queen of Spades (49 cards) or Lone Joker (53 cards).',
        'Pair Rule: Any Same Rank or Same Rank + Same Color.',
        'Manual Pair Drop (pick 2 cards) vs Auto-Discard Pairs.',
      ],
    },
  },
};

export const CARD_GAME_ORDER: CardGameId[] = ['uno', 'satyo', 'mongoose', 'gadha_chor'];
