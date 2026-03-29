import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { BASE_LIQUORS, FLAVORS, Guest, MIXERS } from '../data/gameData';
import PixelDialogueBox from './PixelDialogueBox';

interface MixingRequest {
  player_prompt?: string;
  request_text?: string;
  hint?: string;
  keywords?: string[];
  preferred_drink?: {
    id?: string;
    name?: string;
    formula?: string[];
  };
  retry_on_fail?: boolean;
}

interface TeachingData {
  introduction: string;
  mixing_prompt?: string;
  recipe: {
    id: string;
    name: string;
    ingredients?: string[];
    formula: string[];
    steps: string[];
  };
  tip: string;
}

interface Props {
  guest: Guest;
  onServe: (base: string, addons: string[]) => void;
  isMixing: boolean;
  setIsMixing: (isMixing: boolean) => void;
  inventory: string[];
  promptOverride?: string;
  startAtServe?: boolean;
  mixingRequest?: MixingRequest;
  teaching?: TeachingData;
}

type SelectableItem = {
  id: string;
  name: string;
  icon: string;
  image?: string;
  color: string;
  type: string;
  desc: string;
  unlocked?: boolean;
};

type SelectedItem = SelectableItem & {
  slotLabel: string;
  onRemove: () => void;
};

function buildPlayerPrompt(mixingRequest?: MixingRequest) {
  if (!mixingRequest) {
    return '\u6211\u5f97\u6839\u636e\u521a\u624d\u7684\u5bf9\u8bdd\u548c\u89c2\u5bdf\uff0c\u7406\u51fa\u4ed6\u771f\u6b63\u60f3\u8981\u7684\u5473\u9053\u3002';
  }

  if (mixingRequest.player_prompt) {
    return mixingRequest.player_prompt;
  }

  if (mixingRequest.hint) {
    return `\u6211\u5df2\u7ecf\u8bb0\u4f4f\u4ed6\u900f\u51fa\u6765\u7684\u7ebf\u7d22\uff1a${mixingRequest.hint}`;
  }

  if (mixingRequest.preferred_drink?.name) {
    return `\u4ed6\u60f3\u8981\u7684\u5e94\u8be5\u662f\u300c${mixingRequest.preferred_drink.name}\u300d\u3002\u6211\u5c31\u7167\u8fd9\u4e2a\u65b9\u5411\u8c03\u4e00\u676f\u3002`;
  }

  if (mixingRequest.request_text) {
    return `\u4ed6\u521a\u624d\u63d0\u5230\u4e86\u300c${mixingRequest.request_text}\u300d\u3002\u6211\u5f97\u987a\u7740\u8fd9\u53e5\u8bdd\u628a\u5473\u9053\u6574\u7406\u51fa\u6765\u3002`;
  }

  return '\u6211\u5f97\u6839\u636e\u521a\u624d\u7684\u5bf9\u8bdd\u548c\u89c2\u5bdf\uff0c\u7406\u51fa\u4ed6\u771f\u6b63\u60f3\u8981\u7684\u5473\u9053\u3002';
}

function buildTeachingPrompt(teaching?: TeachingData, teachingStep = 0) {
  if (!teaching) {
    return '';
  }

  if (teaching.mixing_prompt) {
    return teaching.mixing_prompt;
  }

  const steps = teaching.recipe?.steps || [];
  const ingredients = teaching.recipe?.ingredients || teaching.recipe?.formula || [];
  const formulaText = ingredients.length
    ? ingredients.join(' + ')
    : '\u8bf7\u6309\u7167\u521a\u624d\u7684\u6559\u5b66\u914d\u65b9\u6765\u3002';

  let currentLine = teaching.introduction || '\u300c\u5c0f\u5b50\uff0c\u542c\u597d\u4e86\u3002\u300d';
  if (teachingStep > 0 && teachingStep <= steps.length) {
    currentLine = `\u7b2c${teachingStep}\u6b65\uff1a${steps[teachingStep - 1]}`;
  } else if (teachingStep > steps.length) {
    currentLine = teaching.tip || '\u6309\u8fd9\u5f20\u914d\u65b9\u5b8c\u6210\u8c03\u5236\u3002';
  }

  return [
    `\u9152\u8c31\uff1a\u300c${teaching.recipe?.name || '\u672a\u77e5\u914d\u65b9'}\u300d`,
    `\u914d\u65b9\uff1a${formulaText}`,
    currentLine,
  ].filter(Boolean).join('\n');
}

function sortUnlockedFirst<T extends { unlocked?: boolean }>(items: T[]) {
  return [...items].sort((a, b) => {
    if (!!a.unlocked === !!b.unlocked) {
      return 0;
    }
    return a.unlocked ? -1 : 1;
  });
}

export default function MixingPhase({
  guest,
  onServe,
  isMixing,
  setIsMixing,
  inventory,
  promptOverride,
  startAtServe = false,
  mixingRequest,
  teaching,
}: Props) {
  const [selectedBase, setSelectedBase] = useState<string | null>(null);
  const [selectedMixer, setSelectedMixer] = useState<string | null>(null);
  const [selectedFlavor, setSelectedFlavor] = useState<string | null>(null);
  const [teachingStep, setTeachingStep] = useState(0);

  const isReady = selectedBase !== null || selectedMixer !== null || selectedFlavor !== null;

  useEffect(() => {
    if (startAtServe) {
      setTeachingStep((teaching?.recipe?.steps?.length || 0) + 1);
    } else {
      setTeachingStep(0);
    }
  }, [startAtServe, teaching]);

  const defaultRequestText = buildPlayerPrompt(mixingRequest);
  let guidanceText = defaultRequestText;
  if (promptOverride) {
    guidanceText = promptOverride;
  } else if (teaching) {
    guidanceText = buildTeachingPrompt(teaching, teachingStep);
  }

  const handleTeachingNext = () => {
    const steps = teaching?.recipe?.steps || [];
    if (teaching && teachingStep <= steps.length) {
      setTeachingStep(prev => prev + 1);
    }
  };

  const handleServeClick = () => {
    setIsMixing(true);
    setTimeout(() => {
      onServe(selectedBase || '', [selectedMixer, selectedFlavor].filter(Boolean) as string[]);
    }, 1500);
  };

  const unlockedItemIds = new Set(inventory);
  const availableBases = sortUnlockedFirst(
    BASE_LIQUORS.map(liquor => ({
      ...liquor,
      unlocked: liquor.unlocked || unlockedItemIds.has(liquor.id),
    }))
  );
  const availableMixers = sortUnlockedFirst(
    MIXERS.map(mixer => ({
      ...mixer,
      unlocked: mixer.unlocked || unlockedItemIds.has(mixer.id),
    }))
  );
  const availableFlavors = sortUnlockedFirst(
    FLAVORS.map(flavor => ({
      ...flavor,
      unlocked: flavor.unlocked || unlockedItemIds.has(flavor.id),
    }))
  );

  const selectedItems = [
    selectedBase
      ? {
          ...(BASE_LIQUORS.find(item => item.id === selectedBase) as SelectableItem),
          slotLabel: '\u57fa\u9152',
          onRemove: () => setSelectedBase(null),
        }
      : null,
    selectedMixer
      ? {
          ...(MIXERS.find(item => item.id === selectedMixer) as SelectableItem),
          slotLabel: '\u8c03\u996e',
          onRemove: () => setSelectedMixer(null),
        }
      : null,
    selectedFlavor
      ? {
          ...(FLAVORS.find(item => item.id === selectedFlavor) as SelectableItem),
          slotLabel: '\u98ce\u5473',
          onRemove: () => setSelectedFlavor(null),
        }
      : null,
  ].filter(Boolean) as SelectedItem[];

  const renderItemVisual = (item: SelectableItem, isLocked: boolean, size: 'list' | 'selected' = 'list') => {
    const dimensionClass = size === 'selected' ? 'h-14 w-14' : 'h-16 w-16';

    if (isLocked) {
      return (
        <div className={`relative flex ${dimensionClass} flex-shrink-0 items-center justify-center rounded-md border-2 border-[#3e2723] bg-[#2c1e16] p-1`}>
          <span className="text-2xl text-[#b8a58a]">{'\u9501'}</span>
        </div>
      );
    }

    if (item.image) {
      return (
        <div className={`relative flex ${dimensionClass} flex-shrink-0 items-center justify-center`}>
          <img src={item.image} alt={item.name} className="h-full w-full object-contain" />
        </div>
      );
    }

    return (
      <div className={`relative flex ${dimensionClass} flex-shrink-0 items-center justify-center rounded-md border-2 border-[#3e2723] bg-[#2c1e16] p-1`}>
        <span className="text-2xl">{item.icon}</span>
      </div>
    );
  };

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden pb-48 pt-24">
      <div
        className="absolute inset-0 bg-center bg-cover bg-no-repeat"
        style={{ backgroundImage: "url('/assets/back_grounds/mixing.png')" }}
      />
      <div className="absolute inset-0 bg-[#120b08]/55" />

      <div
        className={`relative z-20 flex h-full w-full max-w-[1400px] gap-4 px-4 transition-transform duration-700 ${
          isMixing ? '-translate-y-[150%]' : 'translate-y-0'
        }`}
      >
        <div className="flex h-full flex-[3] gap-4">
          <div className="pixel-panel-dark pixel-rounded-lg flex flex-1 flex-col overflow-hidden p-4">
            <h3 className="mb-3 border-b-2 border-[#4a3f35] pb-2 text-lg font-bold text-[#e0f2fe]">
              {'\u57fa\u9152 (Base)'}
            </h3>
            <div className="custom-scrollbar flex flex-col gap-3 overflow-y-auto pr-2">
              {availableBases.map(liquor => {
                const isSelected = selectedBase === liquor.id;
                const isLocked = !liquor.unlocked;
                return (
                  <button
                    key={liquor.id}
                    onClick={() => !isLocked && setSelectedBase(isSelected ? null : liquor.id)}
                    disabled={isLocked}
                    className={`pixel-rounded-lg flex items-start gap-3 border-4 p-2 text-left transition-all ${
                      isSelected
                        ? 'animate-pixel-bounce border-[#d4b886] bg-[#4a3f35]'
                        : isLocked
                          ? 'cursor-not-allowed border-[#2c1e16] bg-[#1a110c] opacity-50'
                          : 'border-[#3e2723] bg-[#1a110c] hover:border-[#8b5a2b]'
                    }`}
                  >
                    {renderItemVisual(liquor, isLocked)}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="whitespace-nowrap border-2 border-[#4a3f35] bg-[#2c1e16] px-1 py-0.5 text-[10px] font-bold text-[#e0f2fe]">
                          {liquor.type}
                        </div>
                        <div className="truncate text-base font-bold" style={{ color: isLocked ? '#6b7280' : liquor.color }}>
                          {isLocked ? '???' : liquor.name}
                        </div>
                      </div>
                      <div className="mt-1 line-clamp-2 text-xs text-[#a38c66]">
                        {isLocked ? '\u5c1a\u672a\u89e3\u9501' : liquor.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pixel-panel-dark pixel-rounded-lg flex flex-1 flex-col overflow-hidden p-4">
            <h3 className="mb-3 border-b-2 border-[#4a3f35] pb-2 text-lg font-bold text-[#86efac]">
              {'\u8c03\u996e (Mixer)'}
            </h3>
            <div className="custom-scrollbar flex flex-col gap-3 overflow-y-auto pr-2">
              {availableMixers.map(mixer => {
                const isSelected = selectedMixer === mixer.id;
                const isLocked = !mixer.unlocked;
                return (
                  <button
                    key={mixer.id}
                    onClick={() => !isLocked && setSelectedMixer(isSelected ? null : mixer.id)}
                    disabled={isLocked}
                    className={`pixel-rounded-lg flex items-start gap-3 border-4 p-2 text-left transition-all ${
                      isSelected
                        ? 'animate-pixel-bounce border-[#d4b886] bg-[#4a3f35]'
                        : isLocked
                          ? 'cursor-not-allowed border-[#2c1e16] bg-[#1a110c] opacity-50'
                          : 'border-[#3e2723] bg-[#1a110c] hover:border-[#8b5a2b]'
                    }`}
                  >
                    {renderItemVisual(mixer, isLocked)}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="whitespace-nowrap border-2 border-[#4a3f35] bg-[#2c1e16] px-1 py-0.5 text-[10px] font-bold text-[#86efac]">
                          {mixer.type}
                        </div>
                        <div className="truncate text-base font-bold" style={{ color: isLocked ? '#6b7280' : mixer.color }}>
                          {isLocked ? '???' : mixer.name}
                        </div>
                      </div>
                      <div className="mt-1 line-clamp-2 text-xs text-[#a38c66]">
                        {isLocked ? '\u5c1a\u672a\u89e3\u9501' : mixer.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pixel-panel-dark pixel-rounded-lg flex flex-1 flex-col overflow-hidden p-4">
            <h3 className="mb-3 border-b-2 border-[#4a3f35] pb-2 text-lg font-bold text-[#fca5a5]">
              {'\u98ce\u5473 (Flavor)'}
            </h3>
            <div className="custom-scrollbar flex flex-col gap-3 overflow-y-auto pr-2">
              {availableFlavors.map(flavor => {
                const isSelected = selectedFlavor === flavor.id;
                const isLocked = !flavor.unlocked;
                return (
                  <button
                    key={flavor.id}
                    onClick={() => !isLocked && setSelectedFlavor(isSelected ? null : flavor.id)}
                    disabled={isLocked}
                    className={`pixel-rounded-lg flex items-start gap-3 border-4 p-2 text-left transition-all ${
                      isSelected
                        ? 'animate-pixel-bounce border-[#d4b886] bg-[#4a3f35]'
                        : isLocked
                          ? 'cursor-not-allowed border-[#2c1e16] bg-[#1a110c] opacity-50'
                          : 'border-[#3e2723] bg-[#1a110c] hover:border-[#8b5a2b]'
                    }`}
                  >
                    {renderItemVisual(flavor, isLocked)}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="whitespace-nowrap border-2 border-[#4a3f35] bg-[#2c1e16] px-1 py-0.5 text-[10px] font-bold text-[#fca5a5]">
                          {flavor.type}
                        </div>
                        <div className="truncate text-base font-bold" style={{ color: isLocked ? '#6b7280' : flavor.color }}>
                          {isLocked ? '???' : flavor.name}
                        </div>
                      </div>
                      <div className="mt-1 line-clamp-2 text-xs text-[#a38c66]">
                        {isLocked ? '\u5c1a\u672a\u89e3\u9501' : flavor.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="pixel-panel-dark pixel-rounded-lg relative flex w-64 shrink-0 flex-col items-center justify-center p-4">
          <div className="absolute left-4 right-4 top-4 border-b-2 border-[#4a3f35] pb-2 text-center text-xl font-bold text-[#d4b886]">
            {'\u8c03\u9152\u53f0'}
          </div>

          <div className="custom-scrollbar mt-8 flex w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto pr-2">
            {selectedItems.length === 0 ? (
              <div className="flex h-full w-full items-center justify-center text-sm font-bold text-[#8b7355]">
                {'\u5c06\u6750\u6599\u653e\u5165\u676f\u4e2d...'}
              </div>
            ) : (
              selectedItems.map((item, index) => (
                <React.Fragment key={item.id}>
                  <div
                    className="pixel-rounded-lg flex h-16 w-full cursor-pointer items-center justify-between border-4 border-dashed border-[#e0f2fe] bg-[#4a3f35] px-2 text-sm font-bold transition-colors hover:bg-[#5c4a3d]"
                    onClick={item.onRemove}
                    title={'\u70b9\u51fb\u79fb\u9664\u6b64\u6750\u6599'}
                  >
                    <div className="flex items-center gap-2">
                      {renderItemVisual(item, false, 'selected')}
                      <div className="flex flex-col items-start">
                        <span className="text-[10px] text-gray-400">{item.slotLabel}</span>
                        <span style={{ color: item.color }}>{item.name}</span>
                      </div>
                    </div>
                    <span className="text-xs text-gray-500 hover:text-red-400">
                      {'\u79fb\u9664'}
                    </span>
                  </div>
                  {index < selectedItems.length - 1 && (
                    <div className="text-xl font-bold text-[#8b7355]">+</div>
                  )}
                </React.Fragment>
              ))
            )}

            {selectedItems.length > 0 && selectedItems.length < 3 && (
              <>
                <div className="text-xl font-bold text-[#8b7355]">+</div>
                <button
                  disabled
                  className="pixel-rounded-lg flex w-full cursor-not-allowed items-center justify-center gap-1 border-2 border-dashed border-[#4a3f35] py-2 text-xs font-bold text-[#8b7355] opacity-50"
                >
                  <Plus size={14} />
                  {'\u66f4\u591a\u69fd\u4f4d\u6682\u672a\u5f00\u653e...'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className={`pointer-events-none absolute inset-0 transition-transform duration-700 ${isMixing ? 'translate-y-[150%]' : 'translate-y-0'}`}>
        <div className="pointer-events-auto">
          <PixelDialogueBox
            speakerName={promptOverride ? '\u7cfb\u7edf' : teaching ? '\u8001\u5e08' : '\u6211'}
            speakerAvatarUrl={promptOverride || !teaching ? undefined : (guest.expressions.normal || guest.image)}
            speakerAvatarColor={promptOverride || !teaching ? undefined : guest.avatarColor}
            text={guidanceText}
            options={
              teaching && teachingStep <= (teaching.recipe?.steps?.length || 0)
                ? [
                    {
                      label: '\u7ee7\u7eed \u25bc',
                      onClick: handleTeachingNext,
                    },
                  ]
                : [
                    {
                      label: '\u5f00\u59cb\u8c03\u914d \u25bc',
                      onClick: handleServeClick,
                      disabled: !isReady,
                      disabledReason: '\u81f3\u5c11\u9009\u62e91\u79cd\u6750\u6599',
                    },
                  ]
            }
          />
        </div>
      </div>
    </div>
  );
}
