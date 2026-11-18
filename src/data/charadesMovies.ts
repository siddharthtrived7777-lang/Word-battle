import { CharadesCategory, CharadesMovieItem } from '../types/charades';

export const CHARADES_CATEGORIES: CharadesCategory[] = [
  'Bollywood Classics',
  'Modern Bollywood',
  'Popular Movies',
  'Comedy',
  'Romantic',
  'Action',
  'Thriller',
  'Horror',
  'Family',
  'Difficult Movies',
  'Regional Cinema',
  'Hollywood',
];

export const CHARADES_LANGUAGES = [
  'Hindi',
  'Tamil',
  'Telugu',
  'Malayalam',
  'Kannada',
  'Marathi',
  'Bengali',
  'English',
];

export const CHARADES_MOVIES: CharadesMovieItem[] = [
  // Bollywood Classics
  { id: 'bc_1', title: 'SHOLAY', category: 'Bollywood Classics', language: 'Hindi', difficulty: 'Easy', popular: true },
  { id: 'bc_2', title: 'MUGHAL E AZAM', category: 'Bollywood Classics', language: 'Hindi', difficulty: 'Medium', popular: true },
  { id: 'bc_3', title: 'DEEWAAR', category: 'Bollywood Classics', language: 'Hindi', difficulty: 'Easy' },
  { id: 'bc_4', title: 'AMAR AKBAR ANTHONY', category: 'Bollywood Classics', language: 'Hindi', difficulty: 'Medium', popular: true },
  { id: 'bc_5', title: 'MR INDIA', category: 'Bollywood Classics', language: 'Hindi', difficulty: 'Easy', popular: true },
  { id: 'bc_6', title: 'DON', category: 'Bollywood Classics', language: 'Hindi', difficulty: 'Easy' },
  { id: 'bc_7', title: 'ANAND', category: 'Bollywood Classics', language: 'Hindi', difficulty: 'Medium' },
  { id: 'bc_8', title: 'CHUPKE CHUPKE', category: 'Bollywood Classics', language: 'Hindi', difficulty: 'Medium' },
  { id: 'bc_9', title: 'GOL MAAL', category: 'Bollywood Classics', language: 'Hindi', difficulty: 'Medium' },
  { id: 'bc_10', title: 'MOTHER INDIA', category: 'Bollywood Classics', language: 'Hindi', difficulty: 'Medium' },
  { id: 'bc_11', title: 'PAKEEZAH', category: 'Bollywood Classics', language: 'Hindi', difficulty: 'Hard' },
  { id: 'bc_12', title: 'GUIDE', category: 'Bollywood Classics', language: 'Hindi', difficulty: 'Medium' },

  // Modern Bollywood
  { id: 'mb_1', title: 'DRISHYAM 3', category: 'Modern Bollywood', language: 'Hindi', difficulty: 'Medium', popular: true },
  { id: 'mb_2', title: '3 IDIOTS', category: 'Modern Bollywood', language: 'Hindi', difficulty: 'Easy', popular: true },
  { id: 'mb_3', title: 'DANGAL', category: 'Modern Bollywood', language: 'Hindi', difficulty: 'Easy', popular: true },
  { id: 'mb_4', title: 'LAGAAN', category: 'Modern Bollywood', language: 'Hindi', difficulty: 'Easy', popular: true },
  { id: 'mb_5', title: 'PK', category: 'Modern Bollywood', language: 'Hindi', difficulty: 'Easy', popular: true },
  { id: 'mb_6', title: 'BAJRANGI BHAIJAAN', category: 'Modern Bollywood', language: 'Hindi', difficulty: 'Medium', popular: true },
  { id: 'mb_7', title: 'ZINDAGI NA MILEGI DOBARA', category: 'Modern Bollywood', language: 'Hindi', difficulty: 'Medium', popular: true },
  { id: 'mb_8', title: 'CHAK DE INDIA', category: 'Modern Bollywood', language: 'Hindi', difficulty: 'Easy', popular: true },
  { id: 'mb_9', title: 'GULLY BOY', category: 'Modern Bollywood', language: 'Hindi', difficulty: 'Easy' },
  { id: 'mb_10', title: 'QUEEN', category: 'Modern Bollywood', language: 'Hindi', difficulty: 'Easy' },
  { id: 'mb_11', title: 'BARFI', category: 'Modern Bollywood', language: 'Hindi', difficulty: 'Medium' },
  { id: 'mb_12', title: 'JAWAN', category: 'Modern Bollywood', language: 'Hindi', difficulty: 'Easy', popular: true },
  { id: 'mb_13', title: 'PATHAAN', category: 'Modern Bollywood', language: 'Hindi', difficulty: 'Easy', popular: true },
  { id: 'mb_14', title: 'ANIMAL', category: 'Modern Bollywood', language: 'Hindi', difficulty: 'Easy' },
  { id: 'mb_15', title: 'STREE 2', category: 'Modern Bollywood', language: 'Hindi', difficulty: 'Easy', popular: true },
  { id: 'mb_16', title: '12TH FAIL', category: 'Modern Bollywood', language: 'Hindi', difficulty: 'Medium', popular: true },
  { id: 'mb_17', title: 'LAAPATAA LADIES', category: 'Modern Bollywood', language: 'Hindi', difficulty: 'Medium', popular: true },

  // Comedy
  { id: 'cm_1', title: 'HERA PHERI', category: 'Comedy', language: 'Hindi', difficulty: 'Easy', popular: true },
  { id: 'cm_2', title: 'PHIR HERA PHERI', category: 'Comedy', language: 'Hindi', difficulty: 'Easy', popular: true },
  { id: 'cm_3', title: 'ANDAZ APNA APNA', category: 'Comedy', language: 'Hindi', difficulty: 'Medium', popular: true },
  { id: 'cm_4', title: 'MUNNA BHAI MBBS', category: 'Comedy', language: 'Hindi', difficulty: 'Medium', popular: true },
  { id: 'cm_5', title: 'WELCOME', category: 'Comedy', language: 'Hindi', difficulty: 'Easy', popular: true },
  { id: 'cm_6', title: 'BHOOL BHULAIYAA', category: 'Comedy', language: 'Hindi', difficulty: 'Medium', popular: true },
  { id: 'cm_7', title: 'DHAMAAL', category: 'Comedy', language: 'Hindi', difficulty: 'Easy' },
  { id: 'cm_8', title: 'GOLMAAL FUN UNLIMITED', category: 'Comedy', language: 'Hindi', difficulty: 'Medium' },
  { id: 'cm_9', title: 'HUNGAMA', category: 'Comedy', language: 'Hindi', difficulty: 'Easy' },
  { id: 'cm_10', title: 'CHHICHHORE', category: 'Comedy', language: 'Hindi', difficulty: 'Medium' },
  { id: 'cm_11', title: 'DELHI BELLY', category: 'Comedy', language: 'Hindi', difficulty: 'Medium' },
  { id: 'cm_12', title: 'STREE', category: 'Comedy', language: 'Hindi', difficulty: 'Easy', popular: true },

  // Romantic
  { id: 'rm_1', title: 'DILWALE DULHANIA LE JAYENGE', category: 'Romantic', language: 'Hindi', difficulty: 'Medium', popular: true },
  { id: 'rm_2', title: 'KUCH KUCH HOTA HAI', category: 'Romantic', language: 'Hindi', difficulty: 'Easy', popular: true },
  { id: 'rm_3', title: 'JAB WE MET', category: 'Romantic', language: 'Hindi', difficulty: 'Easy', popular: true },
  { id: 'rm_4', title: 'YEH JAWAANI HAI DEEWANI', category: 'Romantic', language: 'Hindi', difficulty: 'Medium', popular: true },
  { id: 'rm_5', title: 'KAL HO NAA HO', category: 'Romantic', language: 'Hindi', difficulty: 'Medium', popular: true },
  { id: 'rm_6', title: 'VEER ZAARA', category: 'Romantic', language: 'Hindi', difficulty: 'Medium' },
  { id: 'rm_7', title: 'ROCKSTAR', category: 'Romantic', language: 'Hindi', difficulty: 'Easy' },
  { id: 'rm_8', title: 'AASHIQUI 2', category: 'Romantic', language: 'Hindi', difficulty: 'Easy' },
  { id: 'rm_9', title: 'TAMASHA', category: 'Romantic', language: 'Hindi', difficulty: 'Medium' },
  { id: 'rm_10', title: 'OM SHANTI OM', category: 'Romantic', language: 'Hindi', difficulty: 'Easy', popular: true },

  // Action
  { id: 'ac_1', title: 'WAR', category: 'Action', language: 'Hindi', difficulty: 'Easy', popular: true },
  { id: 'ac_2', title: 'SINGHAM', category: 'Action', language: 'Hindi', difficulty: 'Easy', popular: true },
  { id: 'ac_3', title: 'DABANGG', category: 'Action', language: 'Hindi', difficulty: 'Easy', popular: true },
  { id: 'ac_4', title: 'DHOOM 2', category: 'Action', language: 'Hindi', difficulty: 'Easy', popular: true },
  { id: 'ac_5', title: 'GHAJINI', category: 'Action', language: 'Hindi', difficulty: 'Medium' },
  { id: 'ac_6', title: 'URI THE SURGICAL STRIKE', category: 'Action', language: 'Hindi', difficulty: 'Medium' },
  { id: 'ac_7', title: 'KRRISH', category: 'Action', language: 'Hindi', difficulty: 'Easy' },
  { id: 'ac_8', title: 'TIGER ZINDA HAI', category: 'Action', language: 'Hindi', difficulty: 'Medium' },
  { id: 'ac_9', title: 'BAAGHI', category: 'Action', language: 'Hindi', difficulty: 'Easy' },
  { id: 'ac_10', title: 'SULTAN', category: 'Action', language: 'Hindi', difficulty: 'Easy', popular: true },

  // Thriller
  { id: 'th_1', title: 'ANDHADHUN', category: 'Thriller', language: 'Hindi', difficulty: 'Medium', popular: true },
  { id: 'th_2', title: 'DRISHYAM', category: 'Thriller', language: 'Hindi', difficulty: 'Medium', popular: true },
  { id: 'th_3', title: 'KAHAANI', category: 'Thriller', language: 'Hindi', difficulty: 'Easy', popular: true },
  { id: 'th_4', title: 'A WEDNESDAY', category: 'Thriller', language: 'Hindi', difficulty: 'Medium' },
  { id: 'th_5', title: 'SPECIAL 26', category: 'Thriller', language: 'Hindi', difficulty: 'Medium' },
  { id: 'th_6', title: 'TALAASH', category: 'Thriller', language: 'Hindi', difficulty: 'Medium' },
  { id: 'th_7', title: 'BADLA', category: 'Thriller', language: 'Hindi', difficulty: 'Easy' },
  { id: 'th_8', title: 'RACE', category: 'Thriller', language: 'Hindi', difficulty: 'Easy' },
  { id: 'th_9', title: 'BABY', category: 'Thriller', language: 'Hindi', difficulty: 'Easy' },

  // Horror
  { id: 'hr_1', title: 'TUMBBAD', category: 'Horror', language: 'Hindi', difficulty: 'Medium', popular: true },
  { id: 'hr_2', title: 'RAAZ', category: 'Horror', language: 'Hindi', difficulty: 'Easy' },
  { id: 'hr_3', title: 'BHOOT', category: 'Horror', language: 'Hindi', difficulty: 'Easy' },
  { id: 'hr_4', title: 'BHEDIYA', category: 'Horror', language: 'Hindi', difficulty: 'Easy' },
  { id: 'hr_5', title: 'MUNJYA', category: 'Horror', language: 'Hindi', difficulty: 'Medium' },
  { id: 'hr_6', title: '1920', category: 'Horror', language: 'Hindi', difficulty: 'Medium' },
  { id: 'hr_7', title: 'PARI', category: 'Horror', language: 'Hindi', difficulty: 'Medium' },
  { id: 'hr_8', title: 'MAKDII', category: 'Horror', language: 'Hindi', difficulty: 'Medium' },

  // Family
  { id: 'fm_1', title: 'KABHI KHUSHI KABHIE GHAM', category: 'Family', language: 'Hindi', difficulty: 'Medium', popular: true },
  { id: 'fm_2', title: 'HUM AAPKE HAIN KOUN', category: 'Family', language: 'Hindi', difficulty: 'Medium', popular: true },
  { id: 'fm_3', title: 'TAARE ZAMEEN PAR', category: 'Family', language: 'Hindi', difficulty: 'Medium', popular: true },
  { id: 'fm_4', title: 'PIKU', category: 'Family', language: 'Hindi', difficulty: 'Easy' },
  { id: 'fm_5', title: 'ENGLISH VINGLISH', category: 'Family', language: 'Hindi', difficulty: 'Medium' },
  { id: 'fm_6', title: 'BAGHBAN', category: 'Family', language: 'Hindi', difficulty: 'Medium' },
  { id: 'fm_7', title: 'HUM SAATH SAATH HAIN', category: 'Family', language: 'Hindi', difficulty: 'Medium' },
  { id: 'fm_8', title: 'BOMBAY TO GOA', category: 'Family', language: 'Hindi', difficulty: 'Medium' },

  // Difficult Movies
  { id: 'df_1', title: 'JAANE BHI DO YAARO', category: 'Difficult Movies', language: 'Hindi', difficulty: 'Hard' },
  { id: 'df_2', title: 'GANGS OF WASSEYPUR', category: 'Difficult Movies', language: 'Hindi', difficulty: 'Hard', popular: true },
  { id: 'df_3', title: 'SHIP OF THESEUS', category: 'Difficult Movies', language: 'Hindi', difficulty: 'Hard' },
  { id: 'df_4', title: 'MASAAN', category: 'Difficult Movies', language: 'Hindi', difficulty: 'Hard' },
  { id: 'df_5', title: 'UDAAN', category: 'Difficult Movies', language: 'Hindi', difficulty: 'Hard' },
  { id: 'df_6', title: 'OMKARA', category: 'Difficult Movies', language: 'Hindi', difficulty: 'Hard' },
  { id: 'df_7', title: 'HAIDER', category: 'Difficult Movies', language: 'Hindi', difficulty: 'Hard' },
  { id: 'df_8', title: 'MAQBOOL', category: 'Difficult Movies', language: 'Hindi', difficulty: 'Hard' },
  { id: 'df_9', title: 'AJAB PREM KI GHAZAB KAHANI', category: 'Difficult Movies', language: 'Hindi', difficulty: 'Hard', popular: true },
  { id: 'df_10', title: 'SONU KE TITU KI SWEETY', category: 'Difficult Movies', language: 'Hindi', difficulty: 'Hard' },

  // Regional Cinema
  { id: 'rg_1', title: 'RRR', category: 'Regional Cinema', language: 'Telugu', difficulty: 'Easy', popular: true },
  { id: 'rg_2', title: 'BAAHUBALI', category: 'Regional Cinema', language: 'Telugu', difficulty: 'Easy', popular: true },
  { id: 'rg_3', title: 'KGF CHAPTER 2', category: 'Regional Cinema', language: 'Kannada', difficulty: 'Medium', popular: true },
  { id: 'rg_4', title: 'KANTARA', category: 'Regional Cinema', language: 'Kannada', difficulty: 'Medium', popular: true },
  { id: 'rg_5', title: 'PUSHPA THE RISE', category: 'Regional Cinema', language: 'Telugu', difficulty: 'Medium', popular: true },
  { id: 'rg_6', title: 'VIKRAM', category: 'Regional Cinema', language: 'Tamil', difficulty: 'Easy' },
  { id: 'rg_7', title: 'SAIRAT', category: 'Regional Cinema', language: 'Marathi', difficulty: 'Medium' },
  { id: 'rg_8', title: 'NATARANG', category: 'Regional Cinema', language: 'Marathi', difficulty: 'Hard' },
  { id: 'rg_9', title: 'PREMAM', category: 'Regional Cinema', language: 'Malayalam', difficulty: 'Medium' },
  { id: 'rg_10', title: 'MANICHITRATHAZHU', category: 'Regional Cinema', language: 'Malayalam', difficulty: 'Hard' },
  { id: 'rg_11', title: 'PATHER PANCHALI', category: 'Regional Cinema', language: 'Bengali', difficulty: 'Hard' },
  { id: 'rg_12', title: 'SUPER DELUXE', category: 'Regional Cinema', language: 'Tamil', difficulty: 'Hard' },

  // Hollywood
  { id: 'hw_1', title: 'TITANIC', category: 'Hollywood', language: 'English', difficulty: 'Easy', popular: true },
  { id: 'hw_2', title: 'INCEPTION', category: 'Hollywood', language: 'English', difficulty: 'Medium', popular: true },
  { id: 'hw_3', title: 'AVATAR', category: 'Hollywood', language: 'English', difficulty: 'Easy', popular: true },
  { id: 'hw_4', title: 'JURASSIC PARK', category: 'Hollywood', language: 'English', difficulty: 'Easy', popular: true },
  { id: 'hw_5', title: 'THE DARK KNIGHT', category: 'Hollywood', language: 'English', difficulty: 'Medium', popular: true },
  { id: 'hw_6', title: 'INTERSTELLAR', category: 'Hollywood', language: 'English', difficulty: 'Medium', popular: true },
  { id: 'hw_7', title: 'AVENGERS ENDGAME', category: 'Hollywood', language: 'English', difficulty: 'Medium', popular: true },
  { id: 'hw_8', title: 'THE LION KING', category: 'Hollywood', language: 'English', difficulty: 'Easy', popular: true },
  { id: 'hw_9', title: 'SPIDER MAN', category: 'Hollywood', language: 'English', difficulty: 'Easy', popular: true },
  { id: 'hw_10', title: 'HOME ALONE', category: 'Hollywood', language: 'English', difficulty: 'Easy' },
  { id: 'hw_11', title: 'THE MATRIX', category: 'Hollywood', language: 'English', difficulty: 'Medium' },
  { id: 'hw_12', title: 'FORREST GUMP', category: 'Hollywood', language: 'English', difficulty: 'Medium' },
];

export function splitMovieWords(rawTitle: string): {
  cleanTitle: string;
  words: string[];
  wordLengths: number[];
} {
  const cleanTitle = rawTitle.trim().replace(/\s+/g, ' ').toUpperCase();
  const words = cleanTitle.split(' ').filter(Boolean);
  const wordLengths = words.map((w) => w.replace(/[^A-Z0-9\u0900-\u097F]/gi, '').length || w.length);
  return { cleanTitle, words, wordLengths };
}
