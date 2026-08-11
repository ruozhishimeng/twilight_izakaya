import React, { useEffect, useRef, useState } from 'react';
import { getCocktailImage } from '../data/gameData';
import { useAudioSystem } from '../systems/audioSystem';
import type { MixingTier } from '../data/content/mixingScore';

interface Props {
  tier: MixingTier;
  mixedDrinkName?: string;
  isNewRecipe?: boolean;
  onContinue: () => void;
}

const TIER_HEADING: Record<MixingTier, string> = {
  perfect: '调配成功',
  good: '将就能喝',
  off: '味道不太对',
};

const TIER_REACTION: Record<MixingTier, string> = {
  perfect: '客人眼睛一亮，一饮而尽。',
  good: '客人皱了皱眉，还是喝完了，嘴里念叨了两句。',
  off: '客人愣了一下，还是喝了下去，表情有点微妙。',
};

const TIER_SFX: Record<MixingTier, string> = {
  perfect: 'mix_success',
  good: 'mix_success',
  off: 'mix_fail',
};

export default function ResultPhase({ tier, mixedDrinkName, isNewRecipe, onContinue }: Props) {
  const { playSfx } = useAudioSystem();
  const [show, setShow] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const hasPlayedResultSfxRef = useRef(false);
  const isPerfect = tier === 'perfect';
  const cocktailImage = getCocktailImage(undefined, mixedDrinkName);

  useEffect(() => {
    const timer = window.setTimeout(() => setShow(true), 100);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    hasPlayedResultSfxRef.current = false;
  }, [tier, mixedDrinkName]);

  useEffect(() => {
    if (show && !hasPlayedResultSfxRef.current) {
      hasPlayedResultSfxRef.current = true;
      playSfx(TIER_SFX[tier]);
    }
  }, [tier, playSfx, show]);

  const handleContinue = () => {
    if (!show || isClosing) {
      return;
    }

    setIsClosing(true);
    window.setTimeout(() => {
      onContinue();
    }, 180);
  };

  return (
    <div
      className={`absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/95 backdrop-blur-sm transition-opacity duration-1000 ${
        show ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={handleContinue}
    >
      <div className={`transition-all duration-200 ${isClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'}`}>
        <div className="group relative flex h-64 w-64 cursor-pointer items-center justify-center">
          {isPerfect && (
            <>
              <div className="absolute inset-[-62%] rounded-full bg-[radial-gradient(circle,rgba(253,224,71,0.28)_0%,rgba(253,224,71,0.16)_28%,rgba(253,224,71,0.06)_52%,rgba(253,224,71,0)_76%)] blur-md" />
              <div className="absolute inset-[-36%] rounded-full bg-[radial-gradient(circle,rgba(255,244,185,0.3)_0%,rgba(253,224,71,0.12)_38%,rgba(253,224,71,0)_72%)]" />
              <div className="success-rays absolute inset-[-50%] animate-spin-slow opacity-70" />
            </>
          )}

          <div
            className={`relative z-10 flex h-full w-full items-center justify-center transition-transform duration-500 group-hover:scale-110 ${
              tier === 'perfect'
                ? 'drop-shadow-[0_0_20px_rgba(253,224,71,0.8)]'
                : tier === 'good'
                  ? 'drop-shadow-[0_0_12px_rgba(148,163,184,0.5)]'
                  : 'animate-glitch grayscale contrast-125 sepia hue-rotate-[-50deg] opacity-80'
            }`}
          >
            {cocktailImage ? (
              <img
                src={cocktailImage}
                alt={mixedDrinkName || '调配结果'}
                className="h-52 w-52 object-contain drop-shadow-[0_0_24px_rgba(253,224,71,0.5)]"
              />
            ) : (
              <div className="text-8xl leading-none">{'🍸'}</div>
            )}
          </div>
        </div>

        <div className="relative mt-12 animate-slide-up text-center">
          <h2
            className={`mb-4 text-4xl font-bold ${
              tier === 'perfect' ? 'text-yellow-300' : tier === 'good' ? 'text-slate-300' : 'text-red-400'
            }`}
          >
            {TIER_HEADING[tier]}
          </h2>

          {mixedDrinkName && (
            <div className="mb-4 flex items-center justify-center gap-3 text-3xl font-bold text-amber-200">
              {mixedDrinkName}
              {isNewRecipe && (
                <span className="animate-pulse rounded bg-red-500 px-2 py-1 text-sm text-white shadow-[0_0_10px_rgba(239,68,68,0.8)]">
                  NEW
                </span>
              )}
            </div>
          )}

          <p className="text-base text-gray-400">{TIER_REACTION[tier]}</p>

          <p className="mt-8 text-lg text-gray-300 animate-pulse">点击继续</p>
        </div>
      </div>
    </div>
  );
}
