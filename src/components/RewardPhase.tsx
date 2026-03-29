import React, { useEffect, useMemo, useState } from 'react';
import { Gift } from 'lucide-react';
import { getCocktailImage, getIngredientImage } from '../data/gameData';

interface RewardDetails {
  type: 'ingredient' | 'item' | 'recipe';
  id: string;
  name: string;
  description: string;
  quantity?: number;
}

interface Props {
  rewards: RewardDetails[];
  newRewardIds?: string[];
  onContinue: () => void;
}

export default function RewardPhase({ rewards, newRewardIds = [], onContinue }: Props) {
  const [show, setShow] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [canContinue, setCanContinue] = useState(false);

  const reward = rewards[currentIndex];
  const isNewReward = !!reward?.id && newRewardIds.includes(reward.id);
  const rewardImage = useMemo(() => {
    if (!reward) {
      return undefined;
    }

    return (
      getIngredientImage(reward.id) ||
      (reward.type === 'recipe' ? getCocktailImage(reward.id, reward.name) : undefined) ||
      getCocktailImage(reward.id, reward.name)
    );
  }, [reward]);

  useEffect(() => {
    const timer = window.setTimeout(() => setShow(true), 100);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    setCanContinue(false);
    const timer = window.setTimeout(() => {
      setCanContinue(true);
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [currentIndex]);

  const handleContinue = () => {
    if (!show || isClosing || !canContinue) {
      return;
    }

    if (currentIndex < rewards.length - 1) {
      setCurrentIndex(prev => prev + 1);
      return;
    }

    setIsClosing(true);
    window.setTimeout(() => {
      onContinue();
    }, 240);
  };

  if (!reward) {
    return null;
  }

  return (
    <div
      className={`absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/95 backdrop-blur-sm transition-opacity duration-1000 ${
        show ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className={`transition-all duration-200 ${isClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'}`}>
        <div className="group relative mx-auto flex h-64 w-64 items-center justify-center">
          <div className="absolute inset-[-62%] rounded-full bg-[radial-gradient(circle,rgba(253,224,71,0.28)_0%,rgba(253,224,71,0.16)_28%,rgba(253,224,71,0.06)_52%,rgba(253,224,71,0)_76%)] blur-md" />
          <div className="absolute inset-[-36%] rounded-full bg-[radial-gradient(circle,rgba(255,244,185,0.3)_0%,rgba(253,224,71,0.12)_38%,rgba(253,224,71,0)_72%)]" />
          <div className="success-rays absolute inset-[-50%] animate-spin-slow opacity-70" />

          <div className="absolute inset-0 z-10 flex items-center justify-center transition-transform duration-500 group-hover:scale-110">
            <div className="relative flex h-40 w-40 items-center justify-center">
              {rewardImage ? (
                <img
                  src={rewardImage}
                  alt={reward.name}
                  className="h-32 w-32 object-contain drop-shadow-[0_0_24px_rgba(253,224,71,0.5)]"
                />
              ) : (
                <Gift size={96} className="text-amber-200 drop-shadow-[0_0_30px_rgba(253,224,71,0.6)]" strokeWidth={2.25} />
              )}

              {isNewReward && (
                <div className="absolute -right-2 top-1 animate-bounce rounded bg-red-600 px-2 py-1 text-sm font-bold uppercase tracking-[0.12em] text-white shadow-[0_0_12px_rgba(220,38,38,0.85)]">
                  New!
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="relative mt-12 animate-slide-up text-center">
          <h2 className="mb-2 text-3xl font-bold text-amber-200">获得新物品！</h2>
          <div className="mb-4 text-2xl font-bold text-yellow-300">{reward.name}</div>
          {reward.quantity && <div className="mb-2 text-lg text-gray-300">x{reward.quantity}</div>}
          <div className="mx-auto max-w-md text-lg leading-8 text-gray-400">{reward.description}</div>

          {rewards.length > 1 && (
            <div className="mt-6 text-sm tracking-[0.2em] text-[#b89f77]">
              {currentIndex + 1} / {rewards.length}
            </div>
          )}

          <div className="mt-8">
            <button
              type="button"
              onClick={handleContinue}
              disabled={!canContinue}
              className={`pixel-button pixel-rounded px-8 py-3 text-xl font-bold transition-all ${
                canContinue ? '' : 'cursor-not-allowed opacity-60 grayscale'
              }`}
            >
              {canContinue
                ? currentIndex < rewards.length - 1
                  ? '继续查看'
                  : '收下礼物'
                : '请稍候...'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
