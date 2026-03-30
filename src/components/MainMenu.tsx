import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Download, Info, Sparkles, Volume2 } from 'lucide-react';
import { saveSystem, type SaveSlot } from '../systems/SaveSystem';

interface Props {
  onNewGame: () => void;
  onLoadGame: (slotId: string) => void;
  onBack: () => void;
}

type MenuMode = 'main' | 'load' | 'settings' | 'about';
type TextSpeed = 'slow' | 'normal' | 'fast';

interface MenuSettings {
  bgmVolume: number;
  sfxVolume: number;
  textSpeed: TextSpeed;
  autoPlay: boolean;
  screenShake: boolean;
}

const SLOT_IDS = ['slot_1', 'slot_2', 'slot_3', 'slot_4', 'slot_5', 'slot_6'];
const SETTINGS_STORAGE_KEY = 'twilight_izakaya_menu_settings';
const DEFAULT_SETTINGS: MenuSettings = {
  bgmVolume: 80,
  sfxVolume: 85,
  textSpeed: 'normal',
  autoPlay: false,
  screenShake: true,
};

const primaryButtonClass =
  'pixel-button pixel-rounded block w-72 mx-auto px-16 py-4 text-2xl font-bold hover:scale-105 active:scale-95 transition-all';
const secondaryButtonClass =
  'block w-72 mx-auto px-16 py-4 text-2xl font-bold bg-[#4a3f35] text-[#f3e5c5] border-4 border-[#8b5a2b] border-b-8 border-b-[#5a3a1a] shadow-[inset_-4px_-4px_0px_0px_rgba(0,0,0,0.15),inset_4px_4px_0px_0px_rgba(255,255,255,0.18),0_4px_0_0_#5a3a1a] hover:bg-[#5d4a3c] hover:scale-105 active:scale-95 transition-all pixel-rounded';
const panelClass =
  'relative z-10 w-full max-w-4xl border-8 border-[#3e2723] bg-[#1f1713]/95 px-10 py-10 shadow-2xl pixel-rounded';

function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${month}/${day} ${hours}:${minutes}`;
}

function getSlotDisplayInfo(slot: SaveSlot | null): { name: string; subtitle: string; empty: boolean } {
  if (!slot) {
    return { name: '空存档位', subtitle: '暂未记录营业进度', empty: true };
  }

  const weekNum = slot.data.currentWeek;
  const dayNum = slot.data.currentDay;
  const weekdayLabels = ['一', '二', '三', '四', '五', '六', '日'];

  return {
    name: slot.name,
    subtitle: `第 ${weekNum} 周 星期${weekdayLabels[dayNum - 1] || dayNum} · ${formatTimestamp(slot.timestamp)}`,
    empty: false,
  };
}

function loadStoredSettings(): MenuSettings {
  if (typeof window === 'undefined') {
    return DEFAULT_SETTINGS;
  }

  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_SETTINGS;
    }

    const parsed = JSON.parse(raw) as Partial<MenuSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
    };
  } catch (error) {
    console.warn('[MainMenu] Failed to parse stored settings:', error);
    return DEFAULT_SETTINGS;
  }
}

export default function MainMenu({ onNewGame, onLoadGame, onBack }: Props) {
  const [mode, setMode] = useState<MenuMode>('main');
  const [saveSlots, setSaveSlots] = useState<SaveSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [settings, setSettings] = useState<MenuSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    setSettings(loadStoredSettings());
  }, []);

  useEffect(() => {
    if (mode === 'load') {
      void loadAllSaves();
    }
  }, [mode]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const settingsSummary = useMemo(() => {
    const speedLabel =
      settings.textSpeed === 'slow'
        ? '慢速'
        : settings.textSpeed === 'fast'
          ? '快速'
          : '标准';

    return `BGM ${settings.bgmVolume}% / 音效 ${settings.sfxVolume}% / 文字 ${speedLabel}`;
  }, [settings]);

  const loadAllSaves = async () => {
    try {
      const saves = await saveSystem.getAllSaves();
      setSaveSlots(saves);
    } catch (error) {
      console.error('[MainMenu] Failed to load saves:', error);
    }
  };

  const getSaveForSlot = (slotId: string): SaveSlot | null => {
    return saveSlots.find(slot => slot.id === slotId) || null;
  };

  const handleLoadClick = () => {
    if (!selectedSlot) {
      return;
    }
    setMessage('读取中...');
    onLoadGame(selectedSlot);
  };

  const renderBackToMainButton = () => (
    <button
      onClick={() => {
        setMode('main');
        setSelectedSlot(null);
        setMessage(null);
      }}
      className="mb-6 inline-flex items-center gap-2 border-4 border-[#8b5a2b] bg-[#4a3f35] px-4 py-2 text-lg font-bold text-[#f3e5c5] transition-all hover:bg-[#5d4a3c] pixel-rounded"
    >
      <ChevronLeft size={20} />
      返回
    </button>
  );

  const renderMainMenu = () => (
    <div className="text-center space-y-8 animate-fade-in">
      <h2 className="text-5xl font-bold text-amber-300 tracking-[0.3em]">主菜单</h2>
      <p className="mx-auto max-w-2xl text-lg leading-8 text-[#cbb89a]">
        暮色渐沉，灯笼在檐下摇晃。且在吧台后稍坐，门铃即将响起...
      </p>

      <div className="space-y-5 pt-4">
        <button onClick={onNewGame} className={primaryButtonClass}>
          开始新游戏
        </button>

        <button onClick={() => setMode('load')} className={primaryButtonClass}>
          读取游戏
        </button>

        <button onClick={() => setMode('settings')} className={secondaryButtonClass}>
          设置
        </button>

        <button onClick={() => setMode('about')} className={secondaryButtonClass}>
          关于
        </button>
      </div>

      <div className="pt-6 text-sm tracking-[0.2em] text-[#9e8968]">
        {settingsSummary}
      </div>
    </div>
  );

  const renderLoadMenu = () => (
    <div className="animate-fade-in">
      {renderBackToMainButton()}

      <div className="text-center mb-6">
        <h2 className="text-4xl font-bold text-amber-300 tracking-[0.25em]">读取游戏</h2>
        <p className="mt-3 text-base text-[#cbb89a]">从已有存档继续今夜的营业。</p>
      </div>

      <div className="grid grid-cols-3 gap-3 max-w-4xl mx-auto mb-6">
        {SLOT_IDS.map((slotId) => {
          const slot = getSaveForSlot(slotId);
          const info = getSlotDisplayInfo(slot);
          const isSelected = selectedSlot === slotId;

          return (
            <div
              key={slotId}
              onClick={() => setSelectedSlot(slotId)}
              className={`min-h-[110px] border-4 cursor-pointer transition-all px-4 py-4 flex flex-col justify-between pixel-rounded ${
                isSelected
                  ? 'bg-[#5c4a3d] border-amber-500 shadow-[0_0_0_4px_rgba(251,191,36,0.15)]'
                  : 'bg-[#2c1e16] border-[#1a110c] hover:border-[#8b5a2b]'
              } ${info.empty ? 'opacity-60' : 'opacity-100'}`}
            >
              <div>
                <div className={`text-base font-bold truncate ${isSelected ? 'text-amber-200' : 'text-[#f3e5c5]'}`}>
                  {info.name}
                </div>
                <div className="text-xs text-[#9e8968] mt-2 leading-5">
                  {info.subtitle}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {message && (
        <div className="text-center text-xl font-bold text-amber-300 animate-pulse mb-4">
          {message}
        </div>
      )}

      <div className="flex gap-4 max-w-xl mx-auto">
        <button
          onClick={() => {
            setMode('main');
            setSelectedSlot(null);
            setMessage(null);
          }}
          className="flex-1 py-3 text-xl font-bold bg-[#4a3f35] text-[#f3e5c5] border-4 border-[#8b5a2b] border-b-8 border-b-[#5a3a1a] hover:bg-[#5d4a3c] transition-all flex items-center justify-center gap-2 pixel-rounded"
        >
          <ChevronLeft size={24} />
          返回
        </button>
        <button
          onClick={handleLoadClick}
          disabled={!selectedSlot || !!message}
          className={`flex-1 py-3 text-xl font-bold border-4 border-[#8b5a2b] border-b-8 flex items-center justify-center gap-2 pixel-rounded transition-all ${
            !selectedSlot || !!message
              ? 'bg-[#3e2723] border-b-[#2a1912] text-gray-500 cursor-not-allowed'
              : 'bg-[#e6b87d] border-b-[#5a3a1a] text-[#3e2723] hover:bg-[#fcd3a1]'
          }`}
        >
          <Download size={24} />
          读取
        </button>
      </div>
    </div>
  );

  const renderToggle = (label: string, value: boolean, onChange: (next: boolean) => void) => (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex items-center justify-between border-4 border-[#8b5a2b] bg-[#2c1e16] px-4 py-4 text-left transition-all hover:bg-[#342319] pixel-rounded"
    >
      <span className="text-lg font-bold text-[#f3e5c5]">{label}</span>
      <span
        className={`min-w-[84px] border-2 px-3 py-1 text-center text-sm font-bold ${
          value ? 'border-[#b98c53] bg-[#e6b87d] text-[#3e2723]' : 'border-[#4a3f35] bg-[#1a110c] text-[#9e8968]'
        }`}
      >
        {value ? '开启' : '关闭'}
      </span>
    </button>
  );

  const renderSettingsMenu = () => (
    <div className="animate-fade-in">
      {renderBackToMainButton()}

      <div className="text-center mb-8">
        <h2 className="text-4xl font-bold text-amber-300 tracking-[0.25em]">设置</h2>
        <p className="mt-3 text-base leading-7 text-[#cbb89a]">
          先把营业环境整理妥当。音量、文字节奏与震动偏好会保存在本机。
        </p>
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div className="space-y-5 border-4 border-[#8b5a2b] bg-[#241914] p-5 pixel-rounded">
          <div className="flex items-center gap-3 border-b-2 border-[#4a3f35] pb-3 text-[#f3e5c5]">
            <Volume2 size={24} />
            <h3 className="text-2xl font-bold">音量</h3>
          </div>

          <label className="block">
            <div className="mb-2 flex items-center justify-between text-lg font-bold text-[#f3e5c5]">
              <span>BGM 音量</span>
              <span>{settings.bgmVolume}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={settings.bgmVolume}
              onChange={(event) => setSettings(prev => ({ ...prev, bgmVolume: Number(event.target.value) }))}
              className="w-full accent-[#e6b87d]"
            />
          </label>

          <label className="block">
            <div className="mb-2 flex items-center justify-between text-lg font-bold text-[#f3e5c5]">
              <span>音效音量</span>
              <span>{settings.sfxVolume}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={settings.sfxVolume}
              onChange={(event) => setSettings(prev => ({ ...prev, sfxVolume: Number(event.target.value) }))}
              className="w-full accent-[#e6b87d]"
            />
          </label>
        </div>

        <div className="space-y-5 border-4 border-[#8b5a2b] bg-[#241914] p-5 pixel-rounded">
          <div className="flex items-center gap-3 border-b-2 border-[#4a3f35] pb-3 text-[#f3e5c5]">
            <Sparkles size={24} />
            <h3 className="text-2xl font-bold">文本与演出</h3>
          </div>

          <div>
            <div className="mb-3 text-lg font-bold text-[#f3e5c5]">文字速度</div>
            <div className="grid grid-cols-3 gap-3">
              {(['slow', 'normal', 'fast'] as TextSpeed[]).map((speed) => {
                const selected = settings.textSpeed === speed;
                const label = speed === 'slow' ? '慢速' : speed === 'fast' ? '快速' : '标准';
                return (
                  <button
                    key={speed}
                    onClick={() => setSettings(prev => ({ ...prev, textSpeed: speed }))}
                    className={`border-4 px-3 py-3 text-lg font-bold transition-all pixel-rounded ${
                      selected
                        ? 'border-[#b98c53] bg-[#e6b87d] text-[#3e2723]'
                        : 'border-[#8b5a2b] bg-[#2c1e16] text-[#f3e5c5] hover:bg-[#342319]'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            {renderToggle('自动播放文本', settings.autoPlay, (next) => setSettings(prev => ({ ...prev, autoPlay: next })))}
            {renderToggle('屏幕震动效果', settings.screenShake, (next) => setSettings(prev => ({ ...prev, screenShake: next })))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderAboutMenu = () => (
    <div className="animate-fade-in">
      {renderBackToMainButton()}

      <div className="text-center mb-8">
        <h2 className="text-4xl font-bold text-amber-300 tracking-[0.25em]">关于</h2>
        <p className="mt-3 text-base text-[#cbb89a]">
        </p>
      </div>

      <div className="grid grid-cols-2 gap-5">
        <section className="border-4 border-[#8b5a2b] bg-[#241914] p-6 pixel-rounded">
          <div className="flex items-center gap-3 border-b-2 border-[#4a3f35] pb-3 text-[#f3e5c5]">
            <Info size={24} />
            <h3 className="text-2xl font-bold">开发者</h3>
          </div>
          <div className="mt-4 space-y-3 text-lg leading-8 text-[#d8c7a8]">
            <p>Glow</p>
            <p>
              GitHub：<a href="https://github.com/ruozhishimeng" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline">ruozhishimeng</a>
            </p>
            <p>
              主页：<a href="http://glowstavern.me/" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline">glowstavern.me</a>
            </p>
          </div>
        </section>

        <section className="border-4 border-[#8b5a2b] bg-[#241914] p-6 pixel-rounded">
          <div className="flex items-center gap-3 border-b-2 border-[#4a3f35] pb-3 text-[#f3e5c5]">
            <Sparkles size={24} />
            <h3 className="text-2xl font-bold">制作备注</h3>
          </div>
          <div className="mt-4 space-y-3 text-lg leading-8 text-[#d8c7a8]">
            <p>版本：V1.0.0</p>
          </div>
        </section>
      </div>
    </div>
  );

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-main-page z-50 p-8">
      <div className="absolute inset-0 bg-black/70 z-0" />

      <button
        onClick={onBack}
        className="absolute left-8 top-8 z-10 inline-flex items-center gap-2 border-4 border-[#8b5a2b] bg-[#4a3f35] px-4 py-2 text-lg font-bold text-[#f3e5c5] transition-all hover:bg-[#5d4a3c] pixel-rounded"
      >
        <ChevronLeft size={20} />
        返回标题
      </button>

      <div className={panelClass}>
        {mode === 'main' && renderMainMenu()}
        {mode === 'load' && renderLoadMenu()}
        {mode === 'settings' && renderSettingsMenu()}
        {mode === 'about' && renderAboutMenu()}
      </div>
    </div>
  );
}
