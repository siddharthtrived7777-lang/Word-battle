import React, { useMemo, useState } from 'react';
import {
  Check,
  Clapperboard,
  Eye,
  EyeOff,
  Film,
  Search,
  Shuffle,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import {
  CHARADES_CATEGORIES,
  CHARADES_LANGUAGES,
  CHARADES_MOVIES,
  splitMovieWords,
} from '../data/charadesMovies';
import {
  CharadesCategory,
  CharadesDifficulty,
  CharadesMovieItem,
  CharadesPlayer,
  CharadesRoomState,
} from '../types/charades';
import { Language } from '../types/game';
import { t } from '../data/i18n';

interface CharadesMovieSelectorProps {
  lang: Language;
  room: CharadesRoomState;
  actorPlayers: CharadesPlayer[];
  allPlayers: CharadesPlayer[];
  submitting: boolean;
  onChangeTargetActor?: (actorId: string) => void;
  onAssignMovie: (payload: {
    title: string;
    category: string;
    language: string;
    difficulty: CharadesDifficulty;
    hintsEnabled: boolean;
  }) => Promise<void>;
}

export const CharadesMovieSelector: React.FC<CharadesMovieSelectorProps> = ({
  lang,
  room,
  actorPlayers,
  allPlayers,
  submitting,
  onChangeTargetActor,
  onAssignMovie,
}) => {
  const [tab, setTab] = useState<'library' | 'custom'>('library');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'All' | CharadesCategory>('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState<'All' | CharadesDifficulty>('All');
  const [selectedMovie, setSelectedMovie] = useState<CharadesMovieItem | null>(
    CHARADES_MOVIES[0] ?? null
  );

  // Custom movie state
  const [customTitle, setCustomTitle] = useState('');
  const [customLanguage, setCustomLanguage] = useState('Hindi');
  const [customCategory, setCustomCategory] = useState<string>('Modern Bollywood');
  const [customDifficulty, setCustomDifficulty] = useState<CharadesDifficulty>('Medium');

  const [hintsEnabled, setHintsEnabled] = useState(true);

  const filteredMovies = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return CHARADES_MOVIES.filter((m) => {
      if (selectedCategory === 'Popular Movies') {
        if (!m.popular) return false;
      } else if (selectedCategory !== 'All' && m.category !== selectedCategory) {
        return false;
      }
      if (selectedDifficulty !== 'All' && m.difficulty !== selectedDifficulty) {
        return false;
      }
      if (q) {
        return (
          m.title.toLowerCase().includes(q) ||
          m.category.toLowerCase().includes(q) ||
          m.language.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [searchQuery, selectedCategory, selectedDifficulty]);

  const handlePickRandom = () => {
    const pool = filteredMovies.length > 0 ? filteredMovies : CHARADES_MOVIES;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (pick) {
      setSelectedMovie(pick);
      setTab('library');
    }
  };

  const activeDraft = useMemo(() => {
    if (tab === 'custom') {
      const split = splitMovieWords(customTitle);
      return {
        title: split.cleanTitle,
        words: split.words,
        wordLengths: split.wordLengths,
        category: customCategory || 'Custom',
        language: customLanguage || 'Hindi',
        difficulty: customDifficulty,
      };
    }
    if (!selectedMovie) return null;
    const split = splitMovieWords(selectedMovie.title);
    return {
      title: split.cleanTitle,
      words: split.words,
      wordLengths: split.wordLengths,
      category: selectedMovie.category,
      language: selectedMovie.language,
      difficulty: selectedMovie.difficulty,
    };
  }, [customCategory, customDifficulty, customLanguage, customTitle, selectedMovie, tab]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDraft || activeDraft.words.length === 0 || submitting) return;
    await onAssignMovie({
      title: activeDraft.title,
      category: activeDraft.category,
      language: activeDraft.language,
      difficulty: activeDraft.difficulty,
      hintsEnabled,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-3xl bg-gradient-to-b from-[#23113A] via-[#180C29] to-[#120820] border border-amber-500/30 p-5 sm:p-6 space-y-5 shadow-2xl"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
            <Clapperboard className="w-4 h-4" />
            <span>
              {lang === 'hi'
                ? 'गुप्त मूवी चयन (केवल एक्टर को दिखेगी)'
                : 'Private Assignment · Hidden from Guessers'}
            </span>
          </div>
          <h2 className="font-display text-xl sm:text-2xl font-extrabold text-amber-50 mt-1">
            {t(lang, 'dcSelectingMovieTitle')}
          </h2>
          <p className="text-xs sm:text-sm text-amber-100/70 mt-0.5">
            {lang === 'hi'
              ? `एक्टर: ${actorPlayers.map((p) => p.name).join(', ') || '—'}`
              : `Sending privately to: ${actorPlayers.map((p) => p.name).join(', ') || '—'}`}
          </p>
        </div>

        <button
          type="button"
          onClick={handlePickRandom}
          className="min-h-[44px] px-4 rounded-2xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/40 text-amber-300 font-display font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shrink-0 transition-colors"
        >
          <Shuffle className="w-4 h-4" />
          <span>{lang === 'hi' ? 'रैंडम मूवी चुनें' : 'Random Pick'}</span>
        </button>
      </div>

      {/* Individual Mode: Movie Giver can pick/adjust Target Actor */}
      {room.mode === 'individual' && onChangeTargetActor && (
        <div className="rounded-2xl bg-black/30 border border-white/10 p-3.5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-200">
            <UserCheck className="w-4 h-4 text-amber-400" />
            <span>
              {lang === 'hi' ? 'एक्टिंग करने वाला खिलाड़ी चुनें:' : 'Select Actor for This Movie:'}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {allPlayers.map((p) => {
              const selected = room.actorIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onChangeTargetActor(p.id)}
                  className={`min-h-[40px] px-3.5 rounded-xl text-xs font-semibold transition-all ${
                    selected
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                      : 'bg-white/5 hover:bg-white/10 text-amber-100 border border-white/10'
                  }`}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Mode Tabs: Library vs Custom Movie */}
      <div className="grid grid-cols-2 p-1 rounded-2xl bg-black/35 border border-white/10">
        <button
          type="button"
          onClick={() => setTab('library')}
          className={`min-h-[44px] rounded-xl font-display font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors ${
            tab === 'library'
              ? 'bg-gradient-to-r from-rose-700 to-amber-600 text-white shadow'
              : 'text-amber-100/70 hover:text-white'
          }`}
        >
          <Film className="w-4 h-4" />
          <span>{lang === 'hi' ? 'मूवी लाइब्रेरी (115+)' : 'Movie Library (115+)'}</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('custom')}
          className={`min-h-[44px] rounded-xl font-display font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors ${
            tab === 'custom'
              ? 'bg-gradient-to-r from-rose-700 to-amber-600 text-white shadow'
              : 'text-amber-100/70 hover:text-white'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>{lang === 'hi' ? 'अपनी मूवी लिखें' : 'Custom Movie Title'}</span>
        </button>
      </div>

      {tab === 'library' ? (
        <div className="space-y-3.5">
          {/* Search + Difficulty Filter */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            <div className="sm:col-span-8 relative">
              <Search className="w-4 h-4 text-amber-300/60 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  lang === 'hi'
                    ? 'मूवी नाम, भाषा या कैटेगरी खोजें...'
                    : 'Search Bollywood, Regional, or Hollywood movies...'
                }
                className="w-full h-11 pl-10 pr-4 rounded-xl bg-black/40 border border-white/15 text-sm text-white placeholder:text-amber-100/40 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="sm:col-span-4 grid grid-cols-4 gap-1 bg-black/40 border border-white/10 rounded-xl p-1">
              {(['All', 'Easy', 'Medium', 'Hard'] as const).map((diff) => (
                <button
                  key={diff}
                  type="button"
                  onClick={() => setSelectedDifficulty(diff)}
                  className={`min-h-[36px] rounded-lg text-[11px] font-bold transition-colors ${
                    selectedDifficulty === diff
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-amber-100/70 hover:text-white'
                  }`}
                >
                  {diff}
                </button>
              ))}
            </div>
          </div>

          {/* Horizontal Category Strip */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1.5">
            {(['All', ...CHARADES_CATEGORIES] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`min-h-[38px] px-3.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                  selectedCategory === cat
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-white/5 hover:bg-white/10 text-amber-100/80 border border-white/10'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Movie Grid */}
          <div className="max-h-64 overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {filteredMovies.length === 0 ? (
              <div className="col-span-full py-8 text-center text-sm text-amber-100/60">
                {lang === 'hi'
                  ? 'कोई मूवी नहीं मिली। कस्टम मूवी टैब का उपयोग करें।'
                  : 'No matching movies found. Try clearing filters or switch to Custom Movie.'}
              </div>
            ) : (
              filteredMovies.map((movie) => {
                const isSelected = selectedMovie?.id === movie.id;
                const { words } = splitMovieWords(movie.title);
                return (
                  <button
                    key={movie.id}
                    type="button"
                    onClick={() => setSelectedMovie(movie)}
                    className={`min-h-[58px] text-left px-3.5 py-2.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-amber-500/20 border-amber-400 text-white shadow-md'
                        : 'bg-black/30 hover:bg-white/5 border-white/10 text-amber-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="font-display font-bold text-sm truncate">{movie.title}</p>
                      <p className="text-[11px] text-amber-200/70 truncate mt-0.5">
                        {movie.category} · {movie.language} · {movie.difficulty} · {words.length}{' '}
                        {words.length === 1 ? 'word' : 'words'}
                      </p>
                    </div>
                    {isSelected && (
                      <span className="w-6 h-6 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center shrink-0">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label
              htmlFor="custom-movie-title"
              className="block text-xs font-semibold text-amber-200 mb-1.5"
            >
              {lang === 'hi' ? 'मूवी का नाम लिखें' : 'Movie Title'}
            </label>
            <input
              id="custom-movie-title"
              type="text"
              maxLength={80}
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder={
                lang === 'hi' ? 'जैसे: DRISHYAM 3 या DIL CHAHTA HAI' : 'e.g. DRISHYAM 3 or DIL CHAHTA HAI'
              }
              className="w-full h-12 px-4 rounded-xl bg-black/40 border border-white/15 text-base font-display font-bold text-white placeholder:text-amber-100/35 focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-amber-200 mb-1.5">
                {lang === 'hi' ? 'भाषा' : 'Language'}
              </label>
              <select
                value={customLanguage}
                onChange={(e) => setCustomLanguage(e.target.value)}
                className="w-full h-11 px-3 rounded-xl bg-black/40 border border-white/15 text-sm text-white focus:outline-none focus:border-amber-400"
              >
                {CHARADES_LANGUAGES.map((l) => (
                  <option key={l} value={l} className="bg-[#180C29]">
                    {l}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-amber-200 mb-1.5">
                {lang === 'hi' ? 'कैटेगरी' : 'Category'}
              </label>
              <select
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                className="w-full h-11 px-3 rounded-xl bg-black/40 border border-white/15 text-sm text-white focus:outline-none focus:border-amber-400"
              >
                <option value="Custom" className="bg-[#180C29]">
                  Custom
                </option>
                {CHARADES_CATEGORIES.map((c) => (
                  <option key={c} value={c} className="bg-[#180C29]">
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-amber-200 mb-1.5">
                {lang === 'hi' ? 'कठिनाई' : 'Difficulty'}
              </label>
              <select
                value={customDifficulty}
                onChange={(e) => setCustomDifficulty(e.target.value as CharadesDifficulty)}
                className="w-full h-11 px-3 rounded-xl bg-black/40 border border-white/15 text-sm text-white focus:outline-none focus:border-amber-400"
              >
                <option value="Easy" className="bg-[#180C29]">
                  Easy
                </option>
                <option value="Medium" className="bg-[#180C29]">
                  Medium
                </option>
                <option value="Hard" className="bg-[#180C29]">
                  Hard
                </option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Word Breakdown Preview + Hint Toggle */}
      <div className="rounded-2xl bg-black/35 border border-amber-500/20 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-amber-300">
              {lang === 'hi' ? 'शब्द संरचना प्रीव्यू' : 'Word Structure Preview'}
            </p>
            {activeDraft && activeDraft.words.length > 0 ? (
              <p className="text-sm font-display font-bold text-white mt-0.5">
                {activeDraft.title} ·{' '}
                <span className="text-amber-300 font-mono-nums">
                  {activeDraft.words.length} {activeDraft.words.length === 1 ? 'word' : 'words'}
                </span>
              </p>
            ) : (
              <p className="text-xs text-amber-100/50 mt-0.5">
                {lang === 'hi' ? 'मूवी चुनें या लिखें' : 'Select or type a movie title'}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => setHintsEnabled((prev) => !prev)}
            className={`min-h-[40px] px-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-colors ${
              hintsEnabled
                ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
                : 'bg-white/5 border-white/15 text-amber-100/70'
            }`}
          >
            {hintsEnabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            <span>
              {hintsEnabled
                ? lang === 'hi'
                  ? 'हिंट्स चालू'
                  : 'Word Hints ON'
                : lang === 'hi'
                  ? 'हिंट्स बंद'
                  : 'Word Hints OFF'}
            </span>
          </button>
        </div>

        {activeDraft && activeDraft.words.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {activeDraft.words.map((word, idx) => (
              <div
                key={`${word}_${idx}`}
                className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-400/30 text-xs"
              >
                <span className="font-display font-bold text-amber-100">
                  Word {idx + 1}:
                </span>{' '}
                <span className="font-mono-nums text-amber-300">
                  {activeDraft.wordLengths[idx]} {activeDraft.wordLengths[idx] === 1 ? 'char' : 'letters'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Assign CTA */}
      <button
        type="submit"
        disabled={submitting || !activeDraft || activeDraft.words.length === 0}
        className="w-full min-h-[52px] rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 hover:brightness-105 disabled:opacity-50 text-slate-950 font-display font-extrabold text-base flex items-center justify-center gap-2 shadow-xl shadow-amber-500/20 transition-all active:scale-[0.99]"
      >
        <Clapperboard className="w-5 h-5" />
        <span>
          {submitting
            ? lang === 'hi'
              ? 'मूवी भेजी जा रही है...'
              : 'Sending Secret Movie...'
            : lang === 'hi'
              ? 'गुप्त रूप से मूवी भेजें और एक्टिंग शुरू करें'
              : 'Send Movie Privately & Start Acting'}
        </span>
      </button>
    </form>
  );
};
