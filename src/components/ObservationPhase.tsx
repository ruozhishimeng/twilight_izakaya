import React, { useState } from 'react';
import { Guest } from '../data/gameData';
import { Search } from 'lucide-react';
import PixelDialogueBox from './PixelDialogueBox';

interface Props {
  guest: Guest;
  availableGroups?: string[];
  prompt?: string;
  onComplete: (selectedFeatures: string[]) => void;
}

export default function ObservationPhase({ guest, availableGroups, prompt, onComplete }: Props) {
  const [observedFeatures, setObservedFeatures] = useState<string[]>([]);
  const [activeFeature, setActiveFeature] = useState<string | null>(null);

  // 根据分组过滤可观察特征
  const availableFeatures = availableGroups
    ? guest.features.filter(f => availableGroups.includes(f.group || 'default'))
    : guest.features;

  const handleObserveClick = () => {
    const unobserved = availableFeatures.filter(f => !observedFeatures.includes(f.id));
    if (unobserved.length > 0) {
      const nextFeature = unobserved[0];
      setObservedFeatures([...observedFeatures, nextFeature.id]);
      setActiveFeature(nextFeature.id);
    }
  };

  const allObserved = availableFeatures.length === 0 || observedFeatures.length === availableFeatures.length;

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center pb-32">
      {/* Character View */}
      <div className="flex flex-col items-center mb-8">
        {guest.image ? (
          <img
            src={guest.image}
            alt={guest.name}
            className="w-64 h-96 object-contain mb-6"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div
            className="w-64 h-96 relative mb-6"
            style={{ backgroundColor: guest.imagePlaceholderColor }}
          >
            <div className="absolute inset-0 flex items-center justify-center text-gray-400 opacity-50">
              [人物立绘占位]
            </div>
          </div>
        )}

        {/* Observe Button */}
        <button
          onClick={handleObserveClick}
          disabled={allObserved}
          className={`px-8 py-3 text-xl font-bold border-4 flex items-center gap-3 transition-all pixel-rounded ${
            allObserved
              ? 'bg-[#2c1e16] text-[#8b7355] border-[#3e2723] cursor-not-allowed'
              : 'bg-[#e6b87d] text-[#3e2723] border-[#8b5a2b] border-b-8 border-b-[#5a3a1a] shadow-[inset_-4px_-4px_0px_0px_rgba(0,0,0,0.15),inset_4px_4px_0px_0px_rgba(255,255,255,0.4),0_4px_0_0_#5a3a1a] hover:bg-[#fcd3a1] hover:scale-105 active:scale-95'
          }`}
        >
          <Search size={24} className="pixel-icon" />
          打量 ({observedFeatures.length}/{availableFeatures.length})
        </button>
      </div>

      <PixelDialogueBox
        speakerName={activeFeature ? "观察" : "系统"}
        text={
          activeFeature
            ? `【${availableFeatures.find(f => f.id === activeFeature)?.name}】\n${availableFeatures.find(f => f.id === activeFeature)?.desc}`
            : availableFeatures.length === 0
              ? "这位客人似乎没有什么特别的特征。"
              : allObserved
                ? "你已经观察了所有能发现的线索。"
                : prompt || "打量打量新来的客人吧，说不定会发现有用的线索。"
        }
        options={[
          { 
            label: "结束观察 ▼", 
            onClick: () => onComplete(observedFeatures),
            disabled: !allObserved,
            disabledReason: "还有未发现的线索"
          }
        ]}
      />
    </div>
  );
}
