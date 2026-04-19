import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BellRing, Book, BookOpen, ScrollText, Settings, X } from 'lucide-react';
import BookModal from './components/BookModal';
import DaySummaryPhase from './components/DaySummaryPhase';
import Diary from './components/Diary';
import IntroSequence from './components/IntroSequence';
import MainMenu from './components/MainMenu';
import MixingPhase from './components/MixingPhase';
import ObservationPhase from './components/ObservationPhase';
import ResultPhase from './components/ResultPhase';
import RewardPhase from './components/RewardPhase';
import SettingsModal from './components/SettingsModal';
import StartScreen from './components/StartScreen';
import StoryPhase from './components/StoryPhase';
import TailChatPhase from './components/TailChatPhase';
import {
  GUESTS,
} from './data/gameData';
import { useGameFlowController } from './hooks/useGameFlowController';
import { useImagePreloader } from './hooks/useImagePreloader';
import { useGameMachine } from './hooks/useGameMachine';
import {
  createPersistedSnapshot,
  type GuestReflectionState,
} from './state/gameState';
import { saveSystem } from './systems/SaveSystem';
import { useAudioSystem } from './systems/audioSystem';

type ViteImportMeta = ImportMeta & {
  env?: {
    DEV?: boolean;
  };
};

function weekdayLabel(day: number) {
  return ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'][day - 1] || `第 ${day} 天`;
}

type TailChatPlaybackState =
  | {
      stage: 'input';
      playerText: '';
      npcLines: string[];
      npcIndex: 0;
    }
  | {
      stage: 'player';
      playerText: string;
      npcLines: string[];
      npcIndex: 0;
    }
  | {
      stage: 'npc';
      playerText: string;
      npcLines: string[];
      npcIndex: number;
    };

const INITIAL_TAIL_CHAT_PLAYBACK: TailChatPlaybackState = {
  stage: 'input',
  playerText: '',
  npcLines: [],
  npcIndex: 0,
};

function GuestReflectionOverlay({
  reflection,
  onContinue,
}: {
  reflection: GuestReflectionState;
  onContinue: () => void;
}) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 px-8 backdrop-blur-sm">
      <div className="w-full max-w-3xl border-[6px] border-[#1a110c] bg-[#2c1e16] p-8 text-[#e8dcc4] shadow-[0_0_60px_rgba(0,0,0,0.72)] pixel-rounded-lg animate-scale-up">
        <div className="border-b-2 border-[#8b5a2b] pb-4">
          <div className="text-sm tracking-[0.3em] text-[#8b5a2b]">REFLECTION</div>
          <h2 className="mt-2 text-3xl font-bold">营业后的片刻回想</h2>
        </div>
        <div className="mt-6 rounded-xl border-2 border-[#4a3f35] bg-[#1a110c] px-5 py-6 leading-8 text-[#e8dcc4]">
          {reflection.text || '今晚的这一页，还没有留下新的字句。'}
        </div>
        <div className="mt-6 text-sm text-[#bda98a]">
          {reflection.sameDay
            ? '整理好杯具后，下一位客人很快就会推门而入。'
            : '合上这页手记，今晚的营业就先到这里。'}
        </div>
        <button
          type="button"
          onClick={onContinue}
          className="pixel-button mt-8 px-10 py-3 text-xl font-bold"
        >
          继续
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const { applyNodeAudio, applyPhaseAudio, playSfx } = useAudioSystem();
  const {
    snapshot,
    transition: transitionTo,
    reset,
    loadSnapshot,
    patchContext,
    patchCurrentGuest,
    patchNpcDialogue,
    resetCurrentGuest,
  } = useGameMachine();
  const [isDiaryOpen, setIsDiaryOpen] = useState(false);
  const [isBookOpen, setIsBookOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
  const [isChatEntryEnabled, setIsChatEntryEnabled] = useState(false);
  const [tailChatInput, setTailChatInput] = useState('');
  const [tailChatPlayback, setTailChatPlayback] = useState<TailChatPlaybackState>(INITIAL_TAIL_CHAT_PLAYBACK);

  const isDebugMode = !!(import.meta as ViteImportMeta).env?.DEV;
  const {
    game,
    currentPhase,
    guest,
    currentGuestData,
    startNodeId,
    teachingNode,
    mixingNode,
    availableChatNodes,
    canShowTranscriptButton,
    activeAudioNode,
    appendCurrentGuestTranscript,
    debugJump,
    beginGuestArrival,
    openChat,
    enterMixing,
    enterObservation,
    completeObservation,
    rewardGuest,
    serveDrink,
    enterTailChatBeforeNodeEnd,
    finishTailChatLobby,
    openTailChatSession,
    leaveTailChatSession,
    sendTailChatMessage,
    completeConversation,
    continueReward,
    continueResult,
    continueReflection,
    continueDaySummary,
  } = useGameFlowController(
    {
      snapshot,
      transition: transitionTo,
      patchContext,
      patchCurrentGuest,
      patchNpcDialogue,
      resetCurrentGuest,
    },
    {
      closeTranscript: () => setIsTranscriptOpen(false),
      playSfx,
    },
  );

  const handleSave = useCallback(async (slotId: string, slotName: string) => {
    await saveSystem.saveGame(slotId, slotName, createPersistedSnapshot(snapshot));
  }, [snapshot]);

  const handleLoad = useCallback(async (slotId: string) => {
    const slot = await saveSystem.getSave(slotId);
    if (!slot) {
      return;
    }

    loadSnapshot(slot.data);
    setIsDiaryOpen(false);
    setIsBookOpen(false);
    setIsSettingsOpen(false);
    setIsTranscriptOpen(false);
  }, [loadSnapshot]);

  const imagesToPreload = useMemo(() => {
    const urls = ['/assets/back_grounds/main_page.png', '/assets/back_grounds/table.png'];
    GUESTS.forEach(item => {
      urls.push(item.image);
    });
    return urls;
  }, []);

  const { imagesPreloaded } = useImagePreloader(imagesToPreload);
  const tailChatDisplayText = useMemo(() => {
    if (snapshot.value !== 'dayLoop.guest.llmChatSession') {
      return game.npcDialogue.lastReplyLines.length > 0
        ? game.npcDialogue.lastReplyLines.join('\n')
        : game.currentGuest.tailChat.entryStatusText;
    }

    if (tailChatPlayback.stage === 'player') {
      return tailChatPlayback.playerText;
    }

    if (tailChatPlayback.stage === 'npc') {
      return tailChatPlayback.npcLines[tailChatPlayback.npcIndex] || game.currentGuest.tailChat.entryStatusText;
    }

    const latestReply = game.npcDialogue.lastReplyLines[game.npcDialogue.lastReplyLines.length - 1];
    return latestReply || game.currentGuest.tailChat.entryStatusText;
  }, [
    game.currentGuest.tailChat.entryStatusText,
    game.npcDialogue.lastReplyLines,
    snapshot.value,
    tailChatPlayback,
  ]);
  const tailChatPortraitUrl = guest.expressions.dialogue || guest.image;
  const tailChatSpeakerName =
    snapshot.value === 'dayLoop.guest.llmChatSession' && tailChatPlayback.stage === 'player'
      ? '我'
      : guest.name;

  useEffect(() => {
    if (imagesPreloaded && snapshot.value === 'boot') {
      transitionTo('startScreen');
    }
  }, [imagesPreloaded, snapshot.value, transitionTo]);

  useEffect(() => {
    const nodeId = activeAudioNode?.event_id || activeAudioNode?.id;
    if (nodeId) {
      applyNodeAudio(nodeId, activeAudioNode.audio, currentPhase);
      return;
    }

    applyPhaseAudio(currentPhase);
  }, [activeAudioNode, applyNodeAudio, applyPhaseAudio, currentPhase]);

  useEffect(() => {
    if (snapshot.value !== 'dayLoop.guest.story') {
      setIsChatEntryEnabled(false);
    }
  }, [snapshot.value]);

  useEffect(() => {
    if (snapshot.value !== 'dayLoop.guest.llmChatSession') {
      setTailChatInput('');
      setTailChatPlayback(INITIAL_TAIL_CHAT_PLAYBACK);
    }
  }, [snapshot.value]);

  const handleChatAvailabilityChange = useCallback((canOpen: boolean) => {
    setIsChatEntryEnabled(canOpen);
  }, []);

  const handleStoryNodeChange = useCallback((nodeId: string) => {
    setIsChatEntryEnabled(false);
    patchCurrentGuest({ nodeId });
  }, [patchCurrentGuest]);

  const handleGlobalButtonClickCapture = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    const button = target?.closest('button');

    if (!button || button.disabled || button.dataset.audioClick === 'off') {
      return;
    }

    playSfx('ui_click');
  }, [playSfx]);

  const handleNewGame = useCallback(() => {
    reset('introSequence');
    setIsDiaryOpen(false);
    setIsBookOpen(false);
    setIsSettingsOpen(false);
    setIsTranscriptOpen(false);
  }, [reset]);

  const handleReturnToMenu = useCallback(() => {
    reset('mainMenu');
    setIsDiaryOpen(false);
    setIsBookOpen(false);
    setIsSettingsOpen(false);
    setIsTranscriptOpen(false);
  }, [reset]);

  const handleTailChatSend = useCallback(async () => {
    const result = await sendTailChatMessage(tailChatInput);
    if (result.ok) {
      setTailChatInput('');
      setTailChatPlayback({
        stage: 'player',
        playerText: result.playerText,
        npcLines: result.replyLines,
        npcIndex: 0,
      });
    }
  }, [sendTailChatMessage, tailChatInput]);

  const handleTailChatAdvance = useCallback(() => {
    setTailChatPlayback(previous => {
      if (previous.stage === 'player') {
        return {
          stage: 'npc',
          playerText: previous.playerText,
          npcLines: previous.npcLines,
          npcIndex: 0,
        };
      }

      if (previous.stage === 'npc' && previous.npcIndex < previous.npcLines.length - 1) {
        return {
          ...previous,
          npcIndex: previous.npcIndex + 1,
        };
      }

      return INITIAL_TAIL_CHAT_PLAYBACK;
    });
  }, []);

  if (!imagesPreloaded) {
    return (
      <div className="min-h-screen bg-[#000] text-gray-200 font-sans flex items-center justify-center p-4 pixel-art-container">
        <div className="text-2xl animate-pulse">加载中...</div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[#000] text-gray-200 font-sans flex items-center justify-center p-4 pixel-art-container relative"
      onClickCapture={handleGlobalButtonClickCapture}
    >
      {snapshot.value === 'startScreen' && <StartScreen onStart={() => transitionTo('mainMenu')} />}

      {snapshot.value === 'mainMenu' && (
        <MainMenu
          onNewGame={handleNewGame}
          onLoadGame={handleLoad}
          onBack={() => transitionTo('startScreen')}
        />
      )}

      {snapshot.value === 'introSequence' && (
        <IntroSequence onComplete={() => transitionTo('dayLoop.intro')} />
      )}

      {snapshot.value !== 'boot' &&
        snapshot.value !== 'startScreen' &&
        snapshot.value !== 'mainMenu' &&
        snapshot.value !== 'introSequence' && (
          <div className="relative h-[86vh] w-[92vw] max-w-7xl overflow-hidden border-[6px] border-[#1a110c] bg-[#120c09] shadow-[0_0_60px_rgba(0,0,0,0.78)] pixel-rounded-lg">
            <div className="absolute inset-0 bg-table" />
            <div className="absolute inset-0 bg-black/35" />

            <div className="absolute left-6 top-6 z-20 rounded-lg border-4 border-[#1a110c] bg-[#2c1e16]/90 px-4 py-3 text-[#e8dcc4] shadow-lg">
              <div className="text-xs tracking-[0.22em] text-[#b18859]">SHIFT</div>
              <div className="mt-1 text-lg font-bold">
                第 {game.week} 周 · {weekdayLabel(game.day)}
              </div>
              <div className="mt-1 text-sm text-[#cbb89a]">
                {currentGuestData ? `今夜第 ${game.guestInDay} 位客人` : '等待下一位客人'}
              </div>
            </div>

            <div className="absolute right-6 top-6 z-20 flex items-center gap-3">
              {snapshot.value === 'dayLoop.guest.story' && availableChatNodes.length > 0 && isChatEntryEnabled && (
                <button
                  type="button"
                  onClick={openChat}
                  className="pixel-button px-4 py-3 text-sm font-bold"
                >
                  闲聊
                </button>
              )}

              {canShowTranscriptButton && (
                <button
                  type="button"
                  onClick={() => setIsTranscriptOpen(open => !open)}
                  className="pixel-button flex items-center gap-2 px-4 py-3 text-sm font-bold"
                >
                  {isTranscriptOpen ? <X size={16} /> : <ScrollText size={16} />}
                  对话记录
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsDiaryOpen(true)}
                className="pixel-button flex items-center gap-2 px-4 py-3 text-sm font-bold"
              >
                <BookOpen size={16} />
                手记
              </button>

              <button
                type="button"
                onClick={() => setIsBookOpen(true)}
                className="pixel-button flex items-center gap-2 px-4 py-3 text-sm font-bold"
              >
                <Book size={16} />
                图鉴
              </button>

              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                className="pixel-button flex items-center gap-2 px-4 py-3 text-sm font-bold"
              >
                <Settings size={16} />
                设置
              </button>
            </div>

            {isTranscriptOpen && (
              <aside className="absolute right-6 top-24 z-20 h-[60vh] w-[22rem] overflow-hidden border-[6px] border-[#1a110c] bg-[#2c1e16]/95 text-[#e8dcc4] shadow-[0_0_30px_rgba(0,0,0,0.5)] pixel-rounded-lg">
                <div className="border-b-4 border-[#1a110c] bg-[#1c1411] px-4 py-3">
                  <div className="text-xs tracking-[0.25em] text-[#b18859]">TRANSCRIPT</div>
                  <div className="mt-1 text-lg font-bold">对话记录</div>
                </div>
                <div className="h-[calc(60vh-74px)] overflow-y-auto px-4 py-4 custom-scrollbar">
                  <div className="space-y-3">
                    {game.currentGuest.transcript.map(entry => (
                      <article
                        key={entry.key}
                        className="rounded-lg border-2 border-[#4a3f35] bg-[#1a110c] px-3 py-3"
                      >
                        <div className="text-xs tracking-[0.2em] text-[#b18859]">{entry.speaker}</div>
                        <div className="mt-2 whitespace-pre-wrap leading-7 text-[#e8dcc4]">
                          {entry.text}
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              </aside>
            )}

            {snapshot.value === 'dayLoop.intro' && (
              <div className="absolute inset-0 z-10 flex items-center justify-center px-8">
                <div className="w-full max-w-3xl border-[6px] border-[#1a110c] bg-[#2c1e16]/92 p-8 text-center text-[#e8dcc4] shadow-[0_0_60px_rgba(0,0,0,0.72)] pixel-rounded-lg animate-scale-up">
                  <BellRing size={48} className="mx-auto text-[#efc786]" />
                  <div className="mt-6 text-sm tracking-[0.35em] text-[#b18859]">ARRIVAL</div>
                  <h2 className="mt-3 text-4xl font-bold">
                    {game.guestInterludeText ? '门外的脚步声再度响起' : '门铃轻轻一响'}
                  </h2>
                  <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[#d7c7a9]">
                    {game.guestInterludeText ||
                      (currentGuestData
                        ? `${guest.name} 即将推门而入。整理好吧台，准备迎接这一位新的来客。`
                        : '今晚暂时没有新的来客。')}
                  </p>
                  {currentGuestData && (
                    <button
                      type="button"
                      onClick={beginGuestArrival}
                      className="pixel-button mt-8 px-10 py-3 text-xl font-bold"
                    >
                      迎接客人
                    </button>
                  )}
                </div>
              </div>
            )}

            {(snapshot.value === 'dayLoop.guest.story' ||
              snapshot.value === 'dayLoop.guest.chat' ||
              snapshot.value === 'dayLoop.guest.reward') && currentGuestData && (
              <StoryPhase
                guest={guest}
                startNodeId={startNodeId || game.currentGuest.nodeId || ''}
                currentNodeId={game.currentGuest.nodeId}
                chatAvailabilityEnabled={snapshot.value === 'dayLoop.guest.story'}
                discoveredFeatures={game.currentGuest.discoveredFeatures}
                onNodeChange={handleStoryNodeChange}
                onEnterMixing={enterMixing}
                onEnterObservation={enterObservation}
                onEnterTailChatBeforeNextNode={enterTailChatBeforeNodeEnd}
                onComplete={completeConversation}
                onReward={rewardGuest}
                showReward={snapshot.value === 'dayLoop.guest.reward'}
                onChatAvailabilityChange={handleChatAvailabilityChange}
                onTranscriptLine={appendCurrentGuestTranscript}
              />
            )}

            {snapshot.value === 'dayLoop.guest.observation' && (
              <ObservationPhase
                guest={guest}
                availableGroups={game.currentGuest.observationRequest?.featureGroups}
                prompt={game.currentGuest.observationRequest?.prompt}
                onComplete={completeObservation}
              />
            )}

            {snapshot.value === 'dayLoop.guest.mixing' && (
              <MixingPhase
                guest={guest}
                onServe={serveDrink}
                inventory={game.inventory}
                promptOverride={game.currentGuest.mixingPromptOverride}
                mixingRequest={mixingNode?.drink_request}
                teaching={teachingNode?.teaching}
              />
            )}

            {snapshot.value === 'dayLoop.guest.result' && (
              <ResultPhase
                isSuccess={game.currentGuest.isSuccess}
                mixedDrinkName={game.currentGuest.mixedDrinkName}
                isNewRecipe={game.currentGuest.isNewRecipe}
                onContinue={continueResult}
              />
            )}

            {snapshot.value === 'dayLoop.guest.reward' && (
              <RewardPhase
                rewards={game.currentGuest.pendingRewards}
                newRewardIds={game.currentGuest.pendingRewardNewIds}
                onContinue={continueReward}
              />
            )}

            {(snapshot.value === 'dayLoop.guest.llmChatLobby' ||
              snapshot.value === 'dayLoop.guest.llmChatSession') && (
              <TailChatPhase
                mode={snapshot.value === 'dayLoop.guest.llmChatSession' ? 'session' : 'lobby'}
                guestName={guest.name}
                speakerName={tailChatSpeakerName}
                portraitUrl={tailChatPortraitUrl}
                turnsUsed={game.currentGuest.tailChat.turnsUsed}
                maxTurns={game.currentGuest.tailChat.maxTurns}
                displayText={tailChatDisplayText}
                inputValue={tailChatInput}
                sessionStage={tailChatPlayback.stage}
                isRequesting={game.npcDialogue.status === 'requesting'}
                errorMessage={game.npcDialogue.errorMessage}
                onInputChange={setTailChatInput}
                onStartChat={openTailChatSession}
                onBackToLobby={leaveTailChatSession}
                onAdvance={handleTailChatAdvance}
                onSend={handleTailChatSend}
                onFinish={finishTailChatLobby}
              />
            )}

            {snapshot.value === 'dayLoop.guest.reflection' && game.pendingGuestReflection && (
              <GuestReflectionOverlay
                reflection={game.pendingGuestReflection}
                onContinue={continueReflection}
              />
            )}

            {snapshot.value === 'dayLoop.daySummary' && game.pendingDaySummary && (
              <DaySummaryPhase
                summary={game.pendingDaySummary}
                onContinue={continueDaySummary}
              />
            )}
          </div>
        )}

      {isDiaryOpen && (
        <Diary
          guest={guest}
          discoveredFeatures={game.currentGuest.discoveredFeatures}
          journalHistory={game.journalHistory}
          currentWeek={game.week}
          currentDay={game.day}
          onClose={() => setIsDiaryOpen(false)}
        />
      )}

      {isBookOpen && (
        <BookModal
          onClose={() => setIsBookOpen(false)}
          characterProgress={game.characterProgress}
          characterObservations={game.characterObservations}
          unlockedStoryChapters={game.unlockedStoryChapters}
          inventory={game.inventory}
          unlockedRecipes={game.unlockedRecipes}
        />
      )}

      {isSettingsOpen && (
        <SettingsModal
          onClose={() => setIsSettingsOpen(false)}
          onReturnToMenu={handleReturnToMenu}
          onSave={handleSave}
          onLoad={handleLoad}
          onDebugJump={isDebugMode ? debugJump : undefined}
          enableDebugTools={isDebugMode}
          currentPhase={currentPhase}
          currentWeek={game.week}
          currentDay={game.day}
        />
      )}
    </div>
  );
}
