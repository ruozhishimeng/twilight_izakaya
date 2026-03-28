import React, { useState, useEffect } from 'react';
import { saveSystem, type SaveSlot } from '../systems/SaveSystem';
import { ChevronLeft } from 'lucide-react';

interface Props {
  onNewGame: () => void;
  onLoadGame: (slotId: string) => void;
  onBack: () => void;
}

type MenuMode = 'main' | 'load';

const SLOT_IDS = ['slot_1', 'slot_2', 'slot_3', 'slot_4', 'slot_5', 'slot_6'];

function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${month}月${day}日 ${hours}:${minutes}`;
}

function getSlotDisplayInfo(slot: SaveSlot | null): { name: string; subtitle: string; empty: boolean } {
  if (!slot) {
    return { name: '空存档位', subtitle: '暂无存档', empty: true };
  }

  const weekNum = slot.data.currentWeek;
  const dayNum = slot.data.currentDay;
  const weekStr = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'][weekNum - 1] || `${weekNum}`;
  const dayStr = ['一', '二', '三', '四', '五', '六', '日'][dayNum - 1] || `${dayNum}`;

  return {
    name: slot.name,
    subtitle: `第${weekStr}周 星期${dayStr} · ${formatTimestamp(slot.timestamp)}`,
    empty: false,
  };
}

export default function MainMenu({ onNewGame, onLoadGame, onBack }: Props) {
  const [mode, setMode] = useState<MenuMode>('main');
  const [saveSlots, setSaveSlots] = useState<SaveSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (mode === 'load') {
      loadAllSaves();
    }
  }, [mode]);

  const loadAllSaves = async () => {
    try {
      const saves = await saveSystem.getAllSaves();
      setSaveSlots(saves);
    } catch (e) {
      console.error('[MainMenu] Failed to load saves:', e);
    }
  };

  const getSaveForSlot = (slotId: string): SaveSlot | null => {
    return saveSlots.find(s => s.id === slotId) || null;
  };

  const handleLoadClick = () => {
    if (!selectedSlot) return;
    setMessage('读取中...');
    setTimeout(() => {
      onLoadGame(selectedSlot);
    }, 300);
  };

  const renderMainMenu = () => (
    <div className="text-center space-y-8 animate-fade-in">
      <h2 className="text-5xl font-bold text-amber-300 mb-12 tracking-widest">
        主菜单
      </h2>

      <button
        onClick={onNewGame}
        className="block w-72 mx-auto px-16 py-4 text-2xl font-bold bg-[#e6b87d] text-[#3e2723] border-4 border-[#8b5a2b] border-b-8 border-b-[#5a3a1a] shadow-[inset_-4px_-4px_0px_0px_rgba(0,0,0,0.15),inset_4px_4px_0px_0px_rgba(255,255,255,0.4),0_4px_0_0_#5a3a1a] hover:bg-[#fcd3a1] hover:scale-105 active:scale-95 transition-all pixel-rounded"
      >
        新游戏
      </button>

      <button
        onClick={() => setMode('load')}
        className="block w-72 mx-auto px-16 py-4 text-2xl font-bold bg-[#e6b87d] text-[#3e2723] border-4 border-[#8b5a2b] border-b-8 border-b-[#5a3a1a] shadow-[inset_-4px_-4px_0px_0px_rgba(0,0,0,0.15),inset_4px_4px_0px_0px_rgba(255,255,255,0.4),0_4px_0_0_#5a3a1a] hover:bg-[#fcd3a1] hover:scale-105 active:scale-95 transition-all pixel-rounded"
      >
        读取游戏
      </button>

      <button
        onClick={onBack}
        className="block w-72 mx-auto px-16 py-4 text-2xl font-bold bg-[#4a3f35] text-[#e8dcc4] border-4 border-[#1a110c] hover:bg-[#5c4a3d] hover:scale-105 active:scale-95 transition-all pixel-rounded"
      >
        关于
      </button>
    </div>
  );

  const renderLoadMenu = () => (
    <div className="animate-fade-in">
      <div className="text-center mb-6">
        <h2 className="text-4xl font-bold text-amber-300 tracking-widest">
          选择存档
        </h2>
      </div>

      {/* Slot Grid - 3x2 */}
      <div className="grid grid-cols-3 gap-3 max-w-xl mx-auto mb-6">
        {SLOT_IDS.map((slotId) => {
          const slot = getSaveForSlot(slotId);
          const info = getSlotDisplayInfo(slot);
          const isSelected = selectedSlot === slotId;

          return (
            <div
              key={slotId}
              onClick={() => setSelectedSlot(slotId)}
              className={`
                p-4 rounded-lg border-4 cursor-pointer transition-all min-h-[90px] flex flex-col justify-between
                ${isSelected
                  ? 'bg-[#5c4a3d] border-amber-500'
                  : 'bg-[#2c1e16] border-[#1a110c] hover:border-[#3e2723]'
                }
                ${info.empty ? 'opacity-60' : 'opacity-100'}
              `}
            >
              <div>
                <div className={`text-base font-bold truncate ${isSelected ? 'text-amber-200' : 'text-[#e8dcc4]'}`}>
                  {info.name}
                </div>
                <div className="text-xs text-gray-400 mt-1 truncate">
                  {info.subtitle}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Message */}
      {message && (
        <div className="text-center text-xl font-bold text-amber-300 animate-pulse mb-4">
          {message}
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-4 max-w-xl mx-auto">
        <button
          onClick={() => {
            setMode('main');
            setSelectedSlot(null);
            setMessage(null);
          }}
          className="flex-1 py-3 text-xl font-bold bg-[#4a3f35] text-[#e8dcc4] border-4 border-[#1a110c] hover:bg-[#5c4a3d] transition-colors flex items-center justify-center gap-2 rounded-lg"
        >
          <ChevronLeft size={24} />
          返回
        </button>
        <button
          onClick={handleLoadClick}
          disabled={!selectedSlot || !!message}
          className={`flex-1 py-3 text-xl font-bold border-4 border-[#1a110c] flex items-center justify-center gap-2 rounded-lg transition-colors ${
            !selectedSlot || !!message
              ? 'bg-[#3e2723] text-gray-500 cursor-not-allowed'
              : 'bg-[#5c8a4a] text-amber-200 hover:bg-[#6c9a5a]'
          }`}
        >
          读取
        </button>
      </div>
    </div>
  );

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-main-page z-50">
      <div className="absolute inset-0 bg-black/60 z-0"></div>
      {mode === 'main' && renderMainMenu()}
      {mode === 'load' && renderLoadMenu()}
    </div>
  );
}
