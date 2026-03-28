import React, { useEffect, useState } from 'react';
import { Gift } from 'lucide-react';

interface RewardDetails {
  type: 'ingredient' | 'item';
  id: string;
  name: string;
  description: string;
  quantity?: number;
}

interface Props {
  reward: RewardDetails;
  onContinue: () => void;
}

export default function RewardPhase({ reward, onContinue }: Props) {
  const [show, setShow] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setShow(true), 100);
    return () => window.clearTimeout(timer);
  }, []);

  const handleClose = () => {
    if (!show || isClosing) {
      return;
    }

    setIsClosing(true);
    window.setTimeout(() => {
      onContinue();
    }, 240);
  };

  return (
    <div
      className={`absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/95 backdrop-blur-sm transition-opacity duration-1000 ${
        show ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={handleClose}
    >
      <div className={`transition-all duration-200 ${isClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'}`}>
        <div className="group relative mx-auto flex h-64 w-64 cursor-pointer items-center justify-center">
          <div className="absolute inset-[-62%] rounded-full bg-[radial-gradient(circle,rgba(253,224,71,0.28)_0%,rgba(253,224,71,0.16)_28%,rgba(253,224,71,0.06)_52%,rgba(253,224,71,0)_76%)] blur-md" />
          <div className="absolute inset-[-36%] rounded-full bg-[radial-gradient(circle,rgba(255,244,185,0.3)_0%,rgba(253,224,71,0.12)_38%,rgba(253,224,71,0)_72%)]" />
          <div className="success-rays absolute inset-[-50%] animate-spin-slow opacity-70" />

          <div className="absolute inset-0 z-10 flex items-center justify-center transition-transform duration-500 group-hover:scale-110">
            <div className="flex h-28 w-28 items-center justify-center">
              <Gift size={96} className="text-amber-200 drop-shadow-[0_0_30px_rgba(253,224,71,0.6)]" strokeWidth={2.25} />
            </div>
          </div>
        </div>

        <div className="relative mt-12 animate-slide-up text-center">
          <h2 className="mb-2 text-3xl font-bold text-amber-200">获得新物品！</h2>
          <div className="mb-4 text-2xl font-bold text-yellow-300">{reward.name}</div>
          {reward.quantity && <div className="mb-2 text-lg text-gray-300">x{reward.quantity}</div>}
          <div className="mx-auto max-w-md text-lg text-gray-400">{reward.description}</div>
          <p className="mt-8 text-lg text-gray-500 animate-pulse">点击任意处继续</p>
        </div>
      </div>
    </div>
  );
}
