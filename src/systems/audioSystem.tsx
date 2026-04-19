import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import type { GamePhase } from '../state/gameState';
import {
  getPersistentTrackSource,
  getPhaseAudioDefaults,
  getSfxTrackSource,
  isSfxTag,
  loadStoredAudioSettings,
  saveAudioSettings,
  type AudioSettings,
  type AudioTag,
  type NodeAudioConfig,
  type PersistentAudioDirective,
  type SfxTag,
} from './audioCatalog';

type PersistentChannelKind = 'bgm' | 'ambient';

interface AudioSystemContextValue {
  settings: AudioSettings;
  setSettings: Dispatch<SetStateAction<AudioSettings>>;
  applyPhaseAudio: (phase: GamePhase) => void;
  applyNodeAudio: (nodeId: string, nodeAudio: NodeAudioConfig | undefined, phase: GamePhase) => void;
  playSfx: (tag: AudioTag) => void;
  startLoop: (tag: SfxTag, key: string) => void;
  stopLoop: (key: string) => void;
  stopAllTransient: () => void;
}

interface PersistentChannelState {
  tag: string | null;
  audio: HTMLAudioElement | null;
  fadeRafId: number | null;
}

interface LoopController {
  audio: HTMLAudioElement;
  stop: () => void;
}

const AudioSystemContext = createContext<AudioSystemContextValue | null>(null);
const DEFAULT_DIRECTIVE: PersistentAudioDirective = { action: 'keep' };

function clampVolume(volume: number) {
  return Math.max(0, Math.min(1, volume));
}

export function AudioProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AudioSettings>(() => loadStoredAudioSettings());
  const unlockedRef = useRef(false);
  const currentPhaseRef = useRef<GamePhase>('start_screen');
  const lastAppliedNodeKeyRef = useRef<string | null>(null);
  const bgmOverrideActiveRef = useRef(false);
  const ambientOverrideActiveRef = useRef(false);
  const desiredPersistentRef = useRef<Record<PersistentChannelKind, PersistentAudioDirective>>({
    bgm: DEFAULT_DIRECTIVE,
    ambient: DEFAULT_DIRECTIVE,
  });
  const persistentStateRef = useRef<Record<PersistentChannelKind, PersistentChannelState>>({
    bgm: { tag: null, audio: null, fadeRafId: null },
    ambient: { tag: null, audio: null, fadeRafId: null },
  });
  const loopControllersRef = useRef<Map<string, LoopController>>(new Map<string, LoopController>());
  const transientSfxRef = useRef<Set<HTMLAudioElement>>(new Set());

  const getTargetVolume = useCallback((channel: PersistentChannelKind) => {
    const rawVolume = channel === 'bgm' ? settings.bgmVolume : settings.ambientVolume;
    return rawVolume / 100;
  }, [settings]);

  const cancelFade = useCallback((channel: PersistentChannelKind) => {
    const state = persistentStateRef.current[channel];
    if (state.fadeRafId !== null) {
      window.cancelAnimationFrame(state.fadeRafId);
      state.fadeRafId = null;
    }
  }, []);

  const fadeAudioElement = useCallback((
    channel: PersistentChannelKind,
    audio: HTMLAudioElement,
    from: number,
    to: number,
    durationMs: number,
    onComplete?: () => void,
  ) => {
    cancelFade(channel);

    if (durationMs <= 0) {
      audio.volume = clampVolume(to);
      onComplete?.();
      return;
    }

    const startedAt = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startedAt;
      const progress = Math.min(1, elapsed / durationMs);
      audio.volume = clampVolume(from + (to - from) * progress);

      if (progress < 1) {
        persistentStateRef.current[channel].fadeRafId = window.requestAnimationFrame(tick);
      } else {
        persistentStateRef.current[channel].fadeRafId = null;
        onComplete?.();
      }
    };

    persistentStateRef.current[channel].fadeRafId = window.requestAnimationFrame(tick);
  }, [cancelFade]);

  const fadeDetachedAudioElement = useCallback((
    audio: HTMLAudioElement,
    from: number,
    to: number,
    durationMs: number,
    onComplete?: () => void,
  ) => {
    if (durationMs <= 0) {
      audio.volume = clampVolume(to);
      onComplete?.();
      return;
    }

    const startedAt = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startedAt;
      const progress = Math.min(1, elapsed / durationMs);
      audio.volume = clampVolume(from + (to - from) * progress);

      if (progress < 1) {
        window.requestAnimationFrame(tick);
      } else {
        onComplete?.();
      }
    };

    window.requestAnimationFrame(tick);
  }, []);

  const stopPersistentChannel = useCallback((channel: PersistentChannelKind, fadeOut = 200) => {
    const state = persistentStateRef.current[channel];
    if (!state.audio) {
      state.tag = null;
      return;
    }

    const currentAudio = state.audio;
    fadeAudioElement(channel, currentAudio, currentAudio.volume, 0, fadeOut, () => {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      if (persistentStateRef.current[channel].audio === currentAudio) {
        persistentStateRef.current[channel].audio = null;
        persistentStateRef.current[channel].tag = null;
      }
    });
  }, [fadeAudioElement]);

  const applyPersistentDirective = useCallback((channel: PersistentChannelKind, directive: PersistentAudioDirective) => {
    desiredPersistentRef.current[channel] = directive;

    if (directive.action === 'keep' || directive.action === 'resume') {
      const existing = persistentStateRef.current[channel].audio;
      if (existing) {
        existing.volume = getTargetVolume(channel);
        if (unlockedRef.current) {
          void existing.play().catch(error => {
            console.warn(`[audioSystem] Failed to resume ${channel}:`, error);
          });
        }
      }
      return;
    }

    if (directive.action === 'stop') {
      stopPersistentChannel(channel, directive.fadeOut ?? 200);
      return;
    }

    const src = getPersistentTrackSource(channel, directive.tag);
    if (!src) {
      console.warn(`[audioSystem] Missing ${channel} asset for tag:`, directive.tag);
      return;
    }

    const state = persistentStateRef.current[channel];
    const targetVolume = getTargetVolume(channel);

    if (state.audio && state.tag === directive.tag) {
      state.audio.loop = true;
      state.audio.volume = targetVolume;
      if (unlockedRef.current) {
        void state.audio.play().catch(error => {
          console.warn(`[audioSystem] Failed to continue ${channel}:`, error);
        });
      }
      return;
    }

    const previousAudio = state.audio;
    const nextAudio = new Audio(src);
    nextAudio.loop = true;
    nextAudio.preload = 'auto';
    nextAudio.volume = 0;

    state.audio = nextAudio;
    state.tag = String(directive.tag);

    if (unlockedRef.current) {
      void nextAudio.play().catch(error => {
        console.warn(`[audioSystem] Failed to play ${channel}:`, error);
      });
    }

    fadeAudioElement(channel, nextAudio, 0, targetVolume, directive.fadeIn ?? 800);

    if (previousAudio) {
      fadeDetachedAudioElement(previousAudio, previousAudio.volume, 0, directive.fadeOut ?? 400, () => {
        previousAudio.pause();
        previousAudio.currentTime = 0;
      });
    }
  }, [fadeAudioElement, fadeDetachedAudioElement, getTargetVolume, stopPersistentChannel]);

  const replayDesiredPersistentChannels = useCallback(() => {
    (['bgm', 'ambient'] as const).forEach(channel => {
      applyPersistentDirective(channel, desiredPersistentRef.current[channel]);
    });
  }, [applyPersistentDirective]);

  const unlockAudio = useCallback(() => {
    const wasUnlocked = unlockedRef.current;
    unlockedRef.current = true;

    if (!wasUnlocked) {
      replayDesiredPersistentChannels();
    }
  }, [replayDesiredPersistentChannels]);

  const playHtmlAudio = useCallback((audio: HTMLAudioElement, onFailure?: () => void) => {
    void audio.play().catch(error => {
      console.warn('[audioSystem] Failed to play audio:', error);
      onFailure?.();
    });
  }, []);

  const startLoop = useCallback((tag: SfxTag, key: string) => {
    if (loopControllersRef.current.has(key)) {
      return;
    }

    const src = getSfxTrackSource(tag);
    if (!src) {
      console.warn('[audioSystem] Missing loop SFX asset for tag:', tag);
      return;
    }

    const audio = new Audio(src);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = settings.sfxVolume / 100;

    const stop = () => {
      audio.pause();
      audio.currentTime = 0;
      loopControllersRef.current.delete(key);
    };

    loopControllersRef.current.set(key, { audio, stop });
    playHtmlAudio(audio);
  }, [playHtmlAudio, settings.sfxVolume]);

  const playSfx = useCallback((tag: AudioTag) => {
    if (!isSfxTag(tag)) {
      console.warn('[audioSystem] Attempted to play non-SFX tag as SFX:', tag);
      return;
    }

    if (tag === 'mixing_loop') {
      startLoop(tag, 'mixing-loop');
      return;
    }

    const src = getSfxTrackSource(tag);
    if (!src) {
      console.warn('[audioSystem] Missing SFX asset for tag:', tag);
      return;
    }

    const audio = new Audio(src);
    audio.preload = 'auto';
    audio.volume = settings.sfxVolume / 100;
    transientSfxRef.current.add(audio);

    audio.onended = () => {
      transientSfxRef.current.delete(audio);
    };
    audio.onerror = () => {
      transientSfxRef.current.delete(audio);
    };

    playHtmlAudio(audio, () => {
      transientSfxRef.current.delete(audio);
    });
  }, [playHtmlAudio, settings.sfxVolume, startLoop]);

  const stopLoop = useCallback((key: string) => {
    const controller = loopControllersRef.current.get(key);
    controller?.stop();
  }, []);

  const stopAllTransient = useCallback(() => {
    loopControllersRef.current.forEach(controller => {
      controller.stop();
    });
    loopControllersRef.current.clear();

    transientSfxRef.current.forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
    transientSfxRef.current.clear();
  }, []);

  useEffect(() => {
    saveAudioSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleUnlock = () => {
      unlockAudio();
    };

    window.addEventListener('pointerdown', handleUnlock, { capture: true, passive: true });
    window.addEventListener('keydown', handleUnlock, { capture: true });

    return () => {
      window.removeEventListener('pointerdown', handleUnlock, true);
      window.removeEventListener('keydown', handleUnlock, true);
    };
  }, [unlockAudio]);

  useEffect(() => {
    loopControllersRef.current.forEach(controller => {
      controller.audio.volume = settings.sfxVolume / 100;
    });

    const phaseDefaults = getPhaseAudioDefaults(currentPhaseRef.current, settings.defaultBgmTag);
    if (!bgmOverrideActiveRef.current) {
      desiredPersistentRef.current.bgm = phaseDefaults.bgm;
    }
    if (!ambientOverrideActiveRef.current) {
      desiredPersistentRef.current.ambient = phaseDefaults.ambient;
    }

    replayDesiredPersistentChannels();
  }, [replayDesiredPersistentChannels, settings]);

  const applyPhaseAudio = useCallback((phase: GamePhase) => {
    currentPhaseRef.current = phase;
    lastAppliedNodeKeyRef.current = null;
    bgmOverrideActiveRef.current = false;
    ambientOverrideActiveRef.current = false;

    const defaults = getPhaseAudioDefaults(phase, settings.defaultBgmTag);
    applyPersistentDirective('bgm', defaults.bgm);
    applyPersistentDirective('ambient', defaults.ambient);
  }, [applyPersistentDirective, settings.defaultBgmTag]);

  const applyNodeAudio = useCallback((nodeId: string, nodeAudio: NodeAudioConfig | undefined, phase: GamePhase) => {
    const dedupeKey = `${phase}:${nodeId}`;
    if (lastAppliedNodeKeyRef.current === dedupeKey) {
      return;
    }

    currentPhaseRef.current = phase;
    lastAppliedNodeKeyRef.current = dedupeKey;

    const phaseDefaults = getPhaseAudioDefaults(phase, settings.defaultBgmTag);
    bgmOverrideActiveRef.current = !!nodeAudio?.bgm;
    ambientOverrideActiveRef.current = !!nodeAudio?.ambient;

    applyPersistentDirective('bgm', nodeAudio?.bgm ?? phaseDefaults.bgm);
    applyPersistentDirective('ambient', nodeAudio?.ambient ?? phaseDefaults.ambient);

    const onEnterSfx = nodeAudio?.sfx?.onEnter || [];
    onEnterSfx.forEach(tag => {
      if (isSfxTag(tag)) {
        playSfx(tag);
      } else {
        console.warn('[audioSystem] Unknown node SFX tag:', tag);
      }
    });
  }, [applyPersistentDirective, playSfx, settings.defaultBgmTag]);

  useEffect(() => {
    return () => {
      stopAllTransient();
      (['bgm', 'ambient'] as const).forEach(channel => {
        cancelFade(channel);
        const state = persistentStateRef.current[channel];
        state.audio?.pause();
        if (state.audio) {
          state.audio.currentTime = 0;
        }
        state.audio = null;
        state.tag = null;
      });
    };
  }, [cancelFade, stopAllTransient]);

  const value = useMemo<AudioSystemContextValue>(() => ({
    settings,
    setSettings,
    applyPhaseAudio,
    applyNodeAudio,
    playSfx,
    startLoop,
    stopLoop,
    stopAllTransient,
  }), [settings, applyPhaseAudio, applyNodeAudio, playSfx, startLoop, stopLoop, stopAllTransient]);

  return (
    <AudioSystemContext.Provider value={value}>
      {children}
    </AudioSystemContext.Provider>
  );
}

export function useAudioSystem() {
  const context = useContext(AudioSystemContext);
  if (!context) {
    throw new Error('useAudioSystem must be used within an AudioProvider');
  }
  return context;
}
