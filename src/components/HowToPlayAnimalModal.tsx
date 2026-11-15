import React, { useState } from 'react';
import { X, ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { Language } from '../types/game';
import { t } from '../data/i18n';

interface HowToPlayAnimalModalProps {
  open: boolean;
  lang: Language;
  onClose: () => void;
}

const STEP_EMOJIS = ['🦁', '❓', '🃏', '🎯'];

export const HowToPlayAnimalModal: React.FC<HowToPlayAnimalModalProps> = ({
  open,
  lang,
  onClose,
}) => {
  const [step, setStep] = useState(0);

  if (!open) return null;

  const steps = [
    {
      title: t(lang, 'gtaHow1Title'),
      body: t(lang, 'gtaHow1Body'),
      emoji: STEP_EMOJIS[0],
    },
    {
      title: t(lang, 'gtaHow2Title'),
      body: t(lang, 'gtaHow2Body'),
      emoji: STEP_EMOJIS[1],
    },
    {
      title: t(lang, 'gtaHow3Title'),
      body: t(lang, 'gtaHow3Body'),
      emoji: STEP_EMOJIS[2],
    },
    {
      title: t(lang, 'gtaHow4Title'),
      body: t(lang, 'gtaHow4Body'),
      emoji: STEP_EMOJIS[3],
    },
  ];

  const current = steps[step];
  const isFirst = step === 0;
  const isLast = step === steps.length - 1;

  const handleClose = () => {
    setStep(0);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="how-to-play-animal-title"
    >
      <div className="w-full max-w-md bg-white text-slate-900 rounded-3xl shadow-2xl border border-amber-200 overflow-hidden">
        <div className="px-6 pt-5 pb-3 flex items-center justify-between border-b border-slate-100">
          <span className="text-xs font-bold text-amber-700 font-mono-nums">
            {t(lang, 'gtaStepOf')} {step + 1} / {steps.length}
          </span>
          <button
            type="button"
            onClick={handleClose}
            className="min-h-[40px] min-w-[40px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors"
            aria-label={t(lang, 'gtaOk')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 text-center space-y-4">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-amber-100 border-2 border-amber-200 flex items-center justify-center text-4xl">
            {current.emoji}
          </div>
          <h3
            id="how-to-play-animal-title"
            className="font-display text-xl font-extrabold text-slate-900 text-balance"
          >
            {current.title}
          </h3>
          <p className="text-sm text-slate-600 leading-relaxed min-h-[60px]">
            {current.body}
          </p>

          {/* Progress Dots */}
          <div className="flex items-center justify-center gap-2 pt-2" role="tablist" aria-label="Steps">
            {steps.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setStep(idx)}
                aria-label={`${t(lang, 'gtaStepOf')} ${idx + 1}`}
                className={`h-2.5 rounded-full transition-all ${
                  idx === step ? 'w-7 bg-amber-500' : 'w-2.5 bg-slate-300 hover:bg-slate-400'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="px-6 pb-6 pt-2 flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={isFirst}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className="min-h-[48px] px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-800 font-bold text-sm flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t(lang, 'gtaBack')}</span>
          </button>

          {isLast ? (
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 min-h-[48px] px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-display font-bold text-base flex items-center justify-center gap-2 whitespace-nowrap shrink-0 transition-colors"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>{t(lang, 'gtaOk')}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
              className="flex-1 min-h-[48px] px-5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-base flex items-center justify-center gap-2 whitespace-nowrap shrink-0 transition-colors"
            >
              <span>{t(lang, 'gtaNext')}</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
