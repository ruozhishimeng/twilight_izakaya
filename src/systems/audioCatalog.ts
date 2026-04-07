import guitar1 from '../assets/music/bgm/guitar_1.mp3';
import guitar2 from '../assets/music/bgm/guitar_2.mp3';
import jazz1 from '../assets/music/bgm/jazz_1.mp3';
import jazz2 from '../assets/music/bgm/jazz_2.mp3';
import piano1 from '../assets/music/bgm/piano_1.mp3';
import piano2 from '../assets/music/bgm/piano_2.mp3';
import buttonClick from '../assets/music/sfx/button.mp3';
import dialogueRefresh from '../assets/music/sfx/dialogue_refresh.mp3';
import doorBell from '../assets/music/sfx/door_bell.mp3';
import mixingLoop from '../assets/music/sfx/mixing.mp3';
import mixingFailed from '../assets/music/sfx/mixing_failed.mp3';
import mixingSuccess from '../assets/music/sfx/mixing_success.mp3';
import rewardReveal from '../assets/music/sfx/reward.mp3';
import type { GamePhase } from '../App';

export type MusicTag =
  | 'guitar_1'
  | 'guitar_2'
  | 'jazz_1'
  | 'jazz_2'
  | 'piano_1'
  | 'piano_2';

export type SfxTag =
  | 'ui_click'
  | 'dialogue_refresh'
  | 'door_bell'
  | 'mixing_loop'
  | 'mix_success'
  | 'mix_fail'
  | 'reward_reveal';

export type AmbientTag = string;
export type AudioTag = MusicTag | SfxTag | AmbientTag;
export type AudioChannelAction = 'switch' | 'keep' | 'stop' | 'resume';

export interface PersistentAudioDirective {
  action: AudioChannelAction;
  tag?: AudioTag;
  fadeIn?: number;
  fadeOut?: number;
}

export interface NodeAudioConfig {
  bgm?: PersistentAudioDirective;
  ambient?: PersistentAudioDirective;
  sfx?: {
    onEnter?: AudioTag[];
  };
}

export interface AudioSettings {
  bgmVolume: number;
  ambientVolume: number;
  sfxVolume: number;
  defaultBgmTag: MusicTag;
}

export const AUDIO_SETTINGS_STORAGE_KEY = 'twilight_izakaya_menu_settings';

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  bgmVolume: 80,
  ambientVolume: 35,
  sfxVolume: 85,
  defaultBgmTag: 'piano_1',
};

export const MUSIC_TAG_OPTIONS: Array<{ tag: MusicTag; label: string }> = [
  { tag: 'piano_1', label: '钢琴 1' },
  { tag: 'piano_2', label: '钢琴 2' },
  { tag: 'guitar_1', label: '吉他 1' },
  { tag: 'guitar_2', label: '吉他 2' },
  { tag: 'jazz_1', label: '爵士 1' },
  { tag: 'jazz_2', label: '爵士 2' },
];

export const BGM_TRACKS: Record<MusicTag, string> = {
  guitar_1: guitar1,
  guitar_2: guitar2,
  jazz_1: jazz1,
  jazz_2: jazz2,
  piano_1: piano1,
  piano_2: piano2,
};

export const SFX_TRACKS: Record<SfxTag, string> = {
  ui_click: buttonClick,
  dialogue_refresh: dialogueRefresh,
  door_bell: doorBell,
  mixing_loop: mixingLoop,
  mix_success: mixingSuccess,
  mix_fail: mixingFailed,
  reward_reveal: rewardReveal,
};

export const AMBIENT_TRACKS: Partial<Record<AmbientTag, string>> = {};

const PHASE_BGM_TIMINGS: Record<GamePhase, { fadeIn: number; fadeOut: number }> = {
  start_screen: { fadeIn: 800, fadeOut: 400 },
  main_menu: { fadeIn: 800, fadeOut: 400 },
  intro_sequence: { fadeIn: 800, fadeOut: 400 },
  intro: { fadeIn: 900, fadeOut: 400 },
  observation: { fadeIn: 900, fadeOut: 400 },
  story: { fadeIn: 900, fadeOut: 400 },
  mixing: { fadeIn: 900, fadeOut: 400 },
  result: { fadeIn: 600, fadeOut: 300 },
  day_summary: { fadeIn: 900, fadeOut: 400 },
  guest_reflection: { fadeIn: 900, fadeOut: 400 },
};

const SFX_TAGS = new Set<SfxTag>([
  'ui_click',
  'dialogue_refresh',
  'door_bell',
  'mixing_loop',
  'mix_success',
  'mix_fail',
  'reward_reveal',
]);

export function loadStoredAudioSettings(): AudioSettings {
  if (typeof window === 'undefined') {
    return DEFAULT_AUDIO_SETTINGS;
  }

  try {
    const raw = window.localStorage.getItem(AUDIO_SETTINGS_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_AUDIO_SETTINGS;
    }

    const parsed = JSON.parse(raw) as Partial<AudioSettings>;
    return {
      bgmVolume: clampVolume(parsed.bgmVolume, DEFAULT_AUDIO_SETTINGS.bgmVolume),
      ambientVolume: clampVolume(parsed.ambientVolume, DEFAULT_AUDIO_SETTINGS.ambientVolume),
      sfxVolume: clampVolume(parsed.sfxVolume, DEFAULT_AUDIO_SETTINGS.sfxVolume),
      defaultBgmTag: isMusicTag(parsed.defaultBgmTag) ? parsed.defaultBgmTag : DEFAULT_AUDIO_SETTINGS.defaultBgmTag,
    };
  } catch (error) {
    console.warn('[audioCatalog] Failed to parse stored audio settings:', error);
    return DEFAULT_AUDIO_SETTINGS;
  }
}

export function saveAudioSettings(settings: AudioSettings) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(AUDIO_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

export function getPersistentTrackSource(channel: 'bgm' | 'ambient', tag?: AudioTag) {
  if (!tag) {
    return undefined;
  }

  if (channel === 'bgm' && isMusicTag(tag)) {
    return BGM_TRACKS[tag];
  }

  if (channel === 'ambient') {
    return AMBIENT_TRACKS[tag as AmbientTag];
  }

  return undefined;
}

export function getSfxTrackSource(tag?: SfxTag) {
  if (!tag) {
    return undefined;
  }

  return SFX_TRACKS[tag];
}

export function getPhaseAudioDefaults(phase: GamePhase, defaultBgmTag: MusicTag) {
  const timings = PHASE_BGM_TIMINGS[phase];
  return {
    bgm: {
      action: 'switch' as const,
      tag: defaultBgmTag,
      fadeIn: timings.fadeIn,
      fadeOut: timings.fadeOut,
    },
    ambient: {
      action: 'stop' as const,
      fadeOut: 200,
    },
  };
}

export function getMusicTagLabel(tag: MusicTag) {
  return MUSIC_TAG_OPTIONS.find(option => option.tag === tag)?.label ?? tag;
}

export function isMusicTag(tag?: unknown): tag is MusicTag {
  return typeof tag === 'string' && tag in BGM_TRACKS;
}

export function isSfxTag(tag?: AudioTag): tag is SfxTag {
  return !!tag && SFX_TAGS.has(tag as SfxTag);
}

function clampVolume(value: number | undefined, fallback: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}
