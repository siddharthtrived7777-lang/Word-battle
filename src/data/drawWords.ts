import type { DrawWordPackId } from '../types/drawGuess';

export interface DrawWordEntry {
  word: string;
  pack: Exclude<DrawWordPackId, 'all'>;
}

export const DRAW_WORD_PACK_META: Record<
  DrawWordPackId,
  { labelEn: string; labelHi: string; descEn: string; descHi: string }
> = {
  all: {
    labelEn: 'All Mixed',
    labelHi: 'मिक्स पैक',
    descEn: 'Desi hits, animals, food, objects & adventure',
    descHi: 'देसी, जानवर, खाना, चीज़ें और एडवेंचर सब कुछ',
  },
  desi: {
    labelEn: 'Desi & India',
    labelHi: 'देसी स्पेशल',
    descEn: 'Samosa, auto rickshaw, Taj Mahal, cricket & festivals',
    descHi: 'समोसा, ऑटो रिक्शा, ताजमहल, क्रिकेट और त्योहार',
  },
  animals: {
    labelEn: 'Animals & Nature',
    labelHi: 'जानवर और प्रकृति',
    descEn: 'Wildlife, birds, oceans & natural wonders',
    descHi: 'जानवर, पक्षी, समुद्र और प्रकृति',
  },
  food: {
    labelEn: 'Food & Treats',
    labelHi: 'खाना और मिठाई',
    descEn: 'Street food, snacks, fruits & desserts',
    descHi: 'स्ट्रीट फूड, फल, स्नैक्स और मिठाइयाँ',
  },
  objects: {
    labelEn: 'Everyday Objects',
    labelHi: 'रोज़मर्रा की चीज़ें',
    descEn: 'Gadgets, instruments, tools & household items',
    descHi: 'गैजेट्स, वाद्य यंत्र और घर की चीज़ें',
  },
  adventure: {
    labelEn: 'Actions & Adventure',
    labelHi: 'एक्शन और एडवेंचर',
    descEn: 'Sports, space, fantasy & fun scenes',
    descHi: 'स्पोर्ट्स, स्पेस, फैंटेसी और मज़ेदार सीन',
  },
};

export const DRAW_WORDS: DrawWordEntry[] = [
  // Desi & India
  { word: 'Samosa', pack: 'desi' },
  { word: 'Auto Rickshaw', pack: 'desi' },
  { word: 'Taj Mahal', pack: 'desi' },
  { word: 'Chai Cup', pack: 'desi' },
  { word: 'Cricket Bat', pack: 'desi' },
  { word: 'Cricket Stumps', pack: 'desi' },
  { word: 'Diya Lamp', pack: 'desi' },
  { word: 'Jalebi', pack: 'desi' },
  { word: 'Peacock', pack: 'desi' },
  { word: 'Kite', pack: 'desi' },
  { word: 'Dhol', pack: 'desi' },
  { word: 'Tabla', pack: 'desi' },
  { word: 'Flute', pack: 'desi' },
  { word: 'Lotus', pack: 'desi' },
  { word: 'Mango', pack: 'desi' },
  { word: 'Coconut Tree', pack: 'desi' },
  { word: 'Bangles', pack: 'desi' },
  { word: 'Turban', pack: 'desi' },
  { word: 'Tiffin Box', pack: 'desi' },
  { word: 'Scooter', pack: 'desi' },
  { word: 'Masala Dosa', pack: 'desi' },
  { word: 'Pani Puri', pack: 'desi' },
  { word: 'Ludo Board', pack: 'desi' },
  { word: 'Carrom Board', pack: 'desi' },
  { word: 'Rangoli', pack: 'desi' },
  { word: 'Banyan Tree', pack: 'desi' },
  { word: 'Ceiling Fan', pack: 'desi' },
  { word: 'Pressure Cooker', pack: 'desi' },
  { word: 'India Gate', pack: 'desi' },
  { word: 'Holi Colors', pack: 'desi' },
  { word: 'Firecrackers', pack: 'desi' },
  { word: 'Biryani Pot', pack: 'desi' },
  { word: 'Gulab Jamun', pack: 'desi' },
  { word: 'Rolling Pin', pack: 'desi' },
  { word: 'Clay Pot', pack: 'desi' },

  // Animals & Nature
  { word: 'Elephant', pack: 'animals' },
  { word: 'Giraffe', pack: 'animals' },
  { word: 'Penguin', pack: 'animals' },
  { word: 'Octopus', pack: 'animals' },
  { word: 'Butterfly', pack: 'animals' },
  { word: 'Flamingo', pack: 'animals' },
  { word: 'Kangaroo', pack: 'animals' },
  { word: 'Jellyfish', pack: 'animals' },
  { word: 'Turtle', pack: 'animals' },
  { word: 'Shark', pack: 'animals' },
  { word: 'Whale', pack: 'animals' },
  { word: 'Dolphin', pack: 'animals' },
  { word: 'Crocodile', pack: 'animals' },
  { word: 'Owl', pack: 'animals' },
  { word: 'Spider Web', pack: 'animals' },
  { word: 'Honeybee', pack: 'animals' },
  { word: 'Cactus', pack: 'animals' },
  { word: 'Volcano', pack: 'animals' },
  { word: 'Rainbow', pack: 'animals' },
  { word: 'Waterfall', pack: 'animals' },
  { word: 'Tornado', pack: 'animals' },
  { word: 'Mushroom', pack: 'animals' },
  { word: 'Sunflower', pack: 'animals' },
  { word: 'Snowman', pack: 'animals' },
  { word: 'Crescent Moon', pack: 'animals' },
  { word: 'Coral Reef', pack: 'animals' },
  { word: 'Snail', pack: 'animals' },
  { word: 'Camel', pack: 'animals' },
  { word: 'Hedgehog', pack: 'animals' },
  { word: 'Panda', pack: 'animals' },

  // Food & Treats
  { word: 'Pizza', pack: 'food' },
  { word: 'Burger', pack: 'food' },
  { word: 'Ice Cream Cone', pack: 'food' },
  { word: 'Donut', pack: 'food' },
  { word: 'Watermelon', pack: 'food' },
  { word: 'Cupcake', pack: 'food' },
  { word: 'Popcorn', pack: 'food' },
  { word: 'French Fries', pack: 'food' },
  { word: 'Sushi', pack: 'food' },
  { word: 'Pancake', pack: 'food' },
  { word: 'Pineapple', pack: 'food' },
  { word: 'Strawberry', pack: 'food' },
  { word: 'Banana', pack: 'food' },
  { word: 'Birthday Cake', pack: 'food' },
  { word: 'Lollipop', pack: 'food' },
  { word: 'Sandwich', pack: 'food' },
  { word: 'Noodles', pack: 'food' },
  { word: 'Taco', pack: 'food' },
  { word: 'Coffee Mug', pack: 'food' },
  { word: 'Fried Egg', pack: 'food' },
  { word: 'Chocolate Bar', pack: 'food' },
  { word: 'Avocado', pack: 'food' },
  { word: 'Grapes', pack: 'food' },
  { word: 'Pretzel', pack: 'food' },
  { word: 'Milkshake', pack: 'food' },
  { word: 'Apple Pie', pack: 'food' },
  { word: 'Hot Dog', pack: 'food' },
  { word: 'Cheese', pack: 'food' },

  // Everyday Objects
  { word: 'Umbrella', pack: 'objects' },
  { word: 'Headphones', pack: 'objects' },
  { word: 'Guitar', pack: 'objects' },
  { word: 'Camera', pack: 'objects' },
  { word: 'Lightbulb', pack: 'objects' },
  { word: 'Bicycle', pack: 'objects' },
  { word: 'Skateboard', pack: 'objects' },
  { word: 'Telescope', pack: 'objects' },
  { word: 'Hourglass', pack: 'objects' },
  { word: 'Scissors', pack: 'objects' },
  { word: 'Backpack', pack: 'objects' },
  { word: 'Compass', pack: 'objects' },
  { word: 'Crown', pack: 'objects' },
  { word: 'Anchor', pack: 'objects' },
  { word: 'Key', pack: 'objects' },
  { word: 'Alarm Clock', pack: 'objects' },
  { word: 'Toothbrush', pack: 'objects' },
  { word: 'Sunglasses', pack: 'objects' },
  { word: 'Paintbrush', pack: 'objects' },
  { word: 'Ladder', pack: 'objects' },
  { word: 'Laptop', pack: 'objects' },
  { word: 'Candle', pack: 'objects' },
  { word: 'Magnet', pack: 'objects' },
  { word: 'Trophy', pack: 'objects' },
  { word: 'Balloon', pack: 'objects' },
  { word: 'Envelope', pack: 'objects' },
  { word: 'Microphone', pack: 'objects' },
  { word: 'Binoculars', pack: 'objects' },
  { word: 'Padlock', pack: 'objects' },
  { word: 'Hammer', pack: 'objects' },

  // Actions & Adventure
  { word: 'Astronaut', pack: 'adventure' },
  { word: 'Rocket', pack: 'adventure' },
  { word: 'Pirate Ship', pack: 'adventure' },
  { word: 'Submarine', pack: 'adventure' },
  { word: 'Hot Air Balloon', pack: 'adventure' },
  { word: 'Castle', pack: 'adventure' },
  { word: 'Campfire', pack: 'adventure' },
  { word: 'Surfing', pack: 'adventure' },
  { word: 'Skydiving', pack: 'adventure' },
  { word: 'Fishing', pack: 'adventure' },
  { word: 'Wizard Hat', pack: 'adventure' },
  { word: 'Robot', pack: 'adventure' },
  { word: 'Dinosaur', pack: 'adventure' },
  { word: 'Dragon', pack: 'adventure' },
  { word: 'Treasure Chest', pack: 'adventure' },
  { word: 'Lighthouse', pack: 'adventure' },
  { word: 'Helicopter', pack: 'adventure' },
  { word: 'Rollercoaster', pack: 'adventure' },
  { word: 'Ferris Wheel', pack: 'adventure' },
  { word: 'Scuba Diver', pack: 'adventure' },
  { word: 'Magician', pack: 'adventure' },
  { word: 'Ninja', pack: 'adventure' },
  { word: 'Superhero', pack: 'adventure' },
  { word: 'Ghost', pack: 'adventure' },
  { word: 'Alien UFO', pack: 'adventure' },
  { word: 'Bowling', pack: 'adventure' },
  { word: 'Archery', pack: 'adventure' },
  { word: 'Sailboat', pack: 'adventure' },
  { word: 'Treehouse', pack: 'adventure' },
  { word: 'Train', pack: 'adventure' },
];

export function pickDrawWordChoices(
  pack: DrawWordPackId,
  usedWords: string[],
  count = 3
): DrawWordEntry[] {
  const usedSet = new Set(usedWords.map((w) => normalizeGuessText(w)));
  const pool =
    pack === 'all' ? DRAW_WORDS : DRAW_WORDS.filter((entry) => entry.pack === pack);

  let available = pool.filter((entry) => !usedSet.has(normalizeGuessText(entry.word)));
  if (available.length < count) {
    available = [...pool];
  }

  // Fisher-Yates shuffle
  const shuffled = [...available];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

export function normalizeGuessText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function computeWordLengths(word: string): number[] {
  return word
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.replace(/[^a-zA-Z0-9]/g, '').length);
}

/**
 * Generates an initial masked hint string such as "_ _ _ _   _ _ _"
 * and supports revealing specific character indices.
 */
export function buildHintMask(word: string, revealIndices: number[] = []): string {
  const revealSet = new Set(revealIndices);
  let letterCursor = 0;
  const chars: string[] = [];
  for (const ch of word.trim()) {
    if (ch === ' ') {
      chars.push('   ');
    } else if (/[a-zA-Z0-9]/.test(ch)) {
      chars.push(revealSet.has(letterCursor) ? ch.toUpperCase() : '_');
      letterCursor++;
    }
  }
  return chars.join(' ').replace(/\s{4,}/g, '   ');
}

/**
 * Computes deterministic SHA-256 hex digest using Web Crypto API (with safe fallback).
 */
export async function hashDrawGuess(
  roomCode: string,
  turnKey: string,
  normalizedGuess: string
): Promise<string> {
  const payload = `${roomCode.toUpperCase()}:${turnKey}:${normalizedGuess}`;
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const data = new TextEncoder().encode(payload);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Deterministic fallback hash if subtle is unavailable in non-secure context
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < payload.length; i++) {
    const ch = payload.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  return `${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}`;
}

/**
 * Builds up to 10 close-variant normalized strings (plural/singular, spaceless, single-word sub-parts)
 * so close guesses give helpful "Close!" feedback without exposing the secret word.
 */
export function buildCloseVariants(word: string): string[] {
  const norm = normalizeGuessText(word);
  if (!norm) return [];
  const variants = new Set<string>();

  const noSpaces = norm.replace(/\s+/g, '');
  if (noSpaces !== norm) variants.add(noSpaces);

  if (norm.endsWith('s') && norm.length > 3) {
    variants.add(norm.slice(0, -1));
  } else if (norm.length > 2) {
    variants.add(`${norm}s`);
  }

  const parts = norm.split(' ');
  if (parts.length === 2) {
    for (const part of parts) {
      if (part.length >= 4) variants.add(part);
    }
  }

  // Add first-prefix near misses for longer words
  if (norm.length >= 6) {
    variants.add(norm.slice(0, -1));
  }

  variants.delete(norm);
  return Array.from(variants).slice(0, 10);
}
