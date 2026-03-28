import React, { useEffect, useState, useRef } from 'react';

interface Option {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  disabledReason?: string;
}

interface Props {
  speakerName?: string;
  speakerAvatarColor?: string;
  speakerAvatarUrl?: string;
  text: string;
  options?: Option[];
  onNext?: () => void;
}

export default function PixelDialogueBox({ speakerName, speakerAvatarColor, speakerAvatarUrl, text, options, onNext }: Props) {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const typingSpeed = 30; // ms per character

  useEffect(() => {
    const safeText = text || '';
    setDisplayedText('');
    setIsTyping(true);
    let currentIndex = 0;
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(() => {
      if (currentIndex < safeText.length) {
        setDisplayedText(safeText.slice(0, currentIndex + 1));
        currentIndex++;
      } else {
        setIsTyping(false);
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    }, typingSpeed);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [text]);

  const handleContainerClick = () => {
    const safeText = text || '';
    if (isTyping) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setDisplayedText(safeText);
      setIsTyping(false);
    } else if (onNext && !options) {
      onNext();
    }
  };

  return (
    <div
      className="absolute bottom-6 left-0 right-8 mx-auto w-[90%] max-w-4xl min-h-[160px] pixel-panel flex p-4 z-40 animate-slide-up cursor-pointer"
      onClick={handleContainerClick}
    >
      {/* Dialogue Content */}
      <div className="flex-1 flex flex-col relative">
        {/* Nameplate */}
        {speakerName && (
          <div className="absolute -top-8 -left-2 bg-[#2c1e16] text-[#e8dcc4] px-4 py-1 rounded border-2 border-[#1a110c] text-sm font-bold shadow-md">
            {speakerName}
          </div>
        )}

        {/* Text Area */}
        <div className="flex-1 text-2xl leading-relaxed mt-2 whitespace-pre-wrap">
          {displayedText}
        </div>

        {/* Options / Next Button */}
        <div className="flex gap-4 justify-end mt-4">
          {!isTyping && (
            options ? (
              options.map((opt, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); opt.onClick(); }}
                  disabled={opt.disabled}
                  className="pixel-button px-6 py-2 text-xl font-bold"
                  title={opt.disabledReason}
                >
                  {opt.label}
                </button>
              ))
            ) : onNext ? (
              <button onClick={(e) => { e.stopPropagation(); onNext(); }} className="pixel-button px-8 py-2 text-xl font-bold animate-pulse">
                继续 ▼
              </button>
            ) : null
          )}
        </div>
      </div>
    </div>
  );
}
