import React from 'react';

interface Props {
  onStart: () => void;
}

export default function StartScreen({ onStart }: Props) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-main-page z-50">
      <div className="absolute inset-0 bg-black/60 z-0"></div>
      <div className="text-center space-y-12 animate-fade-in z-10">
        <h1 className="text-6xl font-bold tracking-widest text-[#e8dcc4] drop-shadow-lg">
          黄昏居酒屋
        </h1>
        <p className="text-xl text-gray-400 tracking-widest">
          Twilight Izakaya
        </p>
        
        <button 
          onClick={onStart}
          className="pixel-button pixel-rounded mt-16 px-12 py-4 text-2xl font-bold hover:scale-105 active:scale-95 transition-all"
        >
          开始游戏
        </button>
      </div>
    </div>
  );
}
