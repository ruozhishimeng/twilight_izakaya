import React, { useState, useEffect } from 'react';

interface Props {
  onComplete: () => void;
}

export default function IntroSequence({ onComplete }: Props) {
  const [stage, setStage] = useState(1);
  const [step, setStep] = useState(0);
  const [isFading, setIsFading] = useState(false);

  const stages = [
    {
      lines: [
        "东京的雨，似乎永远不会停。",
        "在霓虹与阴影的交界处，有一盏只在黄昏亮起的灯笼。"
      ]
    },
    {
      lines: [
        "那是迷途者的终点，也是不归人的起点。",
        "怀揣执念的灵魂，正推开那扇沉重的木门。"
      ]
    },
    {
      lines: [
        "你将斟满记忆的溶剂，调配救赎的秘方。",
        "在黎明到来前，给予他们最后的摆渡。"
      ]
    },
    {
      title: "《黄昏居酒屋》",
      lines: [
        "——今晚，你想听谁的故事？"
      ]
    }
  ];

  const handleNext = () => {
    if (isFading) return;

    const currentStageData = stages[stage - 1];
    
    if (stage === 4) {
      if (step === -1) {
        setStep(0);
      } else if (step === 0) {
        setStep(1);
      } else {
        onComplete();
      }
      return;
    }

    if (step < currentStageData.lines.length - 1) {
      setStep(step + 1);
    } else {
      triggerTransition(() => {
        setStage(stage + 1);
        setStep(0);
      });
    }
  };

  const triggerTransition = (callback: () => void) => {
    setIsFading(true);
    setTimeout(() => {
      callback();
      setIsFading(false);
    }, 800); // Fade out duration
  };

  const currentStageData = stages[stage - 1];

  return (
    <div 
      className="absolute inset-0 bg-black flex flex-col items-center justify-center cursor-pointer z-50 text-gray-200"
      onClick={handleNext}
    >
      <div className={`transition-opacity duration-700 w-full max-w-3xl px-8 flex flex-col items-center justify-center space-y-8 ${isFading ? 'opacity-0' : 'opacity-100'}`}>
        {stage === 4 ? (
          <>
            {step >= 0 && (
              <h1 className="text-5xl font-bold tracking-widest text-[#e8dcc4] mb-8 animate-fade-in">
                {currentStageData.title}
              </h1>
            )}
            {step >= 1 && (
              <p className="text-2xl text-gray-300 animate-fade-in">
                {currentStageData.lines[0]}
              </p>
            )}
          </>
        ) : (
          <div className="space-y-6 text-center">
            {currentStageData.lines.map((line, idx) => (
              idx <= step && (
                <p key={idx} className="text-2xl leading-relaxed animate-fade-in">
                  {line}
                </p>
              )
            ))}
          </div>
        )}
      </div>
      
      {/* Click to continue prompt */}
      <div className={`absolute bottom-8 right-12 text-gray-400 text-lg animate-pulse transition-opacity duration-700 ${isFading ? 'opacity-0' : 'opacity-100'}`}>
        点击继续 ▼
      </div>
    </div>
  );
}
