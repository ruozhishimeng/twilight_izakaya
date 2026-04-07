import React from 'react';
import { Volume2 } from 'lucide-react';
import { getMusicTagLabel, MUSIC_TAG_OPTIONS, type AudioSettings } from '../systems/audioCatalog';

interface Props {
  settings: AudioSettings;
  onChange: React.Dispatch<React.SetStateAction<AudioSettings>>;
  title?: string;
  className?: string;
}

export default function AudioSettingsPanel({
  settings,
  onChange,
  title = '音量',
  className = 'space-y-5 border-4 border-[#8b5a2b] bg-[#241914] p-5 pixel-rounded',
}: Props) {
  return (
    <div className={className}>
      <div className="flex items-center gap-3 border-b-2 border-[#4a3f35] pb-3 text-[#f3e5c5]">
        <Volume2 size={24} />
        <h3 className="text-2xl font-bold">{title}</h3>
      </div>

      <label className="block">
        <div className="mb-2 flex items-center justify-between text-lg font-bold text-[#f3e5c5]">
          <span>默认背景音乐</span>
          <span>{getMusicTagLabel(settings.defaultBgmTag)}</span>
        </div>
        <select
          value={settings.defaultBgmTag}
          onChange={event => onChange(prev => ({ ...prev, defaultBgmTag: event.target.value as AudioSettings['defaultBgmTag'] }))}
          className="w-full border-2 border-[#4a3f35] bg-[#1a110c] px-3 py-2 text-lg text-[#f3e5c5] outline-none transition-colors focus:border-[#e6b87d]"
        >
          {MUSIC_TAG_OPTIONS.map(option => (
            <option key={option.tag} value={option.tag}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

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
          onChange={event => onChange(prev => ({ ...prev, bgmVolume: Number(event.target.value) }))}
          className="w-full accent-[#e6b87d]"
        />
      </label>

      <label className="block">
        <div className="mb-2 flex items-center justify-between text-lg font-bold text-[#f3e5c5]">
          <span>环境音量</span>
          <span>{settings.ambientVolume}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={settings.ambientVolume}
          onChange={event => onChange(prev => ({ ...prev, ambientVolume: Number(event.target.value) }))}
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
          onChange={event => onChange(prev => ({ ...prev, sfxVolume: Number(event.target.value) }))}
          className="w-full accent-[#e6b87d]"
        />
      </label>
    </div>
  );
}
