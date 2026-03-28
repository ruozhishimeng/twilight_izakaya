import React, { useEffect, useState } from 'react';
import { X, Save, Download, Trash2, ChevronLeft, Home, Wrench } from 'lucide-react';
import { saveSystem, type SaveSlot } from '../systems/SaveSystem';
import type { GamePhase } from '../App';

interface Props {
  onClose: () => void;
  onReturnToMenu: () => void;
  onSave: (slotId: string, slotName: string) => Promise<void>;
  onLoad: (slotId: string) => Promise<void>;
  onDebugJump?: (week: number, day: number) => Promise<string>;
  enableDebugTools?: boolean;
  currentPhase: GamePhase;
  currentWeek: number;
  currentDay: number;
}

type ModalMode = 'main' | 'save' | 'load' | 'debug';

const SLOT_IDS = ['slot_1', 'slot_2', 'slot_3', 'slot_4', 'slot_5', 'slot_6'];
const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];
const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

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
    return { name: '空存档位', subtitle: '点击保存到此处', empty: true };
  }

  const weekNum = slot.data.currentWeek;
  const dayNum = slot.data.currentDay;
  const weekStr = WEEK_LABELS[weekNum - 1] || `${weekNum}`;
  const dayStr = WEEKDAY_LABELS[dayNum - 1] || `${dayNum}`;

  return {
    name: slot.name,
    subtitle: `第${weekStr}周 星期${dayStr} · ${formatTimestamp(slot.timestamp)}`,
    empty: false,
  };
}

export default function SettingsModal({
  onClose,
  onReturnToMenu,
  onSave,
  onLoad,
  onDebugJump,
  enableDebugTools = false,
  currentPhase,
  currentWeek,
  currentDay,
}: Props) {
  const [mode, setMode] = useState<ModalMode>('main');
  const [saveSlots, setSaveSlots] = useState<SaveSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [saveName, setSaveName] = useState('');
  const [isOperating, setIsOperating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [debugWeek, setDebugWeek] = useState(currentWeek);
  const [debugDay, setDebugDay] = useState(currentDay);

  useEffect(() => {
    if (mode === 'save' || mode === 'load') {
      loadAllSaves();
    }
  }, [mode]);

  const loadAllSaves = async () => {
    try {
      const saves = await saveSystem.getAllSaves();
      setSaveSlots(saves);
    } catch (error) {
      console.error('[SettingsModal] Failed to load saves:', error);
    }
  };

  const getSaveForSlot = (slotId: string): SaveSlot | null => {
    return saveSlots.find(slot => slot.id === slotId) || null;
  };

  const handleSaveClick = async () => {
    if (!selectedSlot) {
      return;
    }

    const name = saveName.trim() || `第${currentWeek}周 星期${WEEKDAY_LABELS[currentDay - 1] || currentDay}`;
    setIsOperating(true);
    setMessage(null);

    try {
      await onSave(selectedSlot, name);
      setMessage('保存成功');
      await loadAllSaves();
      window.setTimeout(() => {
        setMessage(null);
        setMode('main');
        setSelectedSlot(null);
        setSaveName('');
      }, 1000);
    } catch (error) {
      setMessage('保存失败');
      console.error('[SettingsModal] Save failed:', error);
    } finally {
      setIsOperating(false);
    }
  };

  const handleLoadClick = async () => {
    if (!selectedSlot) {
      return;
    }

    setIsOperating(true);
    setMessage(null);

    try {
      await onLoad(selectedSlot);
      setMessage('读取成功');
      window.setTimeout(() => {
        setMessage(null);
        onClose();
      }, 500);
    } catch (error) {
      setMessage('读取失败');
      console.error('[SettingsModal] Load failed:', error);
    } finally {
      setIsOperating(false);
    }
  };

  const handleDelete = async (slotId: string) => {
    try {
      await saveSystem.deleteSave(slotId);
      await loadAllSaves();
      if (selectedSlot === slotId) {
        setSelectedSlot(null);
      }
    } catch (error) {
      console.error('[SettingsModal] Delete failed:', error);
    }
  };

  const handleDebugJumpClick = async () => {
    if (!onDebugJump) {
      return;
    }

    setIsOperating(true);
    setMessage(null);

    try {
      const result = await onDebugJump(debugWeek, debugDay);
      setMessage(result || '跳转完成');
    } catch (error) {
      setMessage('调试跳转失败');
      console.error('[SettingsModal] Debug jump failed:', error);
    } finally {
      setIsOperating(false);
    }
  };

  const renderMainMenu = () => (
    <div className="space-y-6">
      <div className="flex gap-4 pt-4">
        <button
          onClick={() => setMode('save')}
          className="flex flex-1 items-center justify-center gap-3 rounded-lg border-4 border-[#1a110c] bg-[#4a3f35] py-4 text-2xl font-bold text-amber-200 transition-colors hover:bg-[#5c4a3d]"
        >
          <Save size={28} />
          保存进度
        </button>
        <button
          onClick={() => setMode('load')}
          className="flex flex-1 items-center justify-center gap-3 rounded-lg border-4 border-[#1a110c] bg-[#4a3f35] py-4 text-2xl font-bold text-amber-200 transition-colors hover:bg-[#5c4a3d]"
        >
          <Download size={28} />
          读取进度
        </button>
      </div>

      <div className="border-t-4 border-[#1a110c] pt-4">
        <button
          onClick={onReturnToMenu}
          className="flex w-full items-center justify-center gap-3 rounded-lg border-4 border-[#1a110c] bg-[#5c3a2a] py-4 text-2xl font-bold text-amber-200 transition-colors hover:bg-[#6c4a3a]"
        >
          <Home size={28} />
          返回主菜单
        </button>
      </div>

      {enableDebugTools && onDebugJump && (
        <div className="border-t-4 border-[#1a110c] pt-4">
          <button
            onClick={() => {
              setDebugWeek(currentWeek);
              setDebugDay(currentDay);
              setMessage(null);
              setMode('debug');
            }}
            className="flex w-full items-center justify-center gap-3 rounded-lg border-4 border-[#16212a] bg-[#3a4d5c] py-4 text-2xl font-bold text-[#d9ecff] transition-colors hover:bg-[#496274]"
          >
            <Wrench size={28} />
            调试跳转
          </button>
        </div>
      )}
    </div>
  );

  const renderSlotGrid = (onAction: () => void, actionLabel: string, actionIcon: React.ReactNode) => (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {SLOT_IDS.map(slotId => {
          const slot = getSaveForSlot(slotId);
          const info = getSlotDisplayInfo(slot);
          const isSelected = selectedSlot === slotId;

          return (
            <div
              key={slotId}
              onClick={() => setSelectedSlot(slotId)}
              className={`
                min-h-[100px] cursor-pointer rounded-lg border-4 p-4 transition-all flex flex-col justify-between
                ${isSelected ? 'bg-[#5c4a3d] border-amber-500' : 'bg-[#2c1e16] border-[#1a110c] hover:border-[#3e2723]'}
                ${info.empty ? 'opacity-60' : 'opacity-100'}
              `}
            >
              <div>
                <div className={`truncate text-lg font-bold ${isSelected ? 'text-amber-200' : 'text-[#e8dcc4]'}`}>
                  {info.name}
                </div>
                <div className="mt-1 truncate text-xs text-gray-400">{info.subtitle}</div>
              </div>
              {!info.empty && (
                <button
                  onClick={event => {
                    event.stopPropagation();
                    handleDelete(slotId);
                  }}
                  className="self-end p-1 text-gray-500 transition-colors hover:text-red-400"
                  title="删除存档"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {selectedSlot && (
        <div className="rounded-lg border-4 border-[#1a110c] bg-[#2c1e16] p-4">
          <div className="mb-2 text-lg text-[#e8dcc4]">存档位 {selectedSlot.replace('slot_', '第 ')} 号</div>
          {mode === 'save' && (
            <input
              type="text"
              value={saveName}
              onChange={event => setSaveName(event.target.value)}
              placeholder={`第${currentWeek}周 星期${WEEKDAY_LABELS[currentDay - 1] || currentDay}`}
              className="w-full rounded border-2 border-[#3e2723] bg-[#1a110c] px-3 py-2 text-lg text-[#e8dcc4] outline-none focus:border-amber-500"
              maxLength={30}
            />
          )}
        </div>
      )}

      {message && <div className="text-center text-xl font-bold text-amber-300 animate-pulse">{message}</div>}

      <div className="flex gap-4">
        <button
          onClick={() => {
            setMode('main');
            setSelectedSlot(null);
            setSaveName('');
            setMessage(null);
          }}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border-4 border-[#1a110c] bg-[#4a3f35] py-3 text-xl font-bold text-[#e8dcc4] transition-colors hover:bg-[#5c4a3d]"
        >
          <ChevronLeft size={24} />
          返回
        </button>
        <button
          onClick={onAction}
          disabled={!selectedSlot || isOperating}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg border-4 border-[#1a110c] py-3 text-xl font-bold transition-colors ${
            !selectedSlot || isOperating
              ? 'cursor-not-allowed bg-[#3e2723] text-gray-500'
              : 'bg-[#5c8a4a] text-amber-200 hover:bg-[#6c9a5a]'
          }`}
        >
          {isOperating ? '处理中...' : actionIcon}
          {!isOperating && actionLabel}
        </button>
      </div>
    </div>
  );

  const renderDebugPanel = () => (
    <div className="space-y-5">
      <div className="rounded-lg border-4 border-[#1a110c] bg-[#2c1e16] p-5">
        <div className="text-lg font-bold text-[#e8dcc4]">开发环境调试</div>
        <p className="mt-2 text-sm leading-6 text-gray-400">
          输入想测试的周数与星期。若当天没有客人，系统会自动跳到最近一个有剧情的日期。
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="rounded-lg border-4 border-[#1a110c] bg-[#2c1e16] p-4">
          <div className="text-sm font-bold tracking-[0.2em] text-amber-300">周数</div>
          <input
            type="number"
            min={1}
            value={debugWeek}
            onChange={event => setDebugWeek(Math.max(1, Number(event.target.value) || 1))}
            className="mt-3 w-full rounded border-2 border-[#3e2723] bg-[#1a110c] px-3 py-3 text-xl text-[#e8dcc4] outline-none focus:border-amber-500"
          />
        </label>
        <label className="rounded-lg border-4 border-[#1a110c] bg-[#2c1e16] p-4">
          <div className="text-sm font-bold tracking-[0.2em] text-amber-300">星期</div>
          <select
            value={debugDay}
            onChange={event => setDebugDay(Number(event.target.value))}
            className="mt-3 w-full rounded border-2 border-[#3e2723] bg-[#1a110c] px-3 py-3 text-xl text-[#e8dcc4] outline-none focus:border-amber-500"
          >
            {WEEKDAY_LABELS.map((label, index) => (
              <option key={label} value={index + 1}>
                星期{label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {message && (
        <div className="rounded-lg border-4 border-[#1a110c] bg-[#253323] px-4 py-3 text-center text-lg font-bold text-amber-100">
          {message}
        </div>
      )}

      <div className="flex gap-4">
        <button
          onClick={() => {
            setMode('main');
            setMessage(null);
          }}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border-4 border-[#1a110c] bg-[#4a3f35] py-3 text-xl font-bold text-[#e8dcc4] transition-colors hover:bg-[#5c4a3d]"
        >
          <ChevronLeft size={24} />
          返回
        </button>
        <button
          onClick={handleDebugJumpClick}
          disabled={isOperating}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg border-4 border-[#1a110c] py-3 text-xl font-bold transition-colors ${
            isOperating
              ? 'cursor-not-allowed bg-[#3e2723] text-gray-500'
              : 'bg-[#3a4d5c] text-[#d9ecff] hover:bg-[#496274]'
          }`}
        >
          <Wrench size={24} />
          {isOperating ? '跳转中...' : '执行跳转'}
        </button>
      </div>
    </div>
  );

  const title =
    mode === 'main'
      ? '系统设置'
      : mode === 'save'
        ? '保存进度'
        : mode === 'load'
          ? '读取进度'
          : '调试跳转';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-8">
      <div className="relative flex w-full max-w-2xl flex-col pixel-panel animate-scale-up p-8">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 text-[#e8dcc4] transition-all hover:scale-110 hover:text-white"
          title="关闭设置"
        >
          <X size={32} />
        </button>

        <h2 className="mb-8 border-b-4 border-[#1a110c] pb-4 text-center text-4xl font-bold text-amber-400">
          {title}
        </h2>

        <div className="flex-1">
          {mode === 'main' && renderMainMenu()}
          {mode === 'save' && renderSlotGrid(handleSaveClick, '保存', <Save size={24} />)}
          {mode === 'load' && renderSlotGrid(handleLoadClick, '读取', <Download size={24} />)}
          {mode === 'debug' && renderDebugPanel()}
        </div>
      </div>
    </div>
  );
}
