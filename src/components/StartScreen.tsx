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
          className="mt-16 px-12 py-4 text-2xl font-bold bg-[#e6b87d] text-[#3e2723] border-4 border-[#8b5a2b] shadow-[inset_-4px_-4px_0px_0px_rgba(0,0,0,0.2),inset_4px_4px_0px_0px_rgba(255,255,255,0.5)] hover:bg-[#fcd3a1] hover:scale-105 active:scale-95 transition-all"
        >
          开始游戏
        </button>
      </div>
    </div>
  );
}
